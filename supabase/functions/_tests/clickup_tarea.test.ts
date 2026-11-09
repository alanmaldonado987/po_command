import { assert, assertEquals } from "jsr:@std/assert@1"
import {
  construirBloque,
  construirCuerpoActualizacion,
  construirCuerpoCreacion,
  construirDescripcion,
  diferenciaEtiquetas,
  estadoClickUpDe,
  etiquetasDeItem,
  fechaAMs,
  leerBloque,
  msAFecha,
  msAIso,
  prioridadAClickUp,
  prioridadDeTarea,
} from "../_shared/clickup_tarea.ts"
import { itemVinculable } from "./clickup_falso.ts"
import type { ItemClickUp } from "../_shared/clickup_tipos.ts"

const item = (extra: Record<string, unknown> = {}): ItemClickUp => itemVinculable(extra) as unknown as ItemClickUp

Deno.test("las fechas viajan a mediodía de Bogotá y vuelven al mismo día", () => {
  assertEquals(new Date(fechaAMs("2026-03-10")).toISOString(), "2026-03-10T17:00:00.000Z")
  for (const fecha of ["2026-01-01", "2026-03-10", "2026-12-31", "2028-02-29"]) {
    assertEquals(msAFecha(fechaAMs(fecha)), fecha)
    assertEquals(msAFecha(String(fechaAMs(fecha))), fecha)
  }
})

Deno.test("una fecha de ClickUp a medianoche local de Bogotá cae en el mismo día", () => {
  assertEquals(msAFecha(Date.parse("2026-03-10T00:00:00-05:00")), "2026-03-10")
  assertEquals(msAFecha(Date.parse("2026-03-10T23:59:00-05:00")), "2026-03-10")
})

Deno.test("msAFecha devuelve null para valores vacíos y msAIso convierte la marca de tiempo", () => {
  assertEquals(msAFecha(null), null)
  assertEquals(msAFecha(undefined), null)
  assertEquals(msAFecha(""), null)
  assertEquals(msAIso("1800000000000"), "2027-01-15T08:00:00.000Z")
})

Deno.test("el bloque estructurado hace ida y vuelta sin pérdida", () => {
  const original = item({
    descripcion: "Con «comillas», saltos\ny acentos ñ",
    plan_ini: "2026-03-01",
    plan_fin: "2026-03-20",
    plan_pruebas_ini: "2026-03-21",
    plan_pruebas_fin: "2026-03-30",
    real_ini: "2026-03-02",
    bloqueado: true,
    motivo_bloqueo: "Falta API --> del proveedor <b>urgente</b>",
  })
  const leido = leerBloque(`Texto previo\n\n${construirBloque(original)}\n`)
  assertEquals(leido?.codigo, "BL-010")
  assertEquals(leido?.cliente, "AIR-E")
  assertEquals(leido?.modulo, "Torre de Control")
  assertEquals(leido?.descripcion, original.descripcion)
  assertEquals(leido?.plan_pruebas_fin, "2026-03-30")
  assertEquals(leido?.real_ini, "2026-03-02")
  assertEquals(leido?.bloqueado, true)
  assertEquals(leido?.motivo, original.motivo_bloqueo)
})

Deno.test("el bloque escapa < y > para no cerrar el comentario HTML antes de tiempo", () => {
  const bloque = construirBloque(item({ motivo_bloqueo: "--> peligro <!--" }))
  const cuerpo = bloque.slice("<!--po-command ".length, -"-->".length)
  assert(!cuerpo.includes("-->"))
  assert(!cuerpo.includes("<"))
  assert(bloque.endsWith("-->"))
})

Deno.test("leerBloque tolera descripciones sin bloque, con JSON roto o nulas", () => {
  assertEquals(leerBloque(null), null)
  assertEquals(leerBloque(undefined), null)
  assertEquals(leerBloque("sin bloque"), null)
  assertEquals(leerBloque("<!--po-command {roto -->"), null)
  assertEquals(leerBloque("<!--po-command {} --> y luego texto"), {})
})

Deno.test("la descripción incluye texto legible, el bloque al final y omite bloqueo si no aplica", () => {
  const sinBloqueo = construirDescripcion(item({ descripcion: "Alcance detallado", plan_ini: "2026-03-01", fecha_compromiso: "2026-03-20" }))
  assert(sinBloqueo.startsWith("Alcance detallado"))
  assert(sinBloqueo.includes("**Cliente:** AIR-E"))
  assert(sinBloqueo.includes("**Planificado:** 2026-03-01 → 2026-03-20"))
  assert(!sinBloqueo.includes("**Bloqueado:**"))
  assert(sinBloqueo.trimEnd().endsWith("-->"))
  const conBloqueo = construirDescripcion(item({ bloqueado: true, motivo_bloqueo: "Falta API" }))
  assert(conBloqueo.includes("**Bloqueado:** Falta API"))
})

Deno.test("las etiquetas son alcance, fase y bloqueado cuando corresponde", () => {
  assertEquals(etiquetasDeItem(item()), ["Web", "Desarrollo"])
  assertEquals(etiquetasDeItem(item({ bloqueado: true })), ["Web", "Desarrollo", "bloqueado"])
  assertEquals(etiquetasDeItem(item({ alcance: "", fase: "" })), [])
})

Deno.test("diferenciaEtiquetas agrega las faltantes y solo quita las gestionadas por la app", () => {
  const { agregar, quitar } = diferenciaEtiquetas(["mobile", "Bloqueado", "urgente", "desarrollo"], item({ alcance: "Web", bloqueado: false }))
  assertEquals(agregar, ["Web"])
  assertEquals(quitar.sort(), ["Bloqueado", "mobile"].sort())
})

