import type { SupabaseClient } from "npm:@supabase/supabase-js@2"

export type Fila = Record<string, unknown>

interface ErrorBase {
  message: string
  code?: string
}

interface Respuesta {
  data: unknown
  error: ErrorBase | null
  count?: number | null
}

type Filtro = (fila: Fila) => boolean

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}T/
const columnasUnicas: Record<string, string> = { alerta_programada: "clave_unica" }

const valorDe = (fila: Fila, columna: string): unknown => fila[columna] ?? null

function comparar(a: unknown, b: unknown): number {
  if (typeof a === "string" && typeof b === "string" && FECHA_ISO.test(a) && FECHA_ISO.test(b)) {
    return Date.parse(a) - Date.parse(b)
  }
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0
}

function listaDesdeTexto(texto: string): string[] {
  return texto
    .replace(/^\(|\)$/g, "")
    .split(",")
    .map((valor) => valor.trim().replace(/^"|"$/g, ""))
}

export class Consulta implements PromiseLike<Respuesta> {
  private operacion: "select" | "insert" | "update" | "delete" = "select"
  private filtros: Filtro[] = []
  private ordenes: { columna: string; ascendente: boolean }[] = []
  private limite: number | null = null
  private devuelve = false
  private soloConteo = false
  private modo: "lista" | "unica" | "opcional" = "lista"
  private cambios: Fila | Fila[] = {}

  constructor(private base: BaseFalsa, private tabla: string) {}

  select(_columnas?: string, opciones?: { count?: string; head?: boolean }): this {
    if (this.operacion === "select") this.soloConteo = Boolean(opciones?.head)
    else this.devuelve = true
    return this
  }

  insert(datos: Fila | Fila[]): this {
    this.operacion = "insert"
    this.cambios = datos
    return this
  }

  update(datos: Fila): this {
    this.operacion = "update"
    this.cambios = datos
    return this
  }

  delete(): this {
    this.operacion = "delete"
    return this
  }

  eq(columna: string, valor: unknown): this {
    return this.filtrar((fila) => comparar(valorDe(fila, columna), valor) === 0 && valorDe(fila, columna) !== null)
  }

  neq(columna: string, valor: unknown): this {
    return this.filtrar((fila) => comparar(valorDe(fila, columna), valor) !== 0)
  }

  gt(columna: string, valor: unknown): this {
    return this.filtrar((fila) => valorDe(fila, columna) !== null && comparar(valorDe(fila, columna), valor) > 0)
  }

  gte(columna: string, valor: unknown): this {
    return this.filtrar((fila) => valorDe(fila, columna) !== null && comparar(valorDe(fila, columna), valor) >= 0)
  }

  lt(columna: string, valor: unknown): this {
    return this.filtrar((fila) => valorDe(fila, columna) !== null && comparar(valorDe(fila, columna), valor) < 0)
  }

  lte(columna: string, valor: unknown): this {
    return this.filtrar((fila) => valorDe(fila, columna) !== null && comparar(valorDe(fila, columna), valor) <= 0)
  }

  in(columna: string, valores: unknown[]): this {
    return this.filtrar((fila) => valores.some((valor) => comparar(valorDe(fila, columna), valor) === 0))
  }

  is(columna: string, valor: unknown): this {
    return this.filtrar((fila) => valorDe(fila, columna) === valor)
  }

  not(columna: string, operador: string, valor: unknown): this {
    if (operador === "in") {
      const lista = listaDesdeTexto(String(valor))
      return this.filtrar((fila) => !lista.includes(String(valorDe(fila, columna))))
    }
    if (operador === "is") return this.filtrar((fila) => valorDe(fila, columna) !== valor)
    throw new Error(`Operador no soportado por la base falsa: not.${operador}`)
  }

  order(columna: string, opciones?: { ascending?: boolean }): this {
    this.ordenes.push({ columna, ascendente: opciones?.ascending ?? true })
    return this
  }

  limit(cantidad: number): this {
    this.limite = cantidad
    return this
  }

  single(): this {
    this.modo = "unica"
    return this
  }

  maybeSingle(): this {
    this.modo = "opcional"
    return this
  }

