import { invocarFuncion } from '../lib/supabase'

const correo = (accion, datos = {}) => invocarFuncion('correo', { accion, ...datos })

export const obtenerConfigCorreo = () => correo('estado')
export const guardarConfigCorreo = (valores) => correo('guardar', { valores })
export const probarConexionCorreo = () => correo('probar')
export const enviarCorreoPrueba = (destino) => correo('prueba', { destino })
export const cambiarModoEnvio = (dryRun) => correo('modo', { dry_run: dryRun })
