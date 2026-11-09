import { URL_API_FALSA } from '../../playwright.config.js'
import { actualizarFila, eliminarFila, ErrorApi, insertar } from './almacen.js'
import { crearSemilla } from './datosSemilla.js'
import { ALERTAS, CLICKUP, CORREO, IA } from './funciones.js'
import { aplicarFiltros, aplicarOrden, aplicarPaginacion, proyectar } from './postgrest.js'
import { RPC } from './rpc.js'
import { VISTAS } from './vistas.js'

export const USUARIO_PO = { email: 'po@ises.com.co', password: 'secreto-123', id: '11111111-1111-4111-8111-111111111111' }
export const USUARIO_SIN_CONFIRMAR = { email: 'pendiente@ises.com.co', password: 'secreto-123', id: '22222222-2222-4222-8222-222222222222' }

const CABECERAS_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,HEAD,OPTIONS',
  'access-control-expose-headers': 'content-range,content-type',
}

const CSS_ICONOS_SIN_FUENTE =
  '.material-symbols-rounded{display:inline-block!important;width:20px!important;height:20px!important;overflow:hidden!important;color:transparent!important}'

const base64Url = (objeto) => Buffer.from(JSON.stringify(objeto)).toString('base64url')

export function crearSesion(usuario = USUARIO_PO) {
  const expira = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600
  const accessToken = `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({ sub: usuario.id, email: usuario.email, role: 'authenticated', exp: expira })}.firma`
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 10 * 365 * 24 * 3600,
    expires_at: expira,
    refresh_token: 'refresco-falso',
    user: { id: usuario.id, aud: 'authenticated', role: 'authenticated', email: usuario.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  }
}

export const claveAlmacenSesion = () => `sb-${new URL(URL_API_FALSA).hostname.split('.')[0]}-auth-token`

const json = (cuerpo, estado = 200, cabeceras = {}) => ({
  status: estado,
  headers: { ...CABECERAS_CORS, 'content-type': 'application/json', ...cabeceras },
  body: cuerpo === undefined ? '' : JSON.stringify(cuerpo),
})

const errorPostgrest = (error) => json({ code: error.codigo ?? 'P0001', message: error.message, details: null, hint: null }, error.estado ?? 400)

export class FakeBackend {
  constructor() {
    this.reiniciar()
  }

  reiniciar() {
    this.estado = { ...crearSemilla(), fallas: {}, correosDePrueba: [] }
    this.peticiones = []
    this.violaciones = []
    this.fallosForzados = []
    this.retardoMs = 0
  }

  fallarConsulta(patron, { estado = 500, mensaje = 'Error interno simulado', metodos = null } = {}) {
    this.fallosForzados.push({ patron, estado, mensaje, metodos })
  }

  peticionesA(patron) {
    return this.peticiones.filter((p) => p.url.includes(patron))
  }

