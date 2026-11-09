import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'

const CARPETA_MIGRACIONES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations')
const CREAR_UNACCENT = 'create extension if not exists unaccent with schema extensions;'

const PREPARACION = `
  create schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, extensions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`

let instantanea

async function construirInstantanea() {
  const base = new PGlite({ extensions: { unaccent } })
  await base.exec(PREPARACION)
  await base.exec(CREAR_UNACCENT)
  const archivos = readdirSync(CARPETA_MIGRACIONES).filter((nombre) => nombre.endsWith('.sql')).sort()
  for (const archivo of archivos) {
    const sql = readFileSync(join(CARPETA_MIGRACIONES, archivo), 'utf8').replace(CREAR_UNACCENT, '')
    await base.exec(sql)
  }
  const volcado = await base.dumpDataDir('none')
  await base.close()
  return volcado
}

export async function crearBase() {
  instantanea ??= await construirInstantanea()
  const base = new PGlite({ loadDataDir: instantanea, extensions: { unaccent } })
  await base.waitReady
  return base
}

export const filas = async (base, sql, parametros = []) => (await base.query(sql, parametros)).rows

export async function unaFila(base, sql, parametros = []) {
  const [fila] = await filas(base, sql, parametros)
  return fila
}

export async function escalar(base, sql, parametros = []) {
  const fila = await unaFila(base, sql, parametros)
  return fila ? Object.values(fila)[0] : undefined
}

export async function fechaRelativa(base, dias) {
  return escalar(base, `select to_char(public.hoy() + $1::int, 'YYYY-MM-DD') as fecha`, [dias])
}

export async function guardarItem(base, datos, { id = null, nota = '', tipoNota = 'Seguimiento', autor = '' } = {}) {
  return escalar(base, 'select public.guardar_item($1::jsonb, $2, $3, $4, $5)', [
    JSON.stringify(datos),
    id,
    nota,
    tipoNota,
    autor,
  ])
}

export const ITEM_BASE = {
  cliente: 'AIR-E',
  actividad: 'SCR',
  modulo: 'Torre de Control',
  funcionalidad: 'Mapa de rutas',
  alcance: 'Web',
}

export async function insertarAlerta(base, { regla = 'BLOQUEO_NUEVO', entidad = 'item', entidadId = null, estado = 'Pendiente' } = {}) {
  return escalar(
    base,
    `insert into public.alerta_programada (regla_codigo, entidad, entidad_id, asunto, cuerpo_html, destinatarios, estado)
     values ($1, $2, $3, 'Asunto', '<p>Cuerpo</p>', array['destino@ises.com.co'], $4)
     returning id::int`,
    [regla, entidad, entidadId, estado],
  )
}

export async function crearCeremonia(base, datos = {}) {
  return escalar(
    base,
    `insert into public.ceremonia (tipo, titulo, fecha_hora, audiencia)
     values ($1, $2, now() + interval '1 day', $3) returning id::int`,
    [datos.tipo ?? 'Demo', datos.titulo ?? 'Demo mensual', datos.audiencia ?? 'equipo'],
  )
}

export async function comoRol(base, rol, accion) {
  await base.exec(`set role ${rol}`)
  try {
    return await accion()
  } finally {
    await base.exec('reset role')
  }
}