  then<R1 = Respuesta, R2 = never>(
    alResolver?: ((valor: Respuesta) => R1 | PromiseLike<R1>) | null,
    alRechazar?: ((motivo: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return Promise.resolve(this.ejecutar()).then(alResolver, alRechazar)
  }

  private filtrar(filtro: Filtro): this {
    this.filtros.push(filtro)
    return this
  }

  private coincidencias(): Fila[] {
    return this.base.filas(this.tabla).filter((fila) => this.filtros.every((filtro) => filtro(fila)))
  }

  private ejecutar(): Respuesta {
    const falla = this.base.fallo(this.tabla, this.operacion)
    if (falla) return { data: null, error: falla }
    if (this.operacion === "insert") return this.ejecutarInsert()
    if (this.operacion === "update") return this.ejecutarUpdate()
    if (this.operacion === "delete") return this.ejecutarDelete()
    return this.ejecutarSelect()
  }

  private ejecutarSelect(): Respuesta {
    let filas = this.coincidencias()
    if (this.soloConteo) return { data: null, error: null, count: filas.length }
    for (const { columna, ascendente } of [...this.ordenes].reverse()) {
      filas = [...filas].sort((a, b) => comparar(valorDe(a, columna), valorDe(b, columna)) * (ascendente ? 1 : -1))
    }
    if (this.limite !== null) filas = filas.slice(0, this.limite)
    return this.formatear(filas.map((fila) => structuredClone(fila)))
  }

  private ejecutarInsert(): Respuesta {
    const nuevas = Array.isArray(this.cambios) ? this.cambios : [this.cambios]
    const insertadas: Fila[] = []
    for (const datos of nuevas) {
      const resultado = this.base.insertar(this.tabla, datos)
      if ("error" in resultado) return { data: null, error: resultado.error }
      insertadas.push(structuredClone(resultado.fila))
    }
    return this.devuelve ? this.formatear(insertadas) : { data: null, error: null }
  }

  private ejecutarUpdate(): Respuesta {
    const filas = this.coincidencias()
    filas.forEach((fila) => Object.assign(fila, structuredClone(this.cambios)))
    return this.devuelve ? this.formatear(filas.map((fila) => structuredClone(fila))) : { data: null, error: null }
  }

  private ejecutarDelete(): Respuesta {
    const eliminar = new Set(this.coincidencias())
    this.base.tablas[this.tabla] = this.base.filas(this.tabla).filter((fila) => !eliminar.has(fila))
    return { data: null, error: null }
  }

  private formatear(filas: Fila[]): Respuesta {
    if (this.modo === "lista") return { data: filas, error: null }
    if (filas.length === 1) return { data: filas[0], error: null }
    if (filas.length === 0 && this.modo === "opcional") return { data: null, error: null }
    return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } }
  }
}

const VALORES_POR_DEFECTO: Record<string, () => Fila> = {
  alerta_programada: () => ({
    estado: "Pendiente",
    intentos: 0,
    error: null,
    enviado_en: null,
    clave_unica: null,
    creado_en: new Date().toISOString(),
  }),
  notificacion_log: () => ({ fecha: new Date().toISOString(), canal: "Correo" }),
}

export class BaseFalsa {
  tablas: Record<string, Fila[]> = {}
  rpcs: { nombre: string; argumentos: unknown }[] = []
  private ultimoId: Record<string, number> = {}
  private fallos = new Map<string, ErrorBase>()

  constructor(datos: Record<string, Fila[]> = {}) {
    for (const [tabla, filas] of Object.entries(datos)) {
      this.tablas[tabla] = filas.map((fila) => ({ ...fila }))
      this.ultimoId[tabla] = Math.max(0, ...filas.map((fila) => Number(fila.id ?? 0)))
    }
  }

  filas(tabla: string): Fila[] {
    return (this.tablas[tabla] ??= [])
  }

  from(tabla: string): Consulta {
    return new Consulta(this, tabla)
  }

  manejadoresRpc: Record<string, (argumentos: unknown) => unknown> = {}

  rpc(nombre: string, argumentos: unknown): Promise<Respuesta> {
    this.rpcs.push({ nombre, argumentos })
    const manejador = this.manejadoresRpc[nombre]
    return Promise.resolve({ data: manejador ? manejador(argumentos) : null, error: null })
  }

  fallar(tabla: string, operacion: string, mensaje: string, code?: string): void {
    this.fallos.set(`${tabla}:${operacion}`, { message: mensaje, code })
  }

  fallo(tabla: string, operacion: string): ErrorBase | null {
    return this.fallos.get(`${tabla}:${operacion}`) ?? null
  }

  insertar(tabla: string, datos: Fila): { fila: Fila } | { error: ErrorBase } {
    const columnaUnica = columnasUnicas[tabla]
    const valorUnico = columnaUnica ? datos[columnaUnica] : null
    if (columnaUnica && valorUnico && this.filas(tabla).some((fila) => fila[columnaUnica] === valorUnico)) {
      return { error: { message: `duplicate key value violates unique constraint (${columnaUnica})`, code: "23505" } }
    }
    this.ultimoId[tabla] = (this.ultimoId[tabla] ?? 0) + 1
    const fila: Fila = { ...VALORES_POR_DEFECTO[tabla]?.(), id: this.ultimoId[tabla], ...datos }
    if (tabla === "alerta_programada" && !("enviar_en" in datos)) fila.enviar_en = new Date().toISOString()
    this.filas(tabla).push(fila)
    return { fila }
  }

  comoCliente(): SupabaseClient {
    return this as unknown as SupabaseClient
  }
}