Deno.test("diferenciaEtiquetas compara sin distinguir mayúsculas", () => {
  assertEquals(diferenciaEtiquetas(["web", "DESARROLLO"], item()), { agregar: [], quitar: [] })
})

Deno.test("el cuerpo de creación usa campos nativos: nombre, estado, asignado, etiquetas y fechas", () => {
  const cuerpo = construirCuerpoCreacion(item({ plan_ini: "2026-03-01", fecha_compromiso: "2026-03-20" }), {
    estadoClickUp: "en desarrollo",
    asignadoId: 77,
  })
  assertEquals(cuerpo.name, "Mapa de rutas")
  assertEquals(cuerpo.status, "en desarrollo")
  assertEquals(cuerpo.assignees, [77])
  assertEquals(cuerpo.tags, ["Web", "Desarrollo"])
  assertEquals(cuerpo.start_date, fechaAMs("2026-03-01"))
  assertEquals(cuerpo.due_date, fechaAMs("2026-03-20"))
  assertEquals(cuerpo.start_date_time, false)
  assertEquals(cuerpo.due_date_time, false)
  assertEquals(cuerpo.description, cuerpo.markdown_content)
  assert(!("custom_fields" in cuerpo))
})

Deno.test("el cuerpo de creación omite estado y fechas que no existen y deja sin asignados", () => {
  const cuerpo = construirCuerpoCreacion(item(), { estadoClickUp: undefined, asignadoId: null })
  assertEquals("status" in cuerpo, false)
  assertEquals("start_date" in cuerpo, false)
  assertEquals("due_date" in cuerpo, false)
  assertEquals(cuerpo.assignees, [])
})

Deno.test("el cuerpo de actualización reemplaza asignados con add y rem y limpia fechas vacías con null", () => {
  const cuerpo = construirCuerpoActualizacion(item(), { estadoClickUp: "validación", asignadoId: 5 }, [1, 5, 9])
  assertEquals(cuerpo.assignees, { add: [], rem: [1, 9] })
  assertEquals(cuerpo.start_date, null)
  assertEquals(cuerpo.due_date, null)
  assertEquals(cuerpo.status, "validación")
  const nuevo = construirCuerpoActualizacion(item(), { estadoClickUp: undefined, asignadoId: 5 }, [])
  assertEquals(nuevo.assignees, { add: [5], rem: [] })
  assertEquals("status" in nuevo, false)
  const sinResponsable = construirCuerpoActualizacion(item(), { estadoClickUp: undefined, asignadoId: null }, [3])
  assertEquals(sinResponsable.assignees, { add: [], rem: [3] })
})

Deno.test("estadoClickUpDe devuelve el estado mapeado o undefined si no hay mapeo", () => {
  assertEquals(estadoClickUpDe({ "En curso": "en desarrollo" }, "En curso"), "en desarrollo")
  assertEquals(estadoClickUpDe({ "En curso": "en desarrollo" }, "Terminado"), undefined)
  assertEquals(estadoClickUpDe({ "En curso": "" }, "En curso"), undefined)
})

Deno.test("la prioridad de la app se traduce a la de ClickUp: Urgente 1, Alta 2, Normal 3, Baja 4 y sin prioridad null", () => {
  assertEquals(["Urgente", "Alta", "Normal", "Baja"].map((prioridad) => prioridadAClickUp({ prioridad })), [1, 2, 3, 4])
  assertEquals([prioridadAClickUp({ prioridad: null }), prioridadAClickUp({}), prioridadAClickUp({ prioridad: "Otra" })], [null, null, null])
})

Deno.test("el cuerpo de creación envía priority solo cuando el ítem tiene prioridad", () => {
  const opciones = { estadoClickUp: undefined, asignadoId: null }
  for (const [prioridad, numero] of [["Urgente", 1], ["Alta", 2], ["Normal", 3], ["Baja", 4]] as const) {
    assertEquals(construirCuerpoCreacion(item({ prioridad }), opciones).priority, numero)
  }
  assertEquals("priority" in construirCuerpoCreacion(item({ prioridad: null }), opciones), false)
  assertEquals("priority" in construirCuerpoCreacion(item(), opciones), false)
})

Deno.test("el cuerpo de actualización envía priority solo cuando difiere de la de la tarea y null si se borró", () => {
  const opciones = { estadoClickUp: undefined, asignadoId: null }
  assertEquals(construirCuerpoActualizacion(item({ prioridad: "Alta" }), opciones, [], null).priority, 2)
  assertEquals(construirCuerpoActualizacion(item({ prioridad: "Baja" }), opciones, [], 2).priority, 4)
  assertEquals("priority" in construirCuerpoActualizacion(item({ prioridad: "Alta" }), opciones, [], 2), false)
  const borrada = construirCuerpoActualizacion(item({ prioridad: null }), opciones, [], 3)
  assertEquals("priority" in borrada, true)
  assertEquals(borrada.priority, null)
  assertEquals("priority" in construirCuerpoActualizacion(item({ prioridad: null }), opciones, [], null), false)
})

Deno.test("prioridadDeTarea lee la prioridad de ClickUp por nombre o por id y tolera valores desconocidos", () => {
  assertEquals(
    [{ priority: "urgent" }, { priority: "HIGH" }, { priority: "normal" }, { priority: "low" }].map(prioridadDeTarea),
    [1, 2, 3, 4],
  )
  assertEquals([{ id: "1" }, { id: 2 }, { id: "3" }, { id: "4" }].map(prioridadDeTarea), [1, 2, 3, 4])
  assertEquals([null, undefined, {}, { id: "9" }, { priority: "critica" }].map(prioridadDeTarea), [null, null, null, null, null])
})
