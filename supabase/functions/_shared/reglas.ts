import { encolar, existeClave } from "./cola.ts"
import { reglaActiva } from "./configuracion.ts"
import { resolver } from "./destinatarios.ts"
import { itemsPorVencer, listarItemsAbiertos, obtenerItem, ubicacion, venceSoloConPruebas } from "./items.ts"
import { plantilla } from "./plantilla.ts"
import { resumenSemanalHtml } from "./resumen.ts"
import { admin, consultar } from "./supabase.ts"
import { aLaHora, esLunes, formatoFecha, formatoLocal, horasEntre, hoy, semanaIso, sumarDias, sumarHoras } from "./tiempo.ts"
import type { Acuerdo, BloqueanteAbierto, Ceremonia, Fila, Item, Regla } from "./tipos.ts"

const MAX_FILAS_VENCIMIENTO = 40
const HORAS_ESCALAMIENTO_DEFECTO = 48
const DIAS_VENCIMIENTO_DEFECTO = 2
const HORAS_RECORDATORIO_DEFECTO = 24
const HORAS_REPETICION_ESCALAMIENTO = 24

const parametro = (regla: Regla, defecto: number): number => Number(regla.parametro) || defecto

export async function escalar(
  bloqueante: BloqueanteAbierto,
  regla: Regla,
  ahora = new Date(),
  clave?: string,
): Promise<number | null> {
  const item = await obtenerItem(bloqueante.item_id)
  const horas = horasEntre(new Date(bloqueante.abierto_en), ahora)
  const destinatarios = await resolver(regla.destinatarios, regla.categoria, { item })
  const cuerpo = await plantilla({
    titulo: `Escalamiento: ${item.codigo} lleva ${horas} h bloqueado`,
    saludo: "Hola,",
    intro: "Necesitamos su apoyo para destrabar este ítem del plan de trabajo.",
    filas: [
      ...ubicacion(item),
      ["Motivo", bloqueante.motivo],
      ["Responsable", item.responsable ?? "-"],
      ["Fecha fin planificada", formatoFecha(item.fecha_compromiso)],
    ],
    cierre: "Por favor confirmen responsable y fecha de solución respondiendo este correo.",
    color: "#B91C1C",
  })
  const id = await encolar({
    regla: "BLOQUEO_ESCALAR",
    entidad: "item",
    entidadId: item.id,
    asunto: `[Escalamiento] ${item.codigo} ${item.cliente ?? ""} bloqueado ${horas} h`,
    cuerpo,
    destinatarios,
    clave,
  })
  if (id) {
    await consultar(admin.from("bloqueante").update({ escalado_en: ahora.toISOString() }).eq("id", bloqueante.id))
  }
  return id
}

export async function avisarVencimientos(
  lista: Item[],
  regla: Regla | null,
  cuando?: Date,
  ahora = new Date(),
): Promise<number> {
  if (!regla) return 0
  const fechaHoy = hoy(ahora)
  const grupos = new Map<number | null, Item[]>()
  for (const item of lista) {
    if (!item.fecha_compromiso || venceSoloConPruebas(item)) continue
    grupos.set(item.responsable_id, [...(grupos.get(item.responsable_id) ?? []), item])
  }

  let creadas = 0
  for (const [responsableId, grupo] of grupos) {
    const items = grupo.sort((a, b) => a.fecha_compromiso!.localeCompare(b.fecha_compromiso!))
    const vencidos = items.filter((i) => i.fecha_compromiso! < fechaHoy)
    const nombre = items[0].responsable ?? "Sin responsable"
    const destinatarios = await resolver(regla.destinatarios, regla.categoria, {
      item: { responsable_id: responsableId, cliente_id: items[0].cliente_id },
    })
    const filas: Fila[] = items.slice(0, MAX_FILAS_VENCIMIENTO).map((i) => [
      `${i.codigo} · ${i.cliente ?? "-"}`,
      `${i.titulo} (${i.actividad ?? "-"}, ${i.alcance || "-"}) · fin plan. ${formatoFecha(i.fecha_compromiso)}` +
        (vencidos.includes(i) ? ` · ${i.atraso_dias} días de atraso` : " · por vencer") +
        ` · ${i.estado}`,
    ])
    if (items.length > MAX_FILAS_VENCIMIENTO) filas.push(["…", `y ${items.length - MAX_FILAS_VENCIMIENTO} más en el backlog`])
    const porVencer = items.length - vencidos.length
    const cuerpo = await plantilla({
      titulo: `${vencidos.length} vencido(s) y ${porVencer} por vencer`,
      saludo: `Hola ${responsableId ? nombre : ""},`,
      intro: "Estos ítems tuyos pasaron o están por pasar su fecha fin planificada:",
      filas,
      cierre: "Si la fecha cambió, actualízala en el backlog para que quede la reprogramación.",
      color: "#B45309",
    })
    const id = await encolar({
      regla: "VENCIMIENTO",
      entidad: "persona",
      entidadId: responsableId,
      asunto: `[Vencimientos] ${nombre}: ${vencidos.length} vencido(s), ${porVencer} por vencer`,
      cuerpo,
      destinatarios,
      enviarEn: cuando,
      clave: `VEN:${responsableId ?? 0}:${fechaHoy}`,
    })
    if (id) creadas += 1
  }
  return creadas
}

