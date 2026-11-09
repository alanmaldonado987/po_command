import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { avisarVencimientos, revisar } from "../_shared/reglas.ts"
import type { Item, Regla } from "../_shared/tipos.ts"
import { sumarHoras } from "../_shared/tiempo.ts"
import type { Fila } from "./base_falsa.ts"
import { crearEntorno, item, persona, PO, regla } from "./entorno.ts"

const AHORA = new Date("2026-11-06T14:00:00Z")
const HOY = "2026-11-06"
const hace = (horas: number): string => sumarHoras(AHORA, -horas).toISOString()
const dentroDe = (horas: number): string => sumarHoras(AHORA, horas).toISOString()
const claves = (filas: Fila[]): unknown[] => filas.map((fila) => fila.clave_unica)

function bloqueante(id: number, horasAbierto: number, horasEscalado: number | null = null): [Fila, Fila] {
  const comun = {
    id,
    item_id: id + 100,
    codigo: `BL-${id}`,
    cliente: "AIR-E",
    motivo: "Falta API",
    abierto_en: hace(horasAbierto),
    escalado_en: horasEscalado === null ? null : hace(horasEscalado),
  }
  return [comun, comun]
}

function entornoEscalamiento(horasAbierto: number, horasEscalado: number | null = null, extra: Fila = {}) {
  const [fila, vista] = bloqueante(1, horasAbierto, horasEscalado)
  return crearEntorno({
    regla_alerta: [regla("BLOQUEO_ESCALAR", { categoria: "Escalamientos", destinatarios: ["po"], parametro: 48, ...extra })],
    v_bloqueante_abierto: [vista],
    bloqueante: [{ ...fila }],
    v_item: [item({ id: 101, codigo: "BL-001" })],
  })
}

