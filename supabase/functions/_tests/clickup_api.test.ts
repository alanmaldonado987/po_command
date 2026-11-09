import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1"
import { ClienteClickUp, ErrorClickUp, EVENTOS_WEBHOOK } from "../_shared/clickup_api.ts"

interface Llamada {
  url: string
  metodo: string
  cabeceras: Record<string, string>
  cuerpo: unknown
}

type Respuesta = Response | ((llamada: Llamada) => Response)

const json = (datos: unknown, estado = 200, cabeceras: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(datos), { status: estado, headers: cabeceras })

function crear(respuestas: Respuesta[], ahora = () => 1_000_000) {
  const llamadas: Llamada[] = []
  const esperas: number[] = []
  const fetchFalso = (entrada: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const llamada: Llamada = {
      url: String(entrada),
      metodo: init?.method ?? "GET",
      cabeceras: init?.headers as Record<string, string>,
      cuerpo: init?.body ? JSON.parse(String(init.body)) : undefined,
    }
    llamadas.push(llamada)
    const respuesta = respuestas.shift()
    if (!respuesta) throw new Error(`Sin respuesta preparada para ${llamada.metodo} ${llamada.url}`)
    return Promise.resolve(typeof respuesta === "function" ? respuesta(llamada) : respuesta)
  }
  const cliente = new ClienteClickUp("pk_secreto", {
    fetch: fetchFalso as typeof fetch,
    esperar: (ms) => {
      esperas.push(ms)
      return Promise.resolve()
    },
    ahora,
  })
  return { cliente, llamadas, esperas }
}

Deno.test("envía el token personal tal cual en Authorization y usa la API v2", async () => {
  const { cliente, llamadas } = crear([json({ user: { id: 5, username: "vero", email: "vero@ises.com.co" } })])
  const usuario = await cliente.usuario()
  assertEquals(usuario.id, 5)
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/user")
  assertEquals(llamadas[0].cabeceras.Authorization, "pk_secreto")
  assertEquals(llamadas[0].cabeceras["Content-Type"], "application/json")
})

Deno.test("equipos, espacios, carpetas y listas usan las rutas documentadas", async () => {
  const { cliente, llamadas } = crear([
    json({ teams: [{ id: "9", name: "Ises" }] }),
    json({ spaces: [] }),
    json({ folders: [] }),
    json({ lists: [] }),
    json({ id: "L1", name: "Lista", statuses: [{ status: "pendiente" }] }),
  ])
  await cliente.equipos()
  await cliente.espacios("9")
  await cliente.carpetas("S1")
  await cliente.listasSinCarpeta("S1")
  await cliente.lista("L1")
  assertEquals(
    llamadas.map((l) => l.url.replace("https://api.clickup.com/api/v2", "")),
    ["/team", "/team/9/space?archived=false", "/space/S1/folder?archived=false", "/space/S1/list?archived=false", "/list/L1"],
  )
})

Deno.test("traduce un error de ClickUp a ErrorClickUp con estado y código", async () => {
  const { cliente } = crear([json({ err: "Token invalid", ECODE: "OAUTH_025" }, 401)])
  const error = await assertRejects(() => cliente.usuario(), ErrorClickUp, "Token invalid")
  assertEquals(error.estado, 401)
  assertEquals(error.codigo, "OAUTH_025")
})

Deno.test("los errores 4xx son permanentes salvo 408 y 429; los 5xx se reintentan", () => {
  assertEquals(new ErrorClickUp("x", 400).esPermanente, true)
  assertEquals(new ErrorClickUp("x", 404).esPermanente, true)
  assertEquals(new ErrorClickUp("x", 408).esPermanente, false)
  assertEquals(new ErrorClickUp("x", 429).esPermanente, false)
  assertEquals(new ErrorClickUp("x", 500).esPermanente, false)
  assertEquals(new ErrorClickUp("x", 503).esPermanente, false)
})

Deno.test("un error sin cuerpo usa un mensaje genérico con el estado", async () => {
  const { cliente } = crear([new Response("", { status: 502 })])
  await assertRejects(() => cliente.usuario(), ErrorClickUp, "ClickUp respondió 502")
})

Deno.test("ante un 429 espera hasta el reinicio del límite y reintenta", async () => {
  const reinicio = String(1_000_000 / 1000 + 12)
  const { cliente, esperas } = crear(
    [json({ err: "Rate limit" }, 429, { "X-RateLimit-Reset": reinicio }), json({ user: { id: 1 } })],
    () => 1_000_000,
  )
  await cliente.usuario()
  assertEquals(esperas, [12_000])
})

Deno.test("sin cabecera de reinicio espera 5 segundos y acota la espera a un minuto", async () => {
  const { cliente, esperas } = crear([
    json({}, 429),
    json({}, 429, { "X-RateLimit-Reset": String(1_000_000 / 1000 + 600) }),
    json({ user: { id: 1 } }),
  ])
  await cliente.usuario()
  assertEquals(esperas, [5_000, 60_000])
})

Deno.test("tras tres reintentos con 429 falla con ErrorClickUp 429", async () => {
  const { cliente, llamadas, esperas } = crear([json({}, 429), json({}, 429), json({}, 429), json({ err: "Rate limit" }, 429)])
  const error = await assertRejects(() => cliente.usuario(), ErrorClickUp)
  assertEquals(error.estado, 429)
  assertEquals(llamadas.length, 4)
  assertEquals(esperas.length, 3)
})

