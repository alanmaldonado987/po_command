import { assertEquals } from "jsr:@std/assert@1"
import { correoValido, resolver } from "../_shared/destinatarios.ts"
import { crearEntorno, persona, PO } from "./entorno.ts"

const correos = (lista: { correo: string }[]): string[] => lista.map((d) => d.correo)

Deno.test("correoValido acepta correos bien formados y rechaza el resto", () => {
  assertEquals(correoValido("a@ises.com.co"), true)
  assertEquals(correoValido("  a@ises.com.co  "), true)
  assertEquals(correoValido("sin-arroba"), false)
  assertEquals(correoValido("a@b"), false)
  assertEquals(correoValido(""), false)
  assertEquals(correoValido(null), false)
  assertEquals(correoValido(undefined), false)
})

Deno.test("rol po devuelve al Product Owner con su nombre", async () => {
  crearEntorno()
  assertEquals(await resolver(["po"], "Bloqueantes"), [{ nombre: PO.nombre, correo: PO.correo, rol: "Product Owner" }])
})

Deno.test("rol po sin correo configurado no agrega a nadie", async () => {
  crearEntorno({ config: [{ clave: "po_nombre", valor: "PO" }] })
  assertEquals(await resolver(["po"], "Bloqueantes"), [])
})

Deno.test("rol responsable ignora la preferencia 'recibe' y usa el responsable del ítem", async () => {
  const luis = persona({ id: 90, correo: "luis@ises.com.co", recibe: ["Ceremonias"] })
  crearEntorno({ v_persona: [luis] })
  const r = await resolver(["responsable"], "Bloqueantes", { item: { responsable_id: 90 } })
  assertEquals(correos(r), ["luis@ises.com.co"])
  assertEquals(r[0].rol, "Responsable")
})

Deno.test("rol responsable sin responsable asignado o inactivo no agrega a nadie", async () => {
  const inactivo = persona({ id: 91, activo: false })
  crearEntorno({ v_persona: [inactivo] })
  assertEquals(await resolver(["responsable"], "Bloqueantes", { item: { responsable_id: null } }), [])
  assertEquals(await resolver(["responsable"], "Bloqueantes", { item: { responsable_id: 91 } }), [])
})

Deno.test("responsable sin correo válido redirige el aviso al PO indicando a quién sustituye", async () => {
  const sinCorreo = persona({ id: 92, nombre: "Dairo", correo: "" })
  crearEntorno({ v_persona: [sinCorreo] })
  const r = await resolver(["responsable"], "Bloqueantes", { item: { responsable_id: 92 } })
  assertEquals(r.length, 1)
  assertEquals(r[0].correo, PO.correo)
  assertEquals(r[0].nombre, `${PO.nombre} (en lugar de Dairo, sin correo)`)
})

Deno.test("rol equipo respeta 'recibe' y trata la lista vacía como 'recibe todo'", async () => {
  const todas = persona({ correo: "todas@ises.com.co", recibe: [] })
  const soloBloqueos = persona({ correo: "bloqueos@ises.com.co", recibe: ["Bloqueantes"] })
  const soloCeremonias = persona({ correo: "cer@ises.com.co", recibe: ["Ceremonias"] })
  const stakeholder = persona({ correo: "st@cliente.com", tipo: "stakeholder" })
  crearEntorno({ v_persona: [todas, soloBloqueos, soloCeremonias, stakeholder] })
  const r = await resolver(["equipo"], "Bloqueantes")
  assertEquals(correos(r).sort(), ["bloqueos@ises.com.co", "todas@ises.com.co"])
})

Deno.test("personas inactivas nunca reciben alertas", async () => {
  crearEntorno({ v_persona: [persona({ correo: "baja@ises.com.co", activo: false }), persona({ correo: "alta@ises.com.co" })] })
  assertEquals(correos(await resolver(["equipo"], "Bloqueantes")), ["alta@ises.com.co"])
})