Deno.test("revisar sin reglas activas no crea nada", async () => {
  const { base } = crearEntorno()
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("escalamiento: un bloqueo de 49 h con umbral de 48 h se escala una vez y marca escalado_en", async () => {
  const { base } = entornoEscalamiento(49)
  assertEquals(await revisar(AHORA), 1)
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.regla_codigo, "BLOQUEO_ESCALAR")
  assertEquals(alerta.clave_unica, `ESC:1:${HOY}`)
  assertEquals(alerta.asunto, "[Escalamiento] BL-001 AIR-E bloqueado 49 h")
  assertEquals(alerta.destinatarios, [PO.correo])
  assertEquals(base.filas("bloqueante")[0].escalado_en, AHORA.toISOString())
})

Deno.test("escalamiento: un bloqueo de 47 h todavía no se escala", async () => {
  const { base } = entornoEscalamiento(47)
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("escalamiento: exactamente en el umbral se escala", async () => {
  const { base } = entornoEscalamiento(48)
  assertEquals(await revisar(AHORA), 1)
  assertEquals(base.filas("alerta_programada").length, 1)
})

Deno.test("escalamiento: no se repite antes de 24 h y sí después", async () => {
  const reciente = entornoEscalamiento(100, 23)
  assertEquals(await revisar(AHORA), 0)
  assertEquals(reciente.base.filas("alerta_programada").length, 0)
  const antiguo = entornoEscalamiento(100, 25)
  assertEquals(await revisar(AHORA), 1)
  assertEquals(antiguo.base.filas("alerta_programada").length, 1)
})

Deno.test("escalamiento: dos revisiones el mismo día no duplican (clave por bloqueo y día)", async () => {
  const { base } = entornoEscalamiento(60)
  assertEquals(await revisar(AHORA), 1)
  base.filas("bloqueante")[0].escalado_en = hace(30)
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("alerta_programada").length, 1)
})

Deno.test("escalamiento: el umbral viene del parámetro de la regla, aun como texto, y usa 48 h si es 0", async () => {
  const { base } = entornoEscalamiento(10, null, { parametro: "6" })
  assertEquals(await revisar(AHORA), 1)
  assertEquals(base.filas("alerta_programada").length, 1)
  const porDefecto = entornoEscalamiento(47, null, { parametro: 0 })
  assertEquals(await revisar(AHORA), 0)
  assertEquals(porDefecto.base.filas("alerta_programada").length, 0)
})

Deno.test("escalamiento: una regla inactiva no escala", async () => {
  const { base } = entornoEscalamiento(100, null, { activa: false })
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("escalamiento: sin destinatarios no marca escalado_en y se registra omitida solo una vez en el día", async () => {
  const { base } = entornoEscalamiento(60, null, { destinatarios: ["lider_tecnico"] })
  assertEquals(await revisar(AHORA), 0)
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("bloqueante")[0].escalado_en, null)
  assertEquals(base.filas("notificacion_log").filter((l) => l.estado === "Omitida").length, 1)
})

function entornoVencimientos(items: Fila[], extra: Record<string, Fila[]> = {}) {
  const luis = persona({ id: 1, nombre: "Luis", correo: "luis@ises.com.co", tipo: "equipo" })
  const ana = persona({ id: 2, nombre: "Ana", correo: "ana@ises.com.co", tipo: "equipo" })
  return crearEntorno({
    regla_alerta: [regla("VENCIMIENTO", { categoria: "Vencimientos", destinatarios: ["responsable"], parametro: 2 })],
    v_persona: [luis, ana],
    v_item: items,
    ...extra,
  })
}

const deLuis = (extra: Fila = {}) => item({ responsable_id: 1, responsable: "Luis", ...extra })
const deAna = (extra: Fila = {}) => item({ responsable_id: 2, responsable: "Ana", ...extra })

Deno.test("vencimiento: un correo por responsable con sus ítems vencidos y por vencer", async () => {
  const { base } = entornoVencimientos([
    deLuis({ codigo: "BL-A", fecha_compromiso: "2026-11-01", atraso_dias: 5 }),
    deLuis({ codigo: "BL-B", fecha_compromiso: "2026-11-08" }),
    deAna({ codigo: "BL-C", fecha_compromiso: "2026-11-06" }),
  ])
  assertEquals(await revisar(AHORA), 2)
  const alertas = base.filas("alerta_programada")
  assertEquals(claves(alertas), [`VEN:1:${HOY}`, `VEN:2:${HOY}`])
  assertEquals(alertas[0].asunto, "[Vencimientos] Luis: 1 vencido(s), 1 por vencer")
  assertEquals(alertas[0].destinatarios, ["luis@ises.com.co"])
  assertStringIncludes(String(alertas[0].cuerpo_html), "5 días de atraso")
  assertStringIncludes(String(alertas[0].cuerpo_html), "por vencer")
  assertEquals(alertas[1].asunto, "[Vencimientos] Ana: 0 vencido(s), 1 por vencer")
})

Deno.test("vencimiento: ignora cerrados, fechas fuera de la ventana y sin fecha", async () => {
  const { base } = entornoVencimientos([
    deLuis({ fecha_compromiso: "2026-11-09" }),
    deLuis({ estado: "Terminado", fecha_compromiso: "2026-10-01" }),
    deLuis({ estado: "Suspendido", fecha_compromiso: "2026-10-01" }),
    deLuis({ fecha_compromiso: null }),
  ])
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("vencimiento: la ventana incluye exactamente hoy + N días", async () => {
  const { base } = entornoVencimientos([deLuis({ fecha_compromiso: "2026-11-08" })])
  assertEquals(await revisar(AHORA), 1)
  assertEquals(base.filas("alerta_programada").length, 1)
})

Deno.test("vencimiento: 'Terminado, en etapa de pruebas' sin fin de pruebas no vence", async () => {
  const { base } = entornoVencimientos([
    deLuis({ estado: "Terminado, en etapa de pruebas", fecha_compromiso: "2026-11-01", plan_pruebas_fin: null }),
    deAna({ estado: "Terminado, en etapa de pruebas", fecha_compromiso: "2026-11-01", plan_pruebas_fin: "2026-11-01" }),
  ])
  assertEquals(await revisar(AHORA), 1)
  assertEquals(claves(base.filas("alerta_programada")), [`VEN:2:${HOY}`])
})

Deno.test("vencimiento: no se repite en el mismo día", async () => {
  const { base } = entornoVencimientos([deLuis({ fecha_compromiso: "2026-11-01", atraso_dias: 5 })])
  assertEquals(await revisar(AHORA), 1)
  assertEquals(await revisar(AHORA), 0)
  assertEquals(await revisar(new Date("2026-11-06T20:00:00Z")), 0)
  assertEquals(await revisar(new Date("2026-11-07T14:00:00Z")), 1)
  assertEquals(base.filas("alerta_programada").length, 2)
})

Deno.test("vencimiento: se programa a la hora de envío de la regla o ahora si ya pasó", async () => {
  const temprano = entornoVencimientos([deLuis({ fecha_compromiso: "2026-11-01" })])
  await revisar(new Date("2026-11-06T11:00:00Z"))
  assertEquals(temprano.base.filas("alerta_programada")[0].enviar_en, "2026-11-06T13:00:00.000Z")
  const tarde = entornoVencimientos([deLuis({ fecha_compromiso: "2026-11-01" })])
  await revisar(AHORA)
  assertEquals(tarde.base.filas("alerta_programada")[0].enviar_en, AHORA.toISOString())
})

Deno.test("vencimiento: ítems sin responsable no tienen a quién avisar y quedan como omitidos una sola vez", async () => {
  const { base } = entornoVencimientos([item({ fecha_compromiso: "2026-11-01" })])
  assertEquals(await revisar(AHORA), 0)
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
  assertEquals(base.filas("notificacion_log").length, 1)
})

Deno.test("vencimiento: el correo muestra como máximo 40 ítems y resume el resto", async () => {
  const muchos = Array.from({ length: 45 }, (_, n) => deLuis({ codigo: `BL-${n}`, fecha_compromiso: "2026-11-01", atraso_dias: 5 }))
  const { base } = entornoVencimientos(muchos)
  await revisar(AHORA)
  const cuerpo = String(base.filas("alerta_programada")[0].cuerpo_html)
  assertStringIncludes(cuerpo, "y 5 más en el backlog")
  assertStringIncludes(cuerpo, "BL-39")
  assert(!cuerpo.includes("BL-40"))
})

Deno.test("avisarVencimientos sin regla no hace nada", async () => {
  const { base } = entornoVencimientos([])
  assertEquals(await avisarVencimientos([item({ fecha_compromiso: "2026-11-01" }) as unknown as Item], null), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("avisarVencimientos usa la fecha recibida para decidir qué está vencido", async () => {
  const { base } = entornoVencimientos([])
  const lista = [deLuis({ fecha_compromiso: "2026-11-07", atraso_dias: 0 })] as unknown as Item[]
  const reglaVenc = regla("VENCIMIENTO", { categoria: "Vencimientos", destinatarios: ["responsable"] }) as unknown as Regla
  await avisarVencimientos(lista, reglaVenc, undefined, new Date("2026-11-06T15:00:00Z"))
  assertEquals(base.filas("alerta_programada")[0].asunto, "[Vencimientos] Luis: 0 vencido(s), 1 por vencer")
})

function entornoCeremonias(ceremonias: Fila[]) {
  return crearEntorno({
    regla_alerta: [regla("CEREMONIA", { categoria: "Ceremonias", destinatarios: ["audiencia"], parametro: 24 })],
    v_persona: [persona({ correo: "dev@ises.com.co", tipo: "equipo" })],
    v_ceremonia: ceremonias,
  })
}

const ceremonia = (id: number, fecha_hora: string, extra: Fila = {}): Fila => ({
  id,
  tipo: "Demo",
  titulo: `Demo ${id}`,
  fecha_hora,
  duracion_min: 60,
  lugar: "Teams",
  audiencia: "equipo",
  notas: "",
  cliente: "AIR-E",
  ...extra,
})

Deno.test("ceremonias: dentro de 24 h se envía el recordatorio 'previo' y no el de 1 h", async () => {
  const fecha = dentroDe(23)
  const { base } = entornoCeremonias([ceremonia(1, fecha)])
  assertEquals(await revisar(AHORA), 1)
  assertEquals(claves(base.filas("alerta_programada")), [`CER:1:previo:${fecha}`])
})

Deno.test("ceremonias: dentro de la última hora salen ambos recordatorios", async () => {
  const fecha = dentroDe(0.5)
  const { base } = entornoCeremonias([ceremonia(1, fecha)])
  assertEquals(await revisar(AHORA), 2)
  assertEquals(claves(base.filas("alerta_programada")), [`CER:1:previo:${fecha}`, `CER:1:1h:${fecha}`])
})

Deno.test("ceremonias: fuera de la ventana de 24 h o ya pasadas no generan recordatorio", async () => {
  const { base } = entornoCeremonias([ceremonia(1, dentroDe(30)), ceremonia(2, hace(1))])
  assertEquals(await revisar(AHORA), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("ceremonias: no se duplican los recordatorios en revisiones sucesivas", async () => {
  const { base } = entornoCeremonias([ceremonia(1, dentroDe(10))])
  await revisar(AHORA)
  assertEquals(await revisar(sumarHoras(AHORA, 1)), 0)
  assertEquals(base.filas("alerta_programada").length, 1)
})

Deno.test("ceremonias: reprogramar la ceremonia genera un recordatorio nuevo", async () => {
  const { base } = entornoCeremonias([ceremonia(1, dentroDe(10))])
  await revisar(AHORA)
  base.filas("v_ceremonia")[0].fecha_hora = dentroDe(12)
  assertEquals(await revisar(AHORA), 1)
  assertEquals(base.filas("alerta_programada").length, 2)
})

Deno.test("ceremonias: el aviso lleva título, hora local y notas", async () => {
  const { base } = entornoCeremonias([ceremonia(1, "2026-11-07T13:30:00.000Z", { notas: "Preparar demo", titulo: "Demo <AIR-E>" })])
  await revisar(AHORA)
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.asunto, "[Recordatorio] Demo <AIR-E> · 2026-11-07 08:30")
  assertStringIncludes(String(alerta.cuerpo_html), "Demo &lt;AIR-E&gt;")
  assertStringIncludes(String(alerta.cuerpo_html), "Preparar demo")
  assertEquals(alerta.destinatarios, ["dev@ises.com.co", PO.correo])
})

function entornoAcuerdos(acuerdos: Fila[]) {
  return crearEntorno({
    regla_alerta: [regla("ACUERDO_VENCIDO", { categoria: "Vencimientos", destinatarios: ["responsable", "po"] })],
    v_persona: [persona({ id: 1, nombre: "Luis", correo: "luis@ises.com.co" })],
    v_acuerdo: acuerdos,
  })
}

const acuerdo = (id: number, extra: Fila = {}): Fila => ({
  id,
  descripcion: `Acuerdo ${id}`,
  origen: "Demo",
  fecha_limite: "2026-11-01",
  estado: "Pendiente",
  responsable_id: 1,
  ...extra,
})

Deno.test("acuerdos: solo los vencidos y no cumplidos avisan al responsable y al PO", async () => {
  const { base } = entornoAcuerdos([
    acuerdo(1),
    acuerdo(2, { estado: "Cumplido" }),
    acuerdo(3, { fecha_limite: "2026-11-20" }),
    acuerdo(4, { fecha_limite: HOY }),
    acuerdo(5, { fecha_limite: null }),
    acuerdo(6, { estado: "En curso", fecha_limite: "2026-11-05" }),
  ])
  assertEquals(await revisar(AHORA), 2)
  assertEquals(claves(base.filas("alerta_programada")), ["ACU:1", "ACU:6"])
  assertEquals(base.filas("alerta_programada")[0].destinatarios, ["luis@ises.com.co", PO.correo])
  assertEquals(base.filas("alerta_programada")[0].asunto, "[Acuerdo vencido] Acuerdo 1")
})

Deno.test("acuerdos: el aviso no se repite en revisiones posteriores", async () => {
  const { base } = entornoAcuerdos([acuerdo(1)])
  await revisar(AHORA)
  assertEquals(await revisar(new Date("2026-11-07T14:00:00Z")), 0)
  assertEquals(base.filas("alerta_programada").length, 1)
})

Deno.test("acuerdos: el asunto recorta la descripción a 60 caracteres", async () => {
  const { base } = entornoAcuerdos([acuerdo(1, { descripcion: "x".repeat(100) })])
  await revisar(AHORA)
  assertEquals(base.filas("alerta_programada")[0].asunto, `[Acuerdo vencido] ${"x".repeat(60)}`)
})

function entornoResumen(extra: Record<string, Fila[]> = {}) {
  return crearEntorno({
    regla_alerta: [regla("RESUMEN_SEMANAL", { categoria: "Resumen semanal", destinatarios: ["po"], hora_envio: "07:30" })],
    v_item: [],
    v_bloqueante_abierto: [],
    v_ceremonia: [],
    nota: [],
    ...extra,
  })
}

Deno.test("resumen semanal: se crea los lunes con clave por semana ISO", async () => {
  const { base } = entornoResumen()
  assertEquals(await revisar(new Date("2026-11-09T14:00:00Z")), 1)
  const [alerta] = base.filas("alerta_programada")
  assertEquals(alerta.clave_unica, "RES:2026-46")
  assertEquals(alerta.asunto, "[Resumen semanal] Plan de trabajo semana 46")
  assertEquals(alerta.destinatarios, [PO.correo])
})

Deno.test("resumen semanal: no se crea de martes a domingo", async () => {
  const { base } = entornoResumen()
  for (const dia of ["10", "11", "12", "13", "14", "15"]) {
    assertEquals(await revisar(new Date(`2026-11-${dia}T14:00:00Z`)), 0)
  }
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("resumen semanal: solo una vez por semana aunque se revise varias veces el lunes", async () => {
  const { base } = entornoResumen()
  await revisar(new Date("2026-11-09T12:00:00Z"))
  assertEquals(await revisar(new Date("2026-11-09T18:00:00Z")), 0)
  assertEquals(base.filas("alerta_programada").length, 1)
  assertEquals(await revisar(new Date("2026-11-16T14:00:00Z")), 1)
})

Deno.test("resumen semanal: respeta que la regla esté inactiva", async () => {
  const { base } = crearEntorno({ regla_alerta: [regla("RESUMEN_SEMANAL", { activa: false })] })
  assertEquals(await revisar(new Date("2026-11-09T14:00:00Z")), 0)
  assertEquals(base.filas("alerta_programada").length, 0)
})

Deno.test("revisar suma las alertas creadas por todas las reglas", async () => {
  const { base } = crearEntorno({
    regla_alerta: [
      regla("BLOQUEO_ESCALAR", { categoria: "Escalamientos", destinatarios: ["po"], parametro: 48 }),
      regla("ACUERDO_VENCIDO", { categoria: "Vencimientos", destinatarios: ["po"] }),
    ],
    v_bloqueante_abierto: [bloqueante(1, 60)[1]],
    bloqueante: [bloqueante(1, 60)[0]],
    v_item: [item({ id: 101 })],
    v_acuerdo: [acuerdo(1), acuerdo(2)],
  })
  assertEquals(await revisar(AHORA), 3)
  assertEquals(base.filas("alerta_programada").length, 3)
})
