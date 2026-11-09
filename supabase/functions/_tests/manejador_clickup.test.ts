import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { ErrorClickUp } from "../_shared/clickup_api.ts"
import { manejador } from "../clickup/manejador.ts"
import { configClickUp, destino, entornoClickUp, filaCola, itemVinculable, tareaClickUp } from "./clickup_falso.ts"

type Datos = Record<string, unknown>

async function llamar(cuerpo: unknown): Promise<{ estado: number; datos: Datos }> {
  const respuesta = await manejador(
    new Request("http://localhost/functions/v1/clickup", { method: "POST", body: JSON.stringify(cuerpo) }),
  )
  return { estado: respuesta.status, datos: await respuesta.json() }
}

const sinConfigurar = () =>
  entornoClickUp({
    clickup_config: [configClickUp({ habilitado: false, token: "", equipo_id: null, equipo_nombre: "", webhook_id: null })],
  })

Deno.test("OPTIONS responde 200 y una acción desconocida, 400", async () => {
  entornoClickUp()
  const opciones = await manejador(new Request("http://localhost/", { method: "OPTIONS" }))
  assertEquals(opciones.status, 200)
  assertEquals(await llamar({ accion: "borrar" }), { estado: 400, datos: { error: "Acción desconocida: borrar" } })
})

Deno.test("estado nunca devuelve el token y refleja contadores, equipo y conexión", async () => {
  const entorno = entornoClickUp({
    clickup_cola: [filaCola({ id: 1 }), filaCola({ id: 2 }), filaCola({ id: 3, estado: "Fallida" }), filaCola({ id: 4, estado: "Procesada" })],
    clickup_config: [configClickUp({ webhook_id: "wh-1", webhook_secret: "s", ultimo_sync: "2026-03-01T10:00:00Z" })],
  })
  const { estado, datos } = await llamar({ accion: "estado" })
  assertEquals(estado, 200)
  assertEquals(datos, {
    habilitado: true,
    token_configurado: true,
    conectado: true,
    equipo: { id: "EQ-1", nombre: "Ises" },
    webhook_registrado: true,
    pendientes: 2,
    con_error: 1,
    ultimo_sync: "2026-03-01T10:00:00Z",
    mapeo_estados: configClickUp().mapeo_estados,
    tableros: [],
    sin_destino: 0,
  })
  assertEquals(JSON.stringify(datos).includes("pk_token"), false)
  assertEquals(entorno.cliente.llamadasDe("usuario").length, 1)
})

Deno.test("estado marca conectado=false si ClickUp rechaza el token y no consulta sin token", async () => {
  const rechazado = entornoClickUp()
  rechazado.cliente.fallar("usuario", new ErrorClickUp("Token invalid", 401))
  assertEquals((await llamar({ accion: "estado" })).datos.conectado, false)
  const vacio = sinConfigurar()
  const { datos } = await llamar({ accion: "estado" })
  assertEquals([datos.conectado, datos.token_configurado, datos.equipo, datos.webhook_registrado], [false, false, null, false])
  assertEquals(vacio.cliente.llamadas.length, 0)
})

Deno.test("guardar_config guarda token, equipo y habilita; el nombre del equipo se resuelve solo", async () => {
  const entorno = sinConfigurar()
  entorno.cliente.equiposActuales = [{ id: "EQ-9", name: "Ises SAS" }]
  const { estado, datos } = await llamar({ accion: "guardar_config", token: " pk_nuevo ", equipo_id: "EQ-9", habilitado: true })
  assertEquals(estado, 200)
  assertEquals(datos.habilitado, true)
  assertEquals(datos.equipo, { id: "EQ-9", nombre: "Ises SAS" })
  const guardada = entorno.base.filas("clickup_config")[0]
  assertEquals([guardada.token, guardada.equipo_id, guardada.habilitado], ["pk_nuevo", "EQ-9", true])
})

Deno.test("guardar_config acepta los valores anidados que envía la interfaz", async () => {
  const entorno = sinConfigurar()
  await llamar({ accion: "guardar_config", valores: { token: "pk_anidado" } })
  assertEquals(entorno.base.filas("clickup_config")[0].token, "pk_anidado")
})

Deno.test("guardar_config con token vacío conserva el guardado", async () => {
  const entorno = entornoClickUp()
  const { estado } = await llamar({ accion: "guardar_config", token: "   ", equipo_nombre: "ignorado" })
  assertEquals(estado, 200)
  assertEquals(entorno.base.filas("clickup_config")[0].token, "pk_token")
})

