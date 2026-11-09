import { Card, Hero, Tabs } from '../components/ui'
import { PestanaAuditoria } from '../features/configuracion/PestanaAuditoria'
import { PestanaClickUp } from '../features/clickup/PestanaClickUp'
import { PestanaCatalogos } from '../features/configuracion/PestanaCatalogos'
import { PestanaExportar } from '../features/configuracion/PestanaExportar'
import { PestanaImportar } from '../features/configuracion/PestanaImportar'
import { TarjetaBaseDatos } from '../features/configuracion/TarjetaBaseDatos'
import { TarjetaCorreo } from '../features/configuracion/TarjetaCorreo'
import { TarjetaPo } from '../features/configuracion/TarjetaPo'

const PESTANAS = [
  { id: 'catalogos', titulo: 'Catálogos', icono: 'category', contenido: <PestanaCatalogos /> },
  { id: 'importar', titulo: 'Importar Plan de Trabajo', icono: 'upload_file', contenido: <PestanaImportar /> },
  { id: 'exportar', titulo: 'Exportar y respaldo', icono: 'swap_vert', contenido: <PestanaExportar /> },
  { id: 'clickup', titulo: 'ClickUp', icono: 'sync_alt', contenido: <PestanaClickUp /> },
  { id: 'auditoria', titulo: 'Auditoría', icono: 'policy', contenido: <PestanaAuditoria /> },
]

export default function Configuracion() {
  return (
    <>
      <Hero
        kicker="CONFIGURACIÓN & DATOS"
        titulo="Base de datos y motor de alertas"
        subtitulo="Dónde se guardan tus registros, cómo salen los correos y cómo respaldar o cargar tus datos."
      />
      <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
        <TarjetaPo />
        <TarjetaCorreo />
        <TarjetaBaseDatos />
      </div>
      <Card>
        <Tabs pestanas={PESTANAS} />
      </Card>
    </>
  )
}