async function revisarEscalamientos(ahora: Date): Promise<number> {
  const regla = await reglaActiva("BLOQUEO_ESCALAR")
  if (!regla) return 0
  const limite = sumarHoras(ahora, -parametro(regla, HORAS_ESCALAMIENTO_DEFECTO))
  const repeticion = sumarHoras(ahora, -HORAS_REPETICION_ESCALAMIENTO)
  const bloqueantes = await consultar<BloqueanteAbierto[]>(admin.from("v_bloqueante_abierto").select("*"))
  let creadas = 0
  for (const b of bloqueantes) {
    const vencido = new Date(b.abierto_en) <= limite
    const pendiente = !b.escalado_en || new Date(b.escalado_en) <= repeticion
    if (vencido && pendiente && (await escalar(b, regla, ahora, `ESC:${b.id}:${hoy(ahora)}`))) creadas += 1
  }
  return creadas
}

async function revisarVencimientos(ahora: Date): Promise<number> {
  const regla = await reglaActiva("VENCIMIENTO")
  if (!regla) return 0
  const tope = sumarDias(hoy(ahora), parametro(regla, DIAS_VENCIMIENTO_DEFECTO))
  const items = itemsPorVencer(await listarItemsAbiertos(), tope)
  return avisarVencimientos(items, regla, aLaHora(regla.hora_envio, ahora), ahora)
}

async function revisarCeremonias(ahora: Date): Promise<number> {
  const regla = await reglaActiva("CEREMONIA")
  if (!regla) return 0
  const ceremonias = await consultar<Ceremonia[]>(
    admin.from("v_ceremonia").select("*").gt("fecha_hora", ahora.toISOString()),
  )
  const avisos: [string, number][] = [
    ["previo", parametro(regla, HORAS_RECORDATORIO_DEFECTO)],
    ["1h", 1],
  ]
  let creadas = 0
  for (const c of ceremonias) {
    const cuando = new Date(c.fecha_hora)
    for (const [etiqueta, horas] of avisos) {
      if (cuando > sumarHoras(ahora, horas)) continue
      const destinatarios = await resolver(["audiencia", "po"], regla.categoria, { audiencia: c.audiencia })
      const cuerpo = await plantilla({
        titulo: `Recordatorio: ${c.titulo}`,
        saludo: "Hola,",
        intro: `La ceremonia empieza el ${formatoLocal(c.fecha_hora)}.`,
        filas: [["Lugar", c.lugar], ["Duración", `${c.duracion_min} min`], ["Notas", c.notas || "-"]],
      })
      const id = await encolar({
        regla: "CEREMONIA",
        entidad: "ceremonia",
        entidadId: c.id,
        asunto: `[Recordatorio] ${c.titulo} · ${formatoLocal(c.fecha_hora)}`,
        cuerpo,
        destinatarios,
        clave: `CER:${c.id}:${etiqueta}:${c.fecha_hora}`,
      })
      if (id) creadas += 1
    }
  }
  return creadas
}

async function revisarAcuerdos(ahora: Date): Promise<number> {
  const regla = await reglaActiva("ACUERDO_VENCIDO")
  if (!regla) return 0
  const acuerdos = await consultar<Acuerdo[]>(
    admin.from("v_acuerdo").select("*").neq("estado", "Cumplido").lt("fecha_limite", hoy(ahora)),
  )
  let creadas = 0
  for (const a of acuerdos) {
    const destinatarios = await resolver(regla.destinatarios, regla.categoria, { item: { responsable_id: a.responsable_id } })
    const cuerpo = await plantilla({
      titulo: "Acuerdo vencido",
      saludo: "Hola,",
      intro: "Este compromiso pasó su fecha límite:",
      filas: [["Acuerdo", a.descripcion], ["Origen", a.origen], ["Fecha límite", a.fecha_limite ?? "-"]],
      color: "#B45309",
    })
    const id = await encolar({
      regla: "ACUERDO_VENCIDO",
      entidad: "acuerdo",
      entidadId: a.id,
      asunto: `[Acuerdo vencido] ${a.descripcion.slice(0, 60)}`,
      cuerpo,
      destinatarios,
      enviarEn: aLaHora(regla.hora_envio, ahora),
      clave: `ACU:${a.id}`,
    })
    if (id) creadas += 1
  }
  return creadas
}

async function revisarResumenSemanal(ahora: Date): Promise<number> {
  const regla = await reglaActiva("RESUMEN_SEMANAL")
  if (!regla || !esLunes(ahora)) return 0
  const { anio, semana } = semanaIso(hoy(ahora))
  const clave = `RES:${anio}-${semana}`
  if (await existeClave(clave)) return 0
  const id = await encolar({
    regla: "RESUMEN_SEMANAL",
    entidad: "portafolio",
    entidadId: null,
    asunto: `[Resumen semanal] Plan de trabajo semana ${semana}`,
    cuerpo: await resumenSemanalHtml(ahora),
    destinatarios: await resolver(regla.destinatarios, regla.categoria),
    enviarEn: aLaHora(regla.hora_envio, ahora),
    clave,
  })
  return id ? 1 : 0
}

export async function revisar(ahora = new Date()): Promise<number> {
  const resultados = [
    await revisarEscalamientos(ahora),
    await revisarVencimientos(ahora),
    await revisarCeremonias(ahora),
    await revisarAcuerdos(ahora),
    await revisarResumenSemanal(ahora),
  ]
  return resultados.reduce((total, n) => total + n, 0)
}
