import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { escaparHtml, plantilla } from "../_shared/plantilla.ts"
import { crearEntorno } from "./entorno.ts"

Deno.test("escaparHtml neutraliza los caracteres peligrosos", () => {
  assertEquals(escaparHtml(`<script>alert("x")</script> & 'y'`), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#x27;y&#x27;")
  assertEquals(escaparHtml("texto normal"), "texto normal")
})

Deno.test("plantilla incluye título, saludo, intro, filas y botón con la URL de la app", async () => {
  crearEntorno()
  const html = await plantilla({
    titulo: "BL-001 está bloqueado",
    saludo: "Hola,",
    intro: "Se bloqueó un ítem",
    filas: [["Motivo", "Falta API"], ["Responsable", "Luis"]],
    cierre: "Gracias",
  })
  assertStringIncludes(html, "PO COMMAND CENTER")
  assertStringIncludes(html, "BL-001 está bloqueado")
  assertStringIncludes(html, "Se bloqueó un ítem")
  assertStringIncludes(html, ">Motivo</td>")
  assertStringIncludes(html, ">Falta API</td>")
  assertStringIncludes(html, "Gracias")
  assertStringIncludes(html, 'href="https://app.test"')
  assertStringIncludes(html, "Abrir PO Command")
})

Deno.test("plantilla escapa HTML inyectado en título, intro, filas y cierre", async () => {
  crearEntorno()
  const html = await plantilla({
    titulo: "<img src=x onerror=alert(1)>",
    saludo: "<b>Hola</b>",
    intro: "<script>robar()</script>",
    filas: [["<i>clave</i>", `"><script>x</script>`]],
    cierre: "<a href=javascript:1>clic</a>",
  })
  assert(!html.includes("<script>"), "no debe quedar ningún script")
  assert(!html.includes("<img"), "no debe quedar la etiqueta img")
  assert(!html.includes("<a href=javascript"), "no debe quedar el enlace inyectado")
  assertStringIncludes(html, "&lt;img src=x onerror=alert(1)&gt;")
  assertStringIncludes(html, "&lt;i&gt;clave&lt;/i&gt;")
})

Deno.test("plantilla escapa también la URL configurada", async () => {
  crearEntorno({ config: [{ clave: "app_url", valor: 'https://x.test/"><script>1</script>' }] })
  const html = await plantilla({ titulo: "t", saludo: "s", intro: "i", filas: [] })
  assert(!html.includes("<script>"))
})

Deno.test("plantilla omite el párrafo de cierre y aplica el color indicado", async () => {
  crearEntorno()
  const sinCierre = await plantilla({ titulo: "t", saludo: "s", intro: "i", filas: [] })
  assert(!sinCierre.includes("margin:14px 0 0"))
  assertStringIncludes(sinCierre, "#0369A1")
  const rojo = await plantilla({ titulo: "t", saludo: "s", intro: "i", filas: [], color: "#B91C1C" })
  assertStringIncludes(rojo, "border-top:4px solid #B91C1C")
})

Deno.test("plantilla usa localhost como URL cuando no hay app_url configurada", async () => {
  crearEntorno({ config: [] })
  const html = await plantilla({ titulo: "t", saludo: "s", intro: "i", filas: [] })
  assertStringIncludes(html, 'href="http://localhost:5173"')
})
