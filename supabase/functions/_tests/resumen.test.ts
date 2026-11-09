import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { avancePorCliente, resumenSemanalHtml } from "../_shared/resumen.ts"
import type { Item } from "../_shared/tipos.ts"
import { crearEntorno, item } from "./entorno.ts"

const AHORA = new Date("2026-11-09T14:00:00Z")
const comoItems = (...items: ReturnType<typeof item>[]): Item[] => items as unknown as Item[]

Deno.test("avancePorCliente cuenta cada estado y ordena por cliente", () => {
  const avance = avancePorCliente(
    comoItems(
      item({ cliente: "AFINIA", estado: "Terminado" }),
      item({ cliente: "AFINIA", estado: "Terminado, en etapa de pruebas" }),
      item({ cliente: "AFINIA", estado: "En curso" }),
      item({ cliente: "AFINIA", estado: "No iniciado" }),
      item({ cliente: "AFINIA", estado: "Suspendido" }),
      item({ cliente: "AIR-E", estado: "Terminado" }),
      item({ cliente: null, estado: "En curso" }),
    ),
  )
  assertEquals(avance.map((a) => a.cliente), ["AFINIA", "AIR-E", "Sin cliente"])
  assertEquals(avance[0], { cliente: "AFINIA", total: 5, terminados: 1, pruebas: 1, enCurso: 1, noIniciados: 1 })
  assertEquals(avance[2].enCurso, 1)
})

Deno.test("avancePorCliente de una lista vacía es vacío", () => {
  assertEquals(avancePorCliente([]), [])
})

Deno.test("el resumen semanal reúne avance, terminados, vencidos, reprogramaciones, bloqueos y próximos hitos", async () => {
  crearEntorno({
    v_item: [
      item({ id: 1, cliente: "AIR-E", estado: "Terminado", terminado_en: "2026-11-05" }),
      item({ id: 2, cliente: "AIR-E", estado: "Terminado", terminado_en: "2026-10-01" }),
      item({ id: 3, cliente: "AIR-E", estado: "En curso", fecha_compromiso: "2026-11-01" }),
      item({ id: 4, cliente: "AFINIA", estado: "No iniciado", fecha_compromiso: "2026-12-01" }),
    ],
    v_bloqueante_abierto: [{ id: 1, codigo: "BL-003", cliente: "AIR-E", motivo: "Falta API", abierto_en: "2026-11-01T00:00:00Z" }],
    nota: [
      { id: 1, tipo: "Reprogramación", fecha: "2026-11-08" },
      { id: 2, tipo: "Reprogramación", fecha: "2026-10-01" },
      { id: 3, tipo: "Seguimiento", fecha: "2026-11-08" },
    ],
    v_ceremonia: [
      { id: 1, tipo: "Demo", titulo: "Demo AIR-E", fecha_hora: "2026-11-10T14:00:00Z" },
      { id: 2, tipo: "Demo", titulo: "Demo vieja", fecha_hora: "2026-11-01T14:00:00Z" },
    ],
  })
  const html = await resumenSemanalHtml(AHORA)
  assertStringIncludes(html, "Avance AFINIA")
  assertStringIncludes(html, "0 terminados · 0 en pruebas · 0 en curso · 1 sin iniciar (de 1)")
  assertStringIncludes(html, "2 terminados · 0 en pruebas · 1 en curso · 0 sin iniciar (de 3)")
  assertStringIncludes(html, "Terminados en 7 días</td><td style='padding:6px 0;color:#0F172A;font-size:13px'>1<")
  assertStringIncludes(html, "Vencidos sin terminar</td><td style='padding:6px 0;color:#0F172A;font-size:13px'>1<")
  assertStringIncludes(html, "Reprogramaciones en 7 días</td><td style='padding:6px 0;color:#0F172A;font-size:13px'>1<")
  assertStringIncludes(html, "Bloqueantes abiertos</td><td style='padding:6px 0;color:#0F172A;font-size:13px'>1<")
  assertStringIncludes(html, "Bloqueo BL-003 · AIR-E")
  assertStringIncludes(html, "Falta API")
  assertStringIncludes(html, "Próximo: Demo")
  assertStringIncludes(html, "Demo AIR-E · 2026-11-10 09:00")
  assertEquals(html.includes("Demo vieja"), false)
})

Deno.test("el resumen semanal funciona con la base vacía", async () => {
  crearEntorno({ v_item: [], v_bloqueante_abierto: [], nota: [], v_ceremonia: [] })
  const html = await resumenSemanalHtml(AHORA)
  assertStringIncludes(html, "Resumen semanal del plan de trabajo")
  assertStringIncludes(html, "Bloqueantes abiertos")
})

Deno.test("el resumen muestra solo los 3 primeros bloqueos y las 3 próximas ceremonias", async () => {
  crearEntorno({
    v_item: [],
    v_bloqueante_abierto: [1, 2, 3, 4, 5].map((n) => ({ id: n, codigo: `BL-${n}`, cliente: "X", motivo: `m${n}`, abierto_en: "2026-11-01T00:00:00Z" })),
    nota: [],
    v_ceremonia: [1, 2, 3, 4, 5].map((n) => ({ id: n, tipo: "Demo", titulo: `D${n}`, fecha_hora: `2026-11-1${n}T14:00:00Z` })),
  })
  const html = await resumenSemanalHtml(AHORA)
  assertStringIncludes(html, "Bloqueo BL-3")
  assertEquals(html.includes("Bloqueo BL-4"), false)
  assertStringIncludes(html, "D3")
  assertEquals(html.includes(">D4<") || html.includes("D4 ·"), false)
})