Deno.test("stakeholders se filtran por el cliente del ítem", async () => {
  const deAireE = persona({ correo: "aire@cliente.com", tipo: "stakeholder", cliente_ids: [1] })
  const deOtro = persona({ correo: "otro@cliente.com", tipo: "stakeholder", cliente_ids: [2] })
  const sinClientes = persona({ correo: "libre@cliente.com", tipo: "stakeholder", cliente_ids: [] })
  crearEntorno({ v_persona: [deAireE, deOtro, sinClientes] })
  const porItem = await resolver(["stakeholders"], "Bloqueantes", { item: { cliente_id: 1 } })
  assertEquals(correos(porItem), ["aire@cliente.com"])
  const porCliente = await resolver(["stakeholders"], "Bloqueantes", { clienteId: 2 })
  assertEquals(correos(porCliente), ["otro@cliente.com"])
})

Deno.test("stakeholders sin cliente de contexto recibe a todos los stakeholders", async () => {
  crearEntorno({
    v_persona: [
      persona({ correo: "a@cliente.com", tipo: "stakeholder", cliente_ids: [1] }),
      persona({ correo: "b@cliente.com", tipo: "stakeholder", cliente_ids: [2] }),
    ],
  })
  assertEquals(correos(await resolver(["stakeholders"], "Resumen semanal")).sort(), ["a@cliente.com", "b@cliente.com"])
})

Deno.test("rol lider_tecnico encuentra por el texto del rol sin importar tildes ni mayúsculas", async () => {
  crearEntorno({
    v_persona: [
      persona({ correo: "lider@ises.com.co", rol: "Líder Técnico" }),
      persona({ correo: "lead@ises.com.co", rol: "Tech Lead" }),
      persona({ correo: "lider2@ises.com.co", rol: "lider tecnico" }),
      persona({ correo: "lider3@ises.com.co", rol: "Líder tecnico" }),
      persona({ correo: "dev@ises.com.co", rol: "Developer" }),
    ],
  })
  assertEquals(correos(await resolver(["lider_tecnico"], "Escalamientos")).sort(), [
    "lead@ises.com.co",
    "lider2@ises.com.co",
    "lider3@ises.com.co",
    "lider@ises.com.co",
  ])
})

Deno.test("audiencia equipo, stakeholders y todos", async () => {
  crearEntorno({
    v_persona: [
      persona({ correo: "dev@ises.com.co", tipo: "equipo" }),
      persona({ correo: "cliente@cliente.com", tipo: "stakeholder", cliente_ids: [1] }),
    ],
  })
  assertEquals(correos(await resolver(["audiencia"], "Ceremonias", { audiencia: "equipo" })), ["dev@ises.com.co"])
  assertEquals(correos(await resolver(["audiencia"], "Ceremonias", { audiencia: "stakeholders" })), ["cliente@cliente.com"])
  assertEquals(correos(await resolver(["audiencia"], "Ceremonias", { audiencia: "todos" })).sort(), [
    "cliente@cliente.com",
    "dev@ises.com.co",
  ])
  assertEquals(await resolver(["audiencia"], "Ceremonias", { audiencia: null }), [])
})

Deno.test("audiencia 'todos' no filtra stakeholders por cliente", async () => {
  crearEntorno({ v_persona: [persona({ correo: "x@cliente.com", tipo: "stakeholder", cliente_ids: [9] })] })
  const r = await resolver(["audiencia"], "Ceremonias", { audiencia: "todos", clienteId: 1 })
  assertEquals(correos(r), ["x@cliente.com"])
})

Deno.test("la lista final se deduplica por correo sin distinguir mayúsculas", async () => {
  crearEntorno({
    v_persona: [persona({ id: 70, correo: "Luis@ises.com.co", tipo: "equipo" })],
    config: [
      { clave: "po_nombre", valor: PO.nombre },
      { clave: "po_correo", valor: "luis@ISES.com.co" },
    ],
  })
  const r = await resolver(["po", "responsable", "equipo"], "Bloqueantes", { item: { responsable_id: 70 } })
  assertEquals(r.length, 1)
  assertEquals(r[0].rol, "Product Owner")
})

Deno.test("los espacios alrededor del correo se recortan", async () => {
  crearEntorno({ v_persona: [persona({ correo: "  dev@ises.com.co  " })] })
  assertEquals(correos(await resolver(["equipo"], "Bloqueantes")), ["dev@ises.com.co"])
})

Deno.test("roles desconocidos se ignoran", async () => {
  crearEntorno({ v_persona: [persona()] })
  assertEquals(await resolver(["inexistente"], "Bloqueantes"), [])
})
