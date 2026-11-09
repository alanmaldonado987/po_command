import { limpiar, normalizar as claveTexto } from '../texto'

const ALIAS = {
  actividad: {
    'multi familiares scr': 'Multifamiliares SCR',
    'multifamiliares scr': 'Multifamiliares SCR',
    'multi familiares cobro': 'Multifamiliares Cobro',
    'multifamiliares cobro': 'Multifamiliares Cobro',
    scr: 'SCR',
    cobro: 'Cobro',
    'gestion social': 'Gestión Social',
    persuasion: 'Persuasión',
    lecturas: 'Lecturas',
  },
  modulo: {
    ordenes: 'Órdenes',
    'estrategia/recomedacion': 'Estrategia/Recomendación',
    'estrategia/recomendacion': 'Estrategia/Recomendación',
    'administracion de personal': 'Administración de Personal',
    'diseno de informes dahsboard planeacion operativa': 'Diseño de Informes Dashboard Planeación Operativa',
    maestro_bd: 'Maestro BD',
    historicos: 'Históricos',
  },
  funcionalidad: {
    'novedades personal': 'Novedades de personal',
    'matriz de reocmendacion': 'Matriz de recomendación',
    'historicos mano de obra': 'Históricos mano de obra',
    completo: 'Completo',
  },
  fase: { desarrollo: 'Desarrollo', customizacion: 'Customización', cutomizacion: 'Customización' },
  alcance: { web: 'Web', mobile: 'Mobile', data: 'Data', automatizacion: 'Automatización', apk: 'APK' },
  estado: {
    terminado: 'Terminado',
    'terminado, en etapa de pruebas': 'Terminado, en etapa de pruebas',
    'en curso': 'En curso',
    suspendido: 'Suspendido',
    'no iniciado': 'No iniciado',
  },
  persona: { 'luis kendor': 'Luis Kendor Narvaez', 'por definir': '' },
  cliente: { 'air-e': 'AIR-E', electrohuila: 'ELECTROHUILA', acuacar: 'ACUACAR', afinia: 'AFINIA' },
}

export const clave = claveTexto

export function normalizarCampo(tipo, valor) {
  const texto = limpiar(valor)
  if (!texto || texto.toLowerCase() === 'none') return ''
  return ALIAS[tipo]?.[clave(texto)] ?? texto
}
