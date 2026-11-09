import { datosPo } from "./configuracion.ts"
import { admin, consultar } from "./supabase.ts"
import type { Destinatario, Persona } from "./tipos.ts"

const ROLES: Record<string, string> = {
  responsable: "Responsable",
  po: "Product Owner",
  equipo: "Equipo",
  lider_tecnico: "Líder técnico / DevOps",
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PATRON_LIDER = /lider tecnico|tech lead/i
const sinTildes = (texto: string): string => texto.normalize("NFD").replace(/[̀-ͯ]/g, "")

export const correoValido = (correo: unknown): boolean => typeof correo === "string" && EMAIL.test(correo.trim())

interface Contexto {
  item?: { responsable_id?: number | null; cliente_id?: number | null } | null
  clienteId?: number | null
  audiencia?: string | null
}

const aceptaCategoria = (persona: Persona, categoria: string): boolean =>
  persona.recibe.length === 0 || persona.recibe.includes(categoria)

export async function resolver(roles: string[], categoria: string, contexto: Contexto = {}): Promise<Destinatario[]> {
  const po = await datosPo()
  const personas = await consultar<Persona[]>(admin.from("v_persona").select("*").eq("activo", true))
  const clienteId = contexto.clienteId ?? contexto.item?.cliente_id ?? null
  const audiencia = contexto.audiencia ?? null
  const salida: Destinatario[] = []

  const agregar = (persona: Persona | undefined, rol: string, forzar = false) => {
    if (!persona || (!forzar && !aceptaCategoria(persona, categoria))) return
    if (correoValido(persona.correo)) {
      salida.push({ nombre: persona.nombre, correo: persona.correo.trim(), rol })
    } else if (correoValido(po.correo)) {
      salida.push({ nombre: `${po.nombre} (en lugar de ${persona.nombre}, sin correo)`, correo: po.correo, rol })
    }
  }

  for (const rol of roles) {
    const esAudiencia = rol === "audiencia"
    if (rol === "po" && correoValido(po.correo)) {
      salida.push({ nombre: po.nombre, correo: po.correo, rol: ROLES.po })
    } else if (rol === "responsable" && contexto.item?.responsable_id) {
      agregar(personas.find((p) => p.id === contexto.item?.responsable_id), ROLES.responsable, true)
    } else if (rol === "equipo" || (esAudiencia && (audiencia === "equipo" || audiencia === "todos"))) {
      personas.filter((p) => p.tipo === "equipo").forEach((p) => agregar(p, ROLES.equipo))
    }

    if (rol === "stakeholders" || (esAudiencia && (audiencia === "stakeholders" || audiencia === "todos"))) {
      personas
        .filter((p) => p.tipo === "stakeholder")
        .filter((p) => !(clienteId && rol === "stakeholders") || p.cliente_ids.includes(clienteId))
        .forEach((p) => agregar(p, "Stakeholder"))
    } else if (rol === "lider_tecnico") {
      personas.filter((p) => PATRON_LIDER.test(sinTildes(p.rol))).forEach((p) => agregar(p, ROLES.lider_tecnico))
    }
  }

  const vistos = new Set<string>()
  return salida.filter(({ correo }) => {
    const clave = correo.toLowerCase()
    if (vistos.has(clave)) return false
    vistos.add(clave)
    return true
  })
}