Deno.test("guardar_config no deja habilitar sin token o sin equipo", async () => {
  const entorno = sinConfigurar()
  const sinToken = await llamar({ accion: "guardar_config", habilitado: true })
  assertEquals(sinToken.estado, 400)
  assertStringIncludes(String(sinToken.datos.error), "guarda primero el token")
  const sinEquipo = await llamar({ accion: "guardar_config", token: "pk", habilitado: true })
  assertEquals(sinEquipo.estado, 400)
  assertEquals(entorno.base.filas("clickup_config")[0].habilitado, false)
  assertEquals(entorno.base.filas("clickup_config")[0].token, "")
})

Deno.test("guardar_config valida habilitado, equipo_id y el mapeo de estados", async () => {
  entornoClickUp()
  assertEquals((await llamar({ accion: "guardar_config", habilitado: "si" })).estado, 400)
  assertEquals((await llamar({ accion: "guardar_config", equipo_id: 5 })).estado, 400)
  assertEquals((await llamar({ accion: "guardar_config", mapeo_estados: "texto" })).estado, 400)
  assertEquals((await llamar({ accion: "guardar_config", mapeo_estados: ["a"] })).estado, 400)
  const estadoDesconocido = await llamar({ accion: "guardar_config", mapeo_estados: { Inventado: "x" } })
  assertEquals(estadoDesconocido.estado, 400)
  assertStringIncludes(String(estadoDesconocido.datos.error), "Estado desconocido")
  assertEquals((await llamar({ accion: "guardar_config", mapeo_estados: { "En curso": 5 } })).estado, 400)
})

Deno.test("guardar_config actualiza el mapeo de estados", async () => {
  const entorno = entornoClickUp()
  await llamar({ accion: "guardar_config", mapeo_estados: { "En curso": "doing", Terminado: "done" } })
  assertEquals(entorno.base.filas("clickup_config")[0].mapeo_estados, { "En curso": "doing", Terminado: "done" })
})

Deno.test("guardar_config puede quitar el equipo y deshabilitar", async () => {
  const entorno = entornoClickUp()
  const { datos } = await llamar({ accion: "guardar_config", equipo_id: null, habilitado: false })
  assertEquals([datos.equipo, datos.habilitado], [null, false])
  assertEquals(entorno.base.filas("clickup_config")[0].equipo_nombre, "")
})

Deno.test("probar devuelve usuario y equipos; sin token es 400", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.equiposActuales = [{ id: "EQ-1", name: "Ises" }, { id: "EQ-2", name: "Otro" }]
  const { datos } = await llamar({ accion: "probar" })
  assertEquals(datos, {
    ok: true,
    usuario: { id: 1, username: "vero", email: "vero@ises.com.co" },
    equipos: [{ id: "EQ-1", nombre: "Ises" }, { id: "EQ-2", nombre: "Otro" }],
  })
  sinConfigurar()
  const sinToken = await llamar({ accion: "probar" })
  assertEquals(sinToken.estado, 400)
  assertStringIncludes(String(sinToken.datos.error), "Falta el token")
})

Deno.test("probar traduce el error de ClickUp con una explicación", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.fallar("usuario", new ErrorClickUp("Token invalid", 401))
  const { estado, datos } = await llamar({ accion: "probar" })
  assertEquals(estado, 200)
  assertEquals(datos.ok, false)
  assertEquals(datos.detalle, "Token invalid")
  assertStringIncludes(String(datos.explicacion), "token personal")
})

Deno.test("jerarquia devuelve espacios, carpetas y listas con sus estados", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.espaciosPorEquipo["EQ-1"] = [{ id: "S1", name: "Innovación" }]
  entorno.cliente.carpetasPorEspacio.S1 = [
    { id: "F1", name: "Sprint Auto", lists: [{ id: "L1", name: "Sprint 1", statuses: [{ status: "pendiente" }, { status: "entregado" }] }] },
  ]
  entorno.cliente.listasPorEspacio.S1 = [{ id: "L2", name: "Ideas" }]
  entorno.cliente.detalleListas.L2 = { id: "L2", name: "Ideas", statuses: [{ status: "abierta" }] }
  const { datos } = await llamar({ accion: "jerarquia", equipo_id: "EQ-1" })
  assertEquals(datos, {
    espacios: [
      {
        id: "S1",
        nombre: "Innovación",
        carpetas: [{ id: "F1", nombre: "Sprint Auto", listas: [{ id: "L1", nombre: "Sprint 1", estados: ["pendiente", "entregado"] }] }],
        listas: [{ id: "L2", nombre: "Ideas", estados: ["abierta"] }],
      },
    ],
  })
  assertEquals(entorno.cliente.llamadasDe("lista").map((l) => l[0]), ["L2"])
})

