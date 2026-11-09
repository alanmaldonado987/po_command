import { normalizar } from '../../../lib/texto'
import { atrasados } from './atrasados'
import { cargaEquipo } from './carga'
import { AYUDA } from './constantes'
import { escalamiento } from './escalamiento'
import { respuesta } from './formato'
import { persona } from './persona'
import { reprogramaciones } from './reprogramaciones'
import { resumen } from './resumen'
import { riesgos } from './riesgos'
import { unCliente } from './unCliente'
import { unItem } from './unItem'
import { vencimientos } from './vencimientos'

const ESCALAMIENTO = /escal|correo|redact|borrador/
const REPROGRAMACIONES = /reprogram|cambio de fecha|movi/
const ATRASADOS = /atras|retras|vencid/
const RIESGOS = /riesg|peligr|preocup|bloque/
const RESUMEN = /resumen|semanal|reporte|informe|stakeholder/
const CARGA = /carga|capacidad|sobrecarg|disponib|equipo/
const VENCIMIENTOS = /venc|vence|fecha|semana/

export async function responder(pregunta, datos) {
  const consulta = normalizar(pregunta)
  if (ESCALAMIENTO.test(consulta)) return escalamiento(pregunta, datos)
  const item = unItem(pregunta, datos)
  if (item) return item
  if (REPROGRAMACIONES.test(consulta)) return reprogramaciones(datos)
  if (ATRASADOS.test(consulta)) return atrasados(datos)
  if (RIESGOS.test(consulta)) return riesgos(datos)
  if (RESUMEN.test(consulta)) return resumen(datos)
  const cliente = unCliente(pregunta, datos)
  if (cliente) return cliente
  if (CARGA.test(consulta)) return cargaEquipo(datos)
  if (VENCIMIENTOS.test(consulta)) return vencimientos(datos)
  const alguien = persona(pregunta, datos)
  if (alguien) return alguien
  return respuesta(`No estoy seguro de qué necesitas. ${AYUDA}`)
}
