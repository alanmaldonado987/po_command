import { assertEquals } from "jsr:@std/assert@1"
import { BaseFalsa } from "./base_falsa.ts"

const base = () =>
  new BaseFalsa({
    t: [
      { id: 1, nombre: "a", n: 1, f: "2026-01-01T10:00:00+00:00", x: null },
      { id: 2, nombre: "b", n: 2, f: "2026-01-02T10:00:00Z", x: "z" },
      { id: 3, nombre: "c", n: 3, f: "2026-01-03T10:00:00Z", x: "z" },
    ],
  })

Deno.test("la base falsa filtra con eq, neq, gt, gte, lt, lte, in y not in", async () => {
  const b = base()
  const ids = async (consulta: PromiseLike<{ data: unknown }>) => ((await consulta).data as { id: number }[]).map((f) => f.id)
  assertEquals(await ids(b.from("t").select("*").eq("nombre", "b")), [2])
  assertEquals(await ids(b.from("t").select("*").neq("nombre", "b")), [1, 3])
  assertEquals(await ids(b.from("t").select("*").gt("n", 1)), [2, 3])
  assertEquals(await ids(b.from("t").select("*").gte("n", 2)), [2, 3])
  assertEquals(await ids(b.from("t").select("*").lt("n", 3)), [1, 2])
  assertEquals(await ids(b.from("t").select("*").lte("n", 2)), [1, 2])
  assertEquals(await ids(b.from("t").select("*").in("id", [1, 3])), [1, 3])
  assertEquals(await ids(b.from("t").select("*").not("nombre", "in", '("a","c")')), [2])
})

Deno.test("las fechas ISO se comparan como instantes aunque cambie el formato del desfase", async () => {
  const b = base()
  const { data } = await b.from("t").select("*").eq("f", "2026-01-01T10:00:00Z")
  assertEquals((data as unknown[]).length, 1)
})

Deno.test("single y maybeSingle distinguen cero, una y varias filas", async () => {
  const b = base()
  assertEquals((await b.from("t").select("*").eq("id", 1).single()).data, { id: 1, nombre: "a", n: 1, f: "2026-01-01T10:00:00+00:00", x: null })
  assertEquals((await b.from("t").select("*").eq("id", 9).maybeSingle()).data, null)
  assertEquals((await b.from("t").select("*").eq("id", 9).single()).error?.code, "PGRST116")
  assertEquals((await b.from("t").select("*").eq("x", "z").maybeSingle()).error?.code, "PGRST116")
})

Deno.test("order y limit ordenan y recortan", async () => {
  const b = base()
  const { data } = await b.from("t").select("*").order("n", { ascending: false }).limit(2)
  assertEquals((data as { id: number }[]).map((f) => f.id), [3, 2])
})

Deno.test("insert asigna ids, aplica valores por defecto y respeta la unicidad de clave_unica", async () => {
  const b = new BaseFalsa()
  const primera = await b.from("alerta_programada").insert({ clave_unica: "K", asunto: "a" }).select("id").single()
  assertEquals((primera.data as { id: number }).id, 1)
  assertEquals(b.filas("alerta_programada")[0].estado, "Pendiente")
  const repetida = await b.from("alerta_programada").insert({ clave_unica: "K" }).select("id").single()
  assertEquals(repetida.error?.code, "23505")
  const sinClave = await b.from("alerta_programada").insert({ asunto: "b" }).select("id").single()
  assertEquals((sinClave.data as { id: number }).id, 2)
})

Deno.test("update devuelve las filas afectadas y respeta los filtros", async () => {
  const b = base()
  const { data } = await b.from("t").update({ n: 99 }).eq("x", "z").select("id")
  assertEquals((data as unknown[]).length, 2)
  assertEquals(b.filas("t").map((f) => f.n), [1, 99, 99])
  const ninguna = await b.from("t").update({ n: 0 }).eq("id", 50).select("id")
  assertEquals(ninguna.data, [])
})

Deno.test("select con head y count solo cuenta", async () => {
  const b = base()
  const respuesta = await b.from("t").select("*", { count: "exact", head: true }).gte("n", 2)
  assertEquals(respuesta.count, 2)
  assertEquals(respuesta.data, null)
})

Deno.test("rpc registra la llamada y fallar simula errores por tabla y operación", async () => {
  const b = base()
  await b.rpc("registrar_auditoria", { p_entidad: "x" })
  assertEquals(b.rpcs, [{ nombre: "registrar_auditoria", argumentos: { p_entidad: "x" } }])
  b.fallar("t", "select", "roto")
  assertEquals((await b.from("t").select("*")).error?.message, "roto")
})