Deno.test("jerarquia exige equipo_id", async () => {
  entornoClickUp()
  assertEquals((await llamar({ accion: "jerarquia" })).estado, 400)
})

Deno.test("registrar_webhook reemplaza el anterior, guarda id y secreto y no devuelve el secreto", async () => {
  Deno.env.set("SUPABASE_URL", "https://proy.supabase.co")
  const entorno = entornoClickUp({ clickup_config: [configClickUp({ webhook_id: "viejo", webhook_secret: "viejo-s" })] })
  const { estado, datos } = await llamar({ accion: "registrar_webhook" })
  assertEquals([estado, datos], [200, { webhook_id: "wh-1" }])
  assertEquals(entorno.cliente.llamadasDe("eliminarWebhook"), [["viejo"]])
  assertEquals(entorno.cliente.llamadasDe("crearWebhook"), [["EQ-1", "https://proy.supabase.co/functions/v1/clickup-webhook"]])
  const guardada = entorno.base.filas("clickup_config")[0]
  assertEquals([guardada.webhook_id, guardada.webhook_secret], ["wh-1", "secreto-webhook"])
})

Deno.test("registrar_webhook explica el fallo cuando el plan o el permiso no lo admiten", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.fallar("crearWebhook", new ErrorClickUp("Webhooks not available", 403))
  const { estado, datos } = await llamar({ accion: "registrar_webhook" })
  assertEquals(estado, 400)
  assertStringIncludes(String(datos.error), "Webhooks not available")
  assertStringIncludes(String(datos.error), "revisión periódica")
  assertEquals(entorno.base.filas("clickup_config")[0].webhook_id, null)
})

Deno.test("registrar_webhook exige token y equipo", async () => {
  sinConfigurar()
  assertEquals((await llamar({ accion: "registrar_webhook" })).estado, 400)
})

Deno.test("quitar_webhook lo elimina en ClickUp y limpia la configuración aunque falle el borrado remoto", async () => {
  const entorno = entornoClickUp({ clickup_config: [configClickUp({ webhook_id: "wh-1", webhook_secret: "s" })] })
  entorno.cliente.fallar("eliminarWebhook", new ErrorClickUp("Not found", 404))
  const { datos } = await llamar({ accion: "quitar_webhook" })
  assertEquals(datos.webhook_registrado, false)
  const guardada = entorno.base.filas("clickup_config")[0]
  assertEquals([guardada.webhook_id, guardada.webhook_secret], [null, ""])
})

Deno.test("sincronizar procesa la cola y devuelve el resumen", async () => {
  const entorno = entornoClickUp({ clickup_cola: [filaCola()], v_item: [itemVinculable()], item: [itemVinculable()] })
  assertEquals((await llamar({ accion: "sincronizar" })).datos, { procesadas: 1, errores: 0 })
  assertEquals(entorno.cliente.llamadasDe("crearTarea").length, 1)
})

Deno.test("reconciliar devuelve los contadores", async () => {
  const entorno = entornoClickUp()
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A" })] }
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = () => ({ resultado: "creado" })
  assertEquals((await llamar({ accion: "reconciliar" })).datos, { creadas: 1, actualizadas: 0, archivadas: 0 })
})

Deno.test("importar_existentes valida la entrada y devuelve las importadas", async () => {
  const entorno = entornoClickUp({ clickup_destino: [destino({ lista_id: "L-1" })] })
  entorno.cliente.tareasPorLista = { "L-1": [tareaClickUp({ id: "A" }), tareaClickUp({ id: "B" })] }
  entorno.base.manejadoresRpc.aplicar_cambio_clickup = () => ({ resultado: "creado" })
  assertEquals((await llamar({ accion: "importar_existentes" })).estado, 400)
  assertEquals((await llamar({ accion: "importar_existentes", lista_id: "L-1", cliente_id: "uno" })).estado, 400)
  assertEquals((await llamar({ accion: "importar_existentes", lista_id: "L-1" })).datos, { importadas: 2 })
  const sinDestino = await llamar({ accion: "importar_existentes", lista_id: "OTRA" })
  assertEquals(sinDestino.estado, 400)
  assertStringIncludes(String(sinDestino.datos.error), "Elige el cliente")
})

Deno.test("encolar_sin_vincular devuelve cuántos ítems se encolaron", async () => {
  const entorno = entornoClickUp()
  entorno.base.manejadoresRpc.encolar_sin_vincular_clickup = () => 7
  assertEquals((await llamar({ accion: "encolar_sin_vincular" })).datos, { encolados: 7 })
  assert(entorno.base.rpcs.some((r) => r.nombre === "encolar_sin_vincular_clickup"))
})