Deno.test("tareasDeLista recorre las páginas hasta last_page y pide markdown", async () => {
  const { cliente, llamadas } = crear([
    json({ tasks: [{ id: "a" }, { id: "b" }], last_page: false }),
    json({ tasks: [{ id: "c" }], last_page: true }),
  ])
  const tareas = await cliente.tareasDeLista("L1")
  assertEquals(tareas.map((t) => t.id), ["a", "b", "c"])
  assert(llamadas[0].url.includes("/list/L1/task?page=0&archived=false&include_closed=true&include_markdown_description=true"))
  assert(llamadas[1].url.includes("page=1"))
})

Deno.test("tareasDeLista pide las archivadas y se detiene con una página vacía", async () => {
  const { cliente, llamadas } = crear([json({ tasks: [], last_page: false })])
  assertEquals(await cliente.tareasDeLista("L1", true), [])
  assert(llamadas[0].url.includes("archived=true"))
  assertEquals(llamadas.length, 1)
})

Deno.test("tarea pide la descripción en markdown", async () => {
  const { cliente, llamadas } = crear([json({ id: "T1" })])
  await cliente.tarea("T1")
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/task/T1?include_markdown_description=true")
})

Deno.test("crearTarea hace POST a la lista con el cuerpo en JSON", async () => {
  const { cliente, llamadas } = crear([json({ id: "T1", date_updated: "1" })])
  await cliente.crearTarea("L9", { name: "Nueva", assignees: [3] })
  assertEquals(llamadas[0].metodo, "POST")
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/list/L9/task")
  assertEquals(llamadas[0].cuerpo, { name: "Nueva", assignees: [3] })
})

Deno.test("actualizarTarea hace PUT a la tarea", async () => {
  const { cliente, llamadas } = crear([json({ id: "T1" })])
  await cliente.actualizarTarea("T1", { archived: true })
  assertEquals(llamadas[0].metodo, "PUT")
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/task/T1")
  assertEquals(llamadas[0].cuerpo, { archived: true })
})

Deno.test("las etiquetas se agregan y quitan codificando el nombre en la URL", async () => {
  const { cliente, llamadas } = crear([json({}), json({})])
  await cliente.agregarEtiqueta("T1", "Automatización")
  await cliente.quitarEtiqueta("T1", "a/b c")
  assertEquals(llamadas[0].metodo, "POST")
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/task/T1/tag/Automatizaci%C3%B3n")
  assertEquals(llamadas[1].metodo, "DELETE")
  assertEquals(llamadas[1].url, "https://api.clickup.com/api/v2/task/T1/tag/a%2Fb%20c")
})

Deno.test("crearWebhook envía el endpoint y los eventos de tarea y devuelve id y secreto", async () => {
  const { cliente, llamadas } = crear([json({ id: "wh-1", webhook: { id: "wh-1", secret: "s3cr3t" } })])
  const webhook = await cliente.crearWebhook("EQ1", "https://x.supabase.co/functions/v1/clickup-webhook")
  assertEquals(webhook, { id: "wh-1", secret: "s3cr3t" })
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/team/EQ1/webhook")
  assertEquals(llamadas[0].cuerpo, { endpoint: "https://x.supabase.co/functions/v1/clickup-webhook", events: EVENTOS_WEBHOOK })
  assert(EVENTOS_WEBHOOK.includes("taskDeleted") && EVENTOS_WEBHOOK.includes("taskCreated"))
  assert(EVENTOS_WEBHOOK.includes("taskPriorityUpdated"))
})

Deno.test("eliminarWebhook hace DELETE", async () => {
  const { cliente, llamadas } = crear([json({})])
  await cliente.eliminarWebhook("wh-1")
  assertEquals(llamadas[0].metodo, "DELETE")
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/webhook/wh-1")
})

Deno.test("moverTarea usa la API v3 con el movimiento nativo y el mapeo de estados", async () => {
  const { cliente, llamadas } = crear([json({})])
  await cliente.moverTarea("EQ-1", "T-9", "L-AN", [{ source_status: "s1", destination_status: "a1" }])
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v3/workspaces/EQ-1/tasks/T-9/home_list/L-AN")
  assertEquals(llamadas[0].metodo, "PUT")
  assertEquals(llamadas[0].cuerpo, {
    move_custom_fields: false,
    status_mappings: [{ source_status: "s1", destination_status: "a1" }],
  })
})

Deno.test("moverTarea sin estados que mapear no envía status_mappings y tolera una respuesta vacía", async () => {
  const { cliente, llamadas } = crear([new Response("", { status: 200 })])
  await cliente.moverTarea("EQ-1", "T-9", "L-AN", [])
  assertEquals(llamadas[0].cuerpo, { move_custom_fields: false })
})

Deno.test("comentarTarea publica un comentario sin notificar a todos", async () => {
  const { cliente, llamadas } = crear([json({ id: "c1" })])
  await cliente.comentarTarea("T-9", "Se movió")
  assertEquals(llamadas[0].url, "https://api.clickup.com/api/v2/task/T-9/comment")
  assertEquals(llamadas[0].cuerpo, { comment_text: "Se movió", notify_all: false })
})

Deno.test("los errores de la API v3 (message y code) se convierten en ErrorClickUp", async () => {
  const { cliente } = crear([json({ message: "Not allowed", code: "FORBIDDEN" }, 403)])
  const error = await assertRejects(() => cliente.moverTarea("EQ-1", "T-9", "L-AN", []), ErrorClickUp)
  assertEquals([error.message, error.estado, error.codigo], ["Not allowed", 403, "FORBIDDEN"])
})
