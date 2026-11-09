import { assertEquals } from "jsr:@std/assert@1"
import {
  aLaHora,
  esLunes,
  formatoFecha,
  formatoLocal,
  horasEntre,
  hoy,
  inicioDelDia,
  semanaIso,
  sumarDias,
  sumarHoras,
} from "../_shared/tiempo.ts"

Deno.test("hoy usa la zona America/Bogota y no UTC", () => {
  assertEquals(hoy(new Date("2026-11-06T03:00:00Z")), "2026-11-05")
  assertEquals(hoy(new Date("2026-11-06T05:00:00Z")), "2026-11-06")
  assertEquals(hoy(new Date("2026-11-06T04:59:59Z")), "2026-11-05")
})

Deno.test("formatoLocal convierte a hora de Bogotá con ceros a la izquierda", () => {
  assertEquals(formatoLocal("2026-11-06T14:30:00Z"), "2026-11-06 09:30")
  assertEquals(formatoLocal("2026-11-06T05:00:00Z"), "2026-11-06 00:00")
})

Deno.test("formatoFecha da dd/mm/aaaa y guion cuando no hay fecha", () => {
  assertEquals(formatoFecha("2026-03-09"), "09/03/2026")
  assertEquals(formatoFecha("2026-03-09T10:00:00+00:00"), "09/03/2026")
  assertEquals(formatoFecha(null), "-")
  assertEquals(formatoFecha(undefined), "-")
})

Deno.test("esLunes se evalúa con el día local", () => {
  assertEquals(esLunes(new Date("2026-11-09T14:00:00Z")), true)
  assertEquals(esLunes(new Date("2026-11-10T03:00:00Z")), true, "lunes 22:00 en Bogotá aunque ya sea martes en UTC")
  assertEquals(esLunes(new Date("2026-11-09T03:00:00Z")), false, "domingo 22:00 en Bogotá aunque ya sea lunes en UTC")
  assertEquals(esLunes(new Date("2026-11-06T14:00:00Z")), false)
})

Deno.test("semanaIso sigue el estándar ISO 8601", () => {
  assertEquals(semanaIso("2026-01-01"), { anio: 2026, semana: 1 })
  assertEquals(semanaIso("2026-11-09"), { anio: 2026, semana: 46 })
  assertEquals(semanaIso("2024-12-30"), { anio: 2025, semana: 1 })
  assertEquals(semanaIso("2021-01-03"), { anio: 2020, semana: 53 })
  assertEquals(semanaIso("2026-12-31"), { anio: 2026, semana: 53 })
})

Deno.test("aLaHora devuelve la hora de envío del día o ahora si ya pasó", () => {
  const manana = new Date("2026-11-06T11:00:00Z")
  assertEquals(aLaHora("08:00", manana).toISOString(), "2026-11-06T13:00:00.000Z")
  const tarde = new Date("2026-11-06T20:00:00Z")
  assertEquals(aLaHora("08:00", tarde).toISOString(), tarde.toISOString())
})

Deno.test("aLaHora con hora vacía o medianoche no se adelanta al futuro", () => {
  const ahora = new Date("2026-11-06T15:00:00Z")
  assertEquals(aLaHora("", ahora).toISOString(), ahora.toISOString())
  assertEquals(aLaHora("00:00", ahora).toISOString(), ahora.toISOString())
})

Deno.test("aLaHora usa el día de Bogotá cuando en UTC ya cambió de día", () => {
  const ahora = new Date("2026-11-07T02:00:00Z")
  assertEquals(hoy(ahora), "2026-11-06")
  assertEquals(aLaHora("23:30", ahora).toISOString(), "2026-11-07T04:30:00.000Z")
})

Deno.test("inicioDelDia es la medianoche de Bogotá", () => {
  assertEquals(inicioDelDia(new Date("2026-11-06T20:00:00Z")).toISOString(), "2026-11-06T05:00:00.000Z")
  assertEquals(inicioDelDia(new Date("2026-11-06T03:00:00Z")).toISOString(), "2026-11-05T05:00:00.000Z")
})

Deno.test("sumarDias cruza meses y años", () => {
  assertEquals(sumarDias("2026-11-06", 2), "2026-11-08")
  assertEquals(sumarDias("2026-12-31", 1), "2027-01-01")
  assertEquals(sumarDias("2026-03-01", -1), "2026-02-28")
  assertEquals(sumarDias("2028-02-28", 1), "2028-02-29")
})

Deno.test("sumarHoras y horasEntre son coherentes", () => {
  const base = new Date("2026-11-06T00:00:00Z")
  assertEquals(sumarHoras(base, 10 / 60).toISOString(), "2026-11-06T00:10:00.000Z")
  assertEquals(horasEntre(base, sumarHoras(base, 49.9)), 49)
  assertEquals(horasEntre(base, sumarHoras(base, 48)), 48)
})
