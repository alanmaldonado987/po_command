import { admin, consultar } from "./supabase.ts"
import type { Fila, Item } from "./tipos.ts"

const CERRADOS = ["Terminado", "Suspendido"]
const ESTADO_PRUEBAS = "Terminado, en etapa de pruebas"

export const obtenerItem = (id: number): Promise<Item> => consultar<Item>(admin.from("v_item").select("*").eq("id", id).single())

export const listarItemsPorId = (ids: number[]): Promise<Item[]> =>
  consultar<Item[]>(admin.from("v_item").select("*").in("id", ids))

export const listarItemsAbiertos = (): Promise<Item[]> =>
  consultar<Item[]>(admin.from("v_item").select("*").not("estado", "in", `(${CERRADOS.map((e) => `"${e}"`).join(",")})`))

export const itemsPorVencer = (abiertos: Item[], tope: string): Item[] =>
  abiertos
    .filter((item) => item.fecha_compromiso !== null && item.fecha_compromiso <= tope)
    .sort((a, b) => a.fecha_compromiso!.localeCompare(b.fecha_compromiso!))

export const venceSoloConPruebas = (item: Item): boolean => item.estado === ESTADO_PRUEBAS && !item.plan_pruebas_fin

export const ubicacion = (item: Item): Fila[] => [
  ["Cliente · actividad", `${item.cliente ?? "-"} · ${item.actividad ?? "-"}`],
  ["Módulo · funcionalidad", `${item.modulo ?? "-"} · ${item.funcionalidad || "-"}`],
  ["Fase · alcance", `${item.fase || "-"} · ${item.alcance || "-"}`],
]
