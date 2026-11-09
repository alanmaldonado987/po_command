import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { alGuardarItem } from "../_shared/eventos.ts"
import type { ResultadoGuardado } from "../_shared/tipos.ts"
import type { Fila } from "./base_falsa.ts"
import { crearEntorno, item, persona, PO, regla } from "./entorno.ts"

const resultado = (id: number, extra: Partial<ResultadoGuardado> = {}): ResultadoGuardado => ({
  id,
  antes: null,
  cambios: [],
  sin_cambios: false,
  ...extra,
})

const reglasDeAviso = (extra: Fila = {}): Fila[] => [
  regla("BLOQUEO_NUEVO", { destinatarios: ["responsable", "po"] }),
  regla("BLOQUEO_RESUELTO", { destinatarios: ["responsable", "po"] }),
  regla("REPROGRAMACION", { categoria: "Reprogramaciones", destinatarios: ["responsable", "po"], ...extra }),
]

const luis = persona({ id: 1, nombre: "Luis", correo: "luis@ises.com.co" })

function entorno(itemGuardado: Fila, reglas = reglasDeAviso()) {
  return crearEntorno({
    regla_alerta: reglas,
    v_persona: [luis],
    v_item: [item({ responsable_id: 1, responsable: "Luis", ...itemGuardado })],
  })
}

Deno.test("un ítem recién bloqueado avisa al responsable y al PO con el mensaje esperado", async () => {
  const { base } = entorno({ id: 10, codigo: "BL-010", bloqueado: true, motivo_bloqueo: "Falta API", fecha_compromiso: "2026-12-01" })
  const mensaje = await alGuardarItem(resultado(10))
  assertEquals(mensaje, "Alerta de bloqueante para 2 destinatario(s).")
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.regla_codigo, "BLOQUEO_NUEVO")
  assertEquals(alerta.asunto, "[Bloqueante] BL-010 AIR-E · Torre de Control · completo")
  assertEquals(alerta.destinatarios, ["luis@ises.com.co", PO.correo])
  assertStringIncludes(String(alerta.cuerpo_html), "Falta API")
  assertStringIncludes(String(alerta.cuerpo_html), "01/12/2026")
})

Deno.test("un bloqueo existente antes que sigue bloqueado no vuelve a avisar", async () => {
  const { base } = entorno({ id: 10, bloqueado: true })
  const mensaje = await alGuardarItem(resultado(10, { antes: { bloqueado: true, motivo_bloqueo: "x" } }))
  assertEquals(mensaje, "")
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("un bloqueo sin destinatarios válidos lo informa y no encola", async () => {
  const { base } = crearEntorno({
    regla_alerta: reglasDeAviso(),
    v_persona: [],
    v_item: [item({ id: 10, bloqueado: true })],
    config: [{ clave: "po_nombre", valor: "PO" }],
  })
  assertEquals(await alGuardarItem(resultado(10)), "Bloqueo registrado, pero no hay destinatarios con correo válido.")
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("sin regla de bloqueo activa el mensaje queda vacío", async () => {
  const { base } = entorno({ id: 10, bloqueado: true }, reglasDeAviso().map((r) => ({ ...r, activa: false })))
  assertEquals(await alGuardarItem(resultado(10)), "")
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("al desbloquear informa la resolución y encola el aviso de bloqueo resuelto con el motivo anterior", async () => {
  const { base } = entorno({ id: 10, codigo: "BL-010", bloqueado: false, estado: "En curso" })
  const mensaje = await alGuardarItem(resultado(10, { antes: { bloqueado: true, motivo_bloqueo: "Falta API" } }))
  assertEquals(mensaje, "Bloqueo resuelto: se avisa al equipo y se cancelan los escalamientos.")
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.regla_codigo, "BLOQUEO_RESUELTO")
  assertEquals(alerta.asunto, "[Resuelto] BL-010 Torre de Control · completo")
  assertStringIncludes(String(alerta.cuerpo_html), "Falta API")
  assertStringIncludes(String(alerta.cuerpo_html), "En curso")
})

Deno.test("al desbloquear con la regla inactiva igual informa pero no encola", async () => {
  const { base } = entorno(
    { id: 10, bloqueado: false },
    reglasDeAviso().map((r) => ({ ...r, activa: r.codigo !== "BLOQUEO_RESUELTO" })),
  )
  const mensaje = await alGuardarItem(resultado(10, { antes: { bloqueado: true, motivo_bloqueo: "x" } }))
  assertEquals(mensaje, "Bloqueo resuelto: se avisa al equipo y se cancelan los escalamientos.")
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("un cambio de fechas avisa con cada fecha antes → después", async () => {
  const { base } = entorno({ id: 10, codigo: "BL-010", bloqueado: false })
  const mensaje = await alGuardarItem(
    resultado(10, {
      antes: { bloqueado: false, motivo_bloqueo: "" },
      cambios: [
        { campo: "plan_fin", antes: "2026-01-01", despues: "2026-01-15" },
        { campo: "plan_pruebas_fin", antes: null, despues: "2026-02-01" },
      ],
    }),
  )
  assertEquals(mensaje, "Reprogramación avisada a 2 destinatario(s).")
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.asunto, "[Reprogramación] BL-010 Torre de Control · completo")
  assertStringIncludes(String(alerta.cuerpo_html), "Fin planificado")
  assertStringIncludes(String(alerta.cuerpo_html), "01/01/2026 → 15/01/2026")
  assertStringIncludes(String(alerta.cuerpo_html), "Fin de pruebas planificado")
  assertStringIncludes(String(alerta.cuerpo_html), "- → 01/02/2026")
})

Deno.test("una reprogramación sin destinatarios no devuelve mensaje", async () => {
  entorno({ id: 10 }, [regla("REPROGRAMACION", { destinatarios: ["stakeholders"] })])
  const mensaje = await alGuardarItem(
    resultado(10, { antes: { bloqueado: false, motivo_bloqueo: "" }, cambios: [{ campo: "plan_fin", antes: null, despues: "2026-01-15" }] }),
  )
  assertEquals(mensaje, "")
})

Deno.test("bloqueo y reprogramación en la misma edición concatenan ambos mensajes", async () => {
  const { base } = entorno({ id: 10, bloqueado: true, motivo_bloqueo: "x" })
  const mensaje = await alGuardarItem(
    resultado(10, { cambios: [{ campo: "plan_fin", antes: "2026-01-01", despues: "2026-01-02" }] }),
  )
  assertEquals(mensaje, "Alerta de bloqueante para 2 destinatario(s). Reprogramación avisada a 2 destinatario(s).")
  assertEquals(base.filas("alerta_programada").length, 2)
})

Deno.test("guardar sin novedades no genera avisos", async () => {
  const { base } = entorno({ id: 10 })
  const mensaje = await alGuardarItem(resultado(10, { antes: { bloqueado: false, motivo_bloqueo: "" }, sin_cambios: true }))
  assertEquals(mensaje, "")
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("el HTML del motivo del bloqueo se escapa en el correo", async () => {
  const { base } = entorno({ id: 10, bloqueado: true, motivo_bloqueo: "<script>alert(1)</script>" })
  await alGuardarItem(resultado(10))
  const cuerpo = String(base.filas("alerta_programada")[0].cuerpo_html)
  assertEquals(cuerpo.includes("<script>alert(1)</script>"), false)
  assertStringIncludes(cuerpo, "&lt;script&gt;alert(1)&lt;/script&gt;")
})
