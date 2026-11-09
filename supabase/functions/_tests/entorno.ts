import { usarAutorizador } from "../_shared/autorizacion.ts"
import { usarTransporte } from "../_shared/correo.ts"
import { usarCliente } from "../_shared/supabase.ts"
import { BaseFalsa, type Fila } from "./base_falsa.ts"

usarAutorizador(() => Promise.resolve(true))

export const PO = { nombre: "Verónica Rodríguez", correo: "po@ises.com.co" }

export class TransporteFalso {
  enviados: Record<string, unknown>[] = []
  verificaciones = 0
  error: Error | null = null

  verify(): Promise<unknown> {
    this.verificaciones += 1
    return this.error ? Promise.reject(this.error) : Promise.resolve(true)
  }

  sendMail(mensaje: Record<string, unknown>): Promise<unknown> {
    if (this.error) return Promise.reject(this.error)
    this.enviados.push(mensaje)
    return Promise.resolve({ accepted: mensaje.to })
  }
}

let contador = 0

export const persona = (extra: Fila = {}): Fila => {
  contador += 1
  return {
    id: contador,
    nombre: `Persona ${contador}`,
    correo: `persona${contador}@ises.com.co`,
    tipo: "equipo",
    rol: "Developer",
    recibe: [],
    activo: true,
    cliente_ids: [],
    ...extra,
  }
}

export const item = (extra: Fila = {}): Fila => {
  contador += 1
  return {
    id: contador,
    codigo: `BL-${String(contador).padStart(3, "0")}`,
    titulo: "Torre de Control · completo",
    funcionalidad: "Completo",
    estado: "En curso",
    bloqueado: false,
    motivo_bloqueo: "",
    cliente_id: 1,
    cliente: "AIR-E",
    actividad: "SCR",
    modulo: "Torre de Control",
    fase: "Desarrollo",
    alcance: "Web",
    responsable_id: null,
    responsable: null,
    fecha_compromiso: null,
    plan_pruebas_fin: null,
    atraso_dias: 0,
    terminado_en: null,
    ...extra,
  }
}

export const regla = (codigo: string, extra: Fila = {}): Fila => ({
  id: ++contador,
  codigo,
  nombre: codigo,
  categoria: "Bloqueantes",
  destinatarios: ["responsable", "po"],
  parametro: 0,
  hora_envio: "08:00",
  activa: true,
  ...extra,
})

export const smtp = (extra: Fila = {}): Fila => ({
  id: true,
  host: "smtp.test",
  puerto: 587,
  seguridad: "starttls",
  usuario: "cuenta@ises.com.co",
  password: "secreto",
  remitente: "cuenta@ises.com.co",
  nombre_remitente: "PO Command Center",
  dry_run: true,
  ...extra,
})

export function crearEntorno(datos: Record<string, Fila[]> = {}) {
  const base = new BaseFalsa({
    config: [
      { clave: "po_nombre", valor: PO.nombre },
      { clave: "po_correo", valor: PO.correo },
      { clave: "app_url", valor: "https://app.test" },
    ],
    smtp_config: [smtp()],
    ...datos,
  })
  const transporte = new TransporteFalso()
  usarCliente(base.comoCliente())
  usarTransporte(() => transporte)
  return { base, transporte }
}

export const ids = (filas: Fila[]): unknown[] => filas.map((fila) => fila.id)