  async instalar(context) {
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (route) => {
      const esIconos = route.request().url().includes('Material+Symbols')
      return route.fulfill({ status: 200, headers: { ...CABECERAS_CORS, 'content-type': 'text/css' }, body: esIconos ? CSS_ICONOS_SIN_FUENTE : '' })
    })
    await context.route(/\.supabase\.(co|in)/, (route) => {
      this.violaciones.push(route.request().url())
      return route.abort('blockedbyclient')
    })
    await context.route((url) => url.href.startsWith(URL_API_FALSA), (route) => this.atender(route))
  }

  async atender(route) {
    const peticion = route.request()
    const url = new URL(peticion.url())
    if (peticion.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CABECERAS_CORS })
    this.peticiones.push({ metodo: peticion.method(), url: peticion.url(), cuerpo: this.leerCuerpo(peticion) })
    if (this.retardoMs) await new Promise((resolver) => setTimeout(resolver, this.retardoMs))

    const forzado = this.fallosForzados.find(
      ({ patron, metodos }) => url.pathname.includes(patron) && (!metodos || metodos.includes(peticion.method())),
    )
    if (forzado) {
      const esFuncion = url.pathname.startsWith('/functions/v1/')
      return route.fulfill(json(esFuncion ? { error: forzado.mensaje } : { message: forzado.mensaje, code: 'XX000' }, forzado.estado))
    }

    try {
      if (url.pathname.startsWith('/auth/v1/')) return await route.fulfill(this.autenticacion(peticion, url))
      if (url.pathname.startsWith('/rest/v1/rpc/')) return await route.fulfill(this.rpc(url, peticion))
      if (url.pathname.startsWith('/rest/v1/')) return await route.fulfill(this.rest(url, peticion))
      if (url.pathname.startsWith('/functions/v1/')) return await route.fulfill(this.funcion(url, peticion))
      return await route.fulfill(json({ message: 'Ruta no soportada por el fake' }, 404))
    } catch (error) {
      if (error instanceof ErrorApi) {
        const esFuncion = url.pathname.startsWith('/functions/v1/')
        return route.fulfill(esFuncion ? json({ error: error.message }, 400) : errorPostgrest(error))
      }
      throw error
    }
  }

  leerCuerpo(peticion) {
    try {
      return peticion.postDataJSON()
    } catch {
      return peticion.postData()
    }
  }

  autenticacion(peticion, url) {
    const ruta = url.pathname.replace('/auth/v1/', '')
    if (ruta === 'token') return this.iniciarSesion(url, this.leerCuerpo(peticion))
    if (ruta === 'logout') return { status: 204, headers: CABECERAS_CORS }
    if (ruta === 'user') return json(crearSesion().user)
    return json({ message: 'Ruta de auth no soportada' }, 404)
  }

  iniciarSesion(url, cuerpo) {
    if (url.searchParams.get('grant_type') === 'refresh_token') return json(crearSesion())
    const usuarios = [{ ...USUARIO_PO, confirmado: true }, { ...USUARIO_SIN_CONFIRMAR, confirmado: false }]
    const usuario = usuarios.find((u) => u.email === cuerpo.email && u.password === cuerpo.password)
    if (!usuario) return json({ code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400)
    if (!usuario.confirmado) return json({ code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400)
    return json(crearSesion(usuario))
  }

  filas(nombre) {
    if (VISTAS[nombre]) return VISTAS[nombre](this.estado)
    if (nombre === 'config') return Object.entries(this.estado.config).map(([clave, valor]) => ({ clave, valor }))
    if (!Array.isArray(this.estado[nombre])) throw new ErrorApi(`Relación inexistente: ${nombre}`, { estado: 404, codigo: '42P01' })
    return this.estado[nombre]
  }

  rest(url, peticion) {
    const nombre = url.pathname.replace('/rest/v1/', '')
    const metodo = peticion.method()
    const prefer = peticion.headers().prefer ?? ''
    const unico = (peticion.headers().accept ?? '').includes('vnd.pgrst.object')

    if (metodo === 'GET' || metodo === 'HEAD') return this.leer(nombre, url, prefer, unico, metodo === 'HEAD')
    if (nombre === 'config') return this.escribirConfig(peticion, metodo)
    if (metodo === 'POST') return this.insertar(nombre, peticion, prefer, unico)
    const afectadas = aplicarFiltros(this.filas(nombre), url.searchParams)
    if (metodo === 'PATCH') {
      const cambios = this.leerCuerpo(peticion)
      afectadas.forEach((fila) => actualizarFila(this.estado, nombre, fila, cambios))
      return this.devolver(afectadas, url, prefer, unico)
    }
    if (metodo === 'DELETE') {
      afectadas.forEach((fila) => eliminarFila(this.estado, nombre, fila))
      return { status: 204, headers: CABECERAS_CORS }
    }
    return json({ message: 'Método no soportado' }, 405)
  }

  leer(nombre, url, prefer, unico, soloCabeceras) {
    const filtradas = aplicarFiltros(this.filas(nombre), url.searchParams)
    const ordenadas = aplicarOrden(filtradas, url.searchParams)
    const visibles = proyectar(aplicarPaginacion(ordenadas, url.searchParams), url.searchParams)
    const rango = prefer.includes('count=exact') ? { 'content-range': `${filtradas.length ? `0-${filtradas.length - 1}` : '*'}/${filtradas.length}` } : {}
    if (soloCabeceras) return { status: 200, headers: { ...CABECERAS_CORS, ...rango } }
    return this.respuestaFilas(visibles, unico, rango)
  }

  respuestaFilas(filas, unico, cabeceras = {}) {
    if (!unico) return json(filas, 200, cabeceras)
    if (filas.length !== 1) {
      return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null }, 406)
    }
    return json(filas[0], 200, cabeceras)
  }

  devolver(filas, url, prefer, unico) {
    if (!prefer.includes('return=representation')) return { status: 204, headers: CABECERAS_CORS }
    return this.respuestaFilas(proyectar(filas, url.searchParams), unico)
  }

  insertar(nombre, peticion, prefer, unico) {
    const cuerpo = this.leerCuerpo(peticion)
    const creadas = (Array.isArray(cuerpo) ? cuerpo : [cuerpo]).map((datos) => insertar(this.estado, nombre, datos))
    if (!prefer.includes('return=representation')) return { status: 201, headers: CABECERAS_CORS }
    const respuesta = this.respuestaFilas(creadas, unico)
    return { ...respuesta, status: 201 }
  }

  escribirConfig(peticion, metodo) {
    if (metodo !== 'POST') return json({ message: 'Solo upsert soportado en config' }, 405)
    const cuerpo = this.leerCuerpo(peticion)
    ;(Array.isArray(cuerpo) ? cuerpo : [cuerpo]).forEach(({ clave, valor }) => { this.estado.config[clave] = valor })
    return { status: 201, headers: CABECERAS_CORS }
  }

  rpc(url, peticion) {
    const nombre = url.pathname.replace('/rest/v1/rpc/', '')
    const implementacion = RPC[nombre]
    if (!implementacion) return json({ message: `Función inexistente: ${nombre}`, code: '42883' }, 404)
    return json(implementacion(this.estado, this.leerCuerpo(peticion) ?? {}))
  }

  funcion(url, peticion) {
    const nombre = url.pathname.replace('/functions/v1/', '')
    const { accion, ...datos } = this.leerCuerpo(peticion) ?? {}
    const tabla = { alertas: ALERTAS, clickup: CLICKUP, correo: CORREO, ia: IA }[nombre]
    const manejador = tabla?.[accion]
    if (!manejador) return json({ error: `Acción desconocida: ${accion}` }, 400)
    return json(manejador(this.estado, datos))
  }
}
