import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { manejador } from "../correo/manejador.ts"
import { crearEntorno, smtp } from "./entorno.ts"

async function llamar(cuerpo: unknown): Promise<{ estado: number; datos: Record<string, unknown> }> {
  const respuesta = await manejador(
    new Request("http://localhost/functions/v1/correo", { method: "POST", body: JSON.stringify(cuerpo) }),
  )
  return { estado: respuesta.status, datos: await respuesta.json() }
}

const valoresValidos = {
  host: "smtp.office365.com",
  puerto: 587,
  seguridad: "starttls",
  usuario: "vero@ises.com.co",
  remitente: "vero@ises.com.co",
  nombre_remitente: "PO Command Center",
}

Deno.test("OPTIONS responde 200 con CORS", async () => {
  crearEntorno()
  const respuesta = await manejador(new Request("http://localhost/", { method: "OPTIONS" }))
  assertEquals(respuesta.status, 200)
  assertEquals(respuesta.headers.get("Access-Control-Allow-Origin"), "*")
})

Deno.test("una acción desconocida devuelve 400", async () => {
  crearEntorno()
  const { estado, datos } = await llamar({ accion: "borrar" })
  assertEquals(estado, 400)
  assertEquals(datos, { error: "Acción desconocida: borrar" })
})

Deno.test("estado nunca devuelve la contraseña y marca que está guardada", async () => {
  crearEntorno({ smtp_config: [smtp({ password: "super-secreta" })] })
  const { estado, datos } = await llamar({ accion: "estado" })
  assertEquals(estado, 200)
  assertEquals("password" in datos, false)
  assertEquals(datos.password_guardada, true)
  assertEquals(datos.configurado, true)
  assertEquals(datos.dry_run, true)
  assertEquals(JSON.stringify(datos).includes("super-secreta"), false)
})

Deno.test("estado con la contraseña vacía indica que falta configurar", async () => {
  crearEntorno({ smtp_config: [smtp({ password: "" })] })
  const { datos } = await llamar({ accion: "estado" })
  assertEquals(datos.password_guardada, false)
  assertEquals(datos.configurado, false)
})

Deno.test("guardar actualiza la configuración, recorta espacios y conserva la contraseña si no llega una nueva", async () => {
  const { base } = crearEntorno({ smtp_config: [smtp({ password: "anterior" })] })
  const { estado, datos } = await llamar({
    accion: "guardar",
    valores: { ...valoresValidos, host: "  smtp.gmail.com ", puerto: "465", seguridad: "ssl", usuario: " yo@gmail.com ", remitente: "" },
  })
  assertEquals(estado, 200)
  const fila = base.filas("smtp_config")[0]
  assertEquals(fila.host, "smtp.gmail.com")
  assertEquals(fila.puerto, 465)
  assertEquals(fila.seguridad, "ssl")
  assertEquals(fila.usuario, "yo@gmail.com")
  assertEquals(fila.remitente, "yo@gmail.com")
  assertEquals(fila.password, "anterior")
  assertEquals("password" in datos, false)
})

Deno.test("guardar con una contraseña nueva la reemplaza sin devolverla", async () => {
  const { base } = crearEntorno()
  const { datos } = await llamar({ accion: "guardar", valores: { ...valoresValidos, password: "nueva-clave" } })
  assertEquals(base.filas("smtp_config")[0].password, "nueva-clave")
  assertEquals(JSON.stringify(datos).includes("nueva-clave"), false)
})

Deno.test("guardar rechaza seguridades no válidas", async () => {
  const { base } = crearEntorno()
  for (const seguridad of ["tls", "", undefined, "SSL"]) {
    const { estado, datos } = await llamar({ accion: "guardar", valores: { ...valoresValidos, seguridad } })
    assertEquals(estado, 400, `seguridad ${String(seguridad)}`)
    assertEquals(datos, { error: "Seguridad de conexión no válida" })
  }
  assertEquals(base.filas("smtp_config")[0].host, "smtp.test")
})

Deno.test("guardar rechaza puertos fuera de rango o no enteros", async () => {
  crearEntorno()
  for (const puerto of [0, -1, 65536, 25.5, "abc", "", null, undefined]) {
    const { estado, datos } = await llamar({ accion: "guardar", valores: { ...valoresValidos, puerto } })
    assertEquals(estado, 400, `puerto ${String(puerto)}`)
    assertEquals(datos, { error: "Puerto no válido" })
  }
})

Deno.test("guardar acepta los puertos límite 1 y 65535", async () => {
  crearEntorno()
  assertEquals((await llamar({ accion: "guardar", valores: { ...valoresValidos, puerto: 1 } })).estado, 200)
  assertEquals((await llamar({ accion: "guardar", valores: { ...valoresValidos, puerto: 65535 } })).estado, 200)
})

