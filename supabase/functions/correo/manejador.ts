import {
  type ConfigSmtp,
  enviarCorreo,
  explicarError,
  obtenerConfigSmtp,
  probarConexion,
  smtpConfigurado,
} from "../_shared/correo.ts"
import { correoValido } from "../_shared/destinatarios.ts"
import { plantilla } from "../_shared/plantilla.ts"
import { ErrorSolicitud, exigir, manejar } from "../_shared/respuesta.ts"
import { admin, consultar } from "../_shared/supabase.ts"

type Cuerpo = Record<string, unknown>

const SEGURIDADES = ["starttls", "ssl", "none"]
const texto = (valor: unknown): string => String(valor ?? "").trim()

async function estado() {
  const config = await obtenerConfigSmtp()
  const { password: _omitida, ...publica } = config
  return { ...publica, password_guardada: Boolean(config.password), configurado: smtpConfigurado(config) }
}

async function guardar({ valores }: Cuerpo) {
  exigir(valores && typeof valores === "object", "Faltan los valores de configuración")
  const { host, puerto, seguridad, usuario, remitente, nombre_remitente, password } = valores as Record<string, unknown>
  exigir(SEGURIDADES.includes(String(seguridad)), "Seguridad de conexión no válida")
  const puertoNumerico = Number(puerto)
  exigir(Number.isInteger(puertoNumerico) && puertoNumerico >= 1 && puertoNumerico <= 65535, "Puerto no válido")
  exigir(texto(host), "El servidor SMTP es obligatorio")

  const cambios: Partial<ConfigSmtp> = {
    host: texto(host),
    puerto: puertoNumerico,
    seguridad: seguridad as ConfigSmtp["seguridad"],
    usuario: texto(usuario),
    remitente: texto(remitente) || texto(usuario),
    nombre_remitente: texto(nombre_remitente),
  }
  if (password) cambios.password = String(password)
  await consultar(admin.from("smtp_config").update(cambios).eq("id", true))
  return estado()
}

async function probar() {
  const { ok, detalle } = await probarConexion()
  return ok ? { ok, detalle } : { ok, detalle, explicacion: explicarError(detalle) }
}

async function enviarPrueba({ destino }: Cuerpo) {
  if (!correoValido(destino as string)) throw new ErrorSolicitud("El correo de destino no es válido")
  const cuerpo = await plantilla({
    titulo: "Correo de prueba",
    saludo: "Hola,",
    intro: "Si lees esto, la configuración de correo funciona y ya puedes activar el envío real de alertas.",
    filas: [],
  })
  const { ok, detalle } = await enviarCorreo([destino as string], "[Prueba] PO Command Center", cuerpo, true)
  return ok ? { ok, detalle } : { ok, detalle, explicacion: explicarError(detalle) }
}

async function cambiarModo({ dry_run }: Cuerpo) {
  exigir(typeof dry_run === "boolean", "dry_run debe ser verdadero o falso")
  const config = await obtenerConfigSmtp()
  exigir(dry_run || smtpConfigurado(config), "Configura el servidor SMTP antes de activar el envío real")
  await consultar(admin.from("smtp_config").update({ dry_run }).eq("id", true))
  await consultar(
    admin.rpc("registrar_auditoria", {
      p_entidad: "correo",
      p_entidad_id: null,
      p_accion: dry_run ? "desactivar" : "activar",
      p_detalle: dry_run ? "Vuelta a modo simulación" : `Envío real activado con ${config.host} (${config.usuario})`,
    }),
  )
  return estado()
}

const ACCIONES: Record<string, (cuerpo: Cuerpo) => Promise<unknown>> = {
  estado,
  guardar,
  probar,
  prueba: enviarPrueba,
  modo: cambiarModo,
}

export const manejador = manejar((cuerpo) => {
  const accion = ACCIONES[cuerpo.accion as string]
  if (!accion) throw new ErrorSolicitud(`Acción desconocida: ${cuerpo.accion}`)
  return accion(cuerpo)
})
