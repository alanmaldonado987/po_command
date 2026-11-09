import { invocarFuncion } from '../lib/supabase'

export const obtenerEstadoIa = () => invocarFuncion('ia', { accion: 'estado' })

export const redactarConModelo = ({ pregunta, borrador, historial }) =>
  invocarFuncion('ia', { accion: 'redactar', pregunta, borrador, historial })