Deno.test("guardar exige el servidor y los valores", async () => {
  const { base } = crearEntorno()
  assertEquals((await llamar({ accion: "guardar" })).estado, 400)
  assertEquals((await llamar({ accion: "guardar", valores: "x" })).estado, 400)
  const sinHost = await llamar({ accion: "guardar", valores: { ...valoresValidos, host: "   " } })
  assertEquals(sinHost.estado, 400)
  assertEquals(sinHost.datos, { error: "El servidor SMTP es obligatorio" })
  assertEquals(base.filas("smtp_config")[0].host, "smtp.test")
})

Deno.test("guardar no escribe la cadena 'undefined' cuando faltan campos opcionales", async () => {
  const { base } = crearEntorno()
  await llamar({ accion: "guardar", valores: { host: "smtp.x.com", puerto: 587, seguridad: "none" } })
  const fila = base.filas("smtp_config")[0]
  assertEquals(fila.usuario, "")
  assertEquals(fila.remitente, "")
  assertEquals(fila.nombre_remitente, "")
})

Deno.test("probar devuelve ok sin explicación cuando la conexión funciona", async () => {
  crearEntorno()
  const { datos } = await llamar({ accion: "probar" })
  assertEquals(datos.ok, true)
  assertEquals("explicacion" in datos, false)
})

Deno.test("probar con un error del servidor agrega la explicación para el usuario", async () => {
  const { transporte } = crearEntorno()
  transporte.error = new Error("535 5.7.139 SmtpClientAuthentication is disabled")
  const { datos } = await llamar({ accion: "probar" })
  assertEquals(datos.ok, false)
  assertStringIncludes(String(datos.explicacion), "SMTP AUTH")
  assertStringIncludes(String(datos.detalle), "535")
})

Deno.test("prueba rechaza correos de destino no válidos y no envía nada", async () => {
  const { transporte } = crearEntorno()
  for (const destino of ["", "sin-arroba", undefined, null, 123]) {
    const { estado, datos } = await llamar({ accion: "prueba", destino })
    assertEquals(estado, 400, `destino ${String(destino)}`)
    assertEquals(datos, { error: "El correo de destino no es válido" })
  }
  assertEquals(transporte.enviados.length, 0)
})

Deno.test("prueba envía un correo real aunque esté en simulación", async () => {
  const { transporte } = crearEntorno()
  const { datos } = await llamar({ accion: "prueba", destino: "yo@ises.com.co" })
  assertEquals(datos.ok, true)
  assertEquals(transporte.enviados.length, 1)
  assertEquals(transporte.enviados[0].to, ["yo@ises.com.co"])
  assertEquals(transporte.enviados[0].subject, "[Prueba] PO Command Center")
})

Deno.test("prueba fallida devuelve explicación", async () => {
  const { transporte } = crearEntorno()
  transporte.error = new Error("connect ETIMEDOUT")
  const { datos } = await llamar({ accion: "prueba", destino: "yo@ises.com.co" })
  assertEquals(datos.ok, false)
  assertStringIncludes(String(datos.explicacion), "No hay conexión")
})

Deno.test("modo exige un valor booleano", async () => {
  const { base } = crearEntorno()
  for (const dry_run of ["false", 0, null, undefined]) {
    assertEquals((await llamar({ accion: "modo", dry_run })).estado, 400, `dry_run ${String(dry_run)}`)
  }
  assertEquals(base.filas("smtp_config")[0].dry_run, true)
})

Deno.test("no se puede activar el envío real sin el SMTP configurado", async () => {
  const { base } = crearEntorno({ smtp_config: [smtp({ password: "" })] })
  const { estado, datos } = await llamar({ accion: "modo", dry_run: false })
  assertEquals(estado, 400)
  assertEquals(datos, { error: "Configura el servidor SMTP antes de activar el envío real" })
  assertEquals(base.filas("smtp_config")[0].dry_run, true)
  assertEquals(base.rpcs.length, 0)
})

Deno.test("activar el envío real lo guarda, audita y devuelve el estado", async () => {
  const { base } = crearEntorno()
  const { datos } = await llamar({ accion: "modo", dry_run: false })
  assertEquals(datos.dry_run, false)
  assertEquals(base.filas("smtp_config")[0].dry_run, false)
  assertEquals(base.rpcs, [
    {
      nombre: "registrar_auditoria",
      argumentos: {
        p_entidad: "correo",
        p_entidad_id: null,
        p_accion: "activar",
        p_detalle: "Envío real activado con smtp.test (cuenta@ises.com.co)",
      },
    },
  ])
})

Deno.test("volver a simulación se permite aunque el SMTP no esté configurado y se audita", async () => {
  const { base } = crearEntorno({ smtp_config: [smtp({ dry_run: false, password: "" })] })
  const { datos } = await llamar({ accion: "modo", dry_run: true })
  assertEquals(datos.dry_run, true)
  assertEquals(base.filas("smtp_config")[0].dry_run, true)
  const [auditoria] = base.rpcs
  assert((auditoria.argumentos as { p_accion: string }).p_accion === "desactivar")
})
