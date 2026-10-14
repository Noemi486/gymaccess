import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import { indicadoresParaRol } from '../config/indicadores.js';
import { tarjetasClienteVisibles } from '../config/tarjetasCliente.js';
import BuscadorClientes from '../components/BuscadorClientes.jsx';
import ClientesNuevos from '../components/ClientesNuevos.jsx';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import StatCard from '../components/ui/StatCard.jsx';
import Table from '../components/ui/Table.jsx';
import { ETIQUETAS_ROL } from '../components/ui/Topbar.jsx';
import { formatearFecha } from './Clientes.jsx';

const PUEDE_REGISTRAR = ['administrador', 'recepcionista'];
const CON_BUSCADOR = ['recepcionista', 'entrenador'];

// Fecha de hoy en español, con la primera letra en mayúscula.
export function fechaDeHoy(fecha = new Date()) {
  const texto = fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

const COLUMNAS_ULTIMOS = [
  {
    clave: 'nombre',
    etiqueta: 'Cliente',
    render: (cliente) => (
      <Link to={`/clientes/${cliente.id_cliente}`} className="enlace-fila">
        {cliente.nombre} {cliente.apellido}
      </Link>
    ),
  },
  { clave: 'estado', etiqueta: 'Estado', render: (cliente) => <Badge estado={cliente.estado} /> },
  { clave: 'fecha_registro', etiqueta: 'Registrado', render: (cliente) => formatearFecha(cliente.fecha_registro) },
];

const COLUMNAS_ROLES = [
  { clave: 'rol', etiqueta: 'Rol' },
  { clave: 'cantidad', etiqueta: 'Usuarios' },
];

// Inicio: panel de resumen según el rol. Los datos vienen de GET /api/resumen (personal) o de
// GET /clientes/me (cliente); el servidor solo envía lo que cada rol puede ver.
export default function Inicio() {
  const { usuario } = useAuth();
  const { rol } = usuario;
  const esCliente = rol === 'cliente';

  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    solicitar(esCliente ? '/clientes/me' : '/resumen')
      .then((respuesta) => activo && setDatos(respuesta))
      .catch(
        (e) =>
          activo && setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el resumen. Intenta de nuevo.'),
      );
    return () => {
      activo = false;
    };
  }, [esCliente]);

  const puedeRegistrar = PUEDE_REGISTRAR.includes(rol);
  const acciones = puedeRegistrar ? (
    <Button to="/clientes/nuevo" icono={<Plus size={18} aria-hidden="true" />}>
      Registrar cliente
    </Button>
  ) : null;

  return (
    <section>
      <PageHeader titulo={`Hola, ${usuario.nombre}`} descripcion={fechaDeHoy()} acciones={acciones} />

      {CON_BUSCADOR.includes(rol) && (
        <BuscadorClientes placeholder={rol === 'entrenador' ? 'Nombre o apellido' : 'Nombre, apellido o correo'} />
      )}

      {error && (
        <div className="mensaje mensaje-error" role="alert">
          {error}
        </div>
      )}
      {!datos && !error && <Spinner etiqueta="Cargando resumen…" />}

      {datos && esCliente && <MiInformacion cliente={datos} />}
      {datos && !esCliente && <ResumenPersonal rol={rol} resumen={datos} />}
    </section>
  );
}

function MiInformacion({ cliente }) {
  const tarjetas = tarjetasClienteVisibles();
  return (
    <>
      <Card titulo="Mi información" className="inicio-cliente">
        <p className="inicio-cliente-nombre">
          {cliente.nombre} {cliente.apellido}
        </p>
        <p className="inicio-cliente-datos">
          <Badge estado={cliente.estado} />
          <span>{cliente.correo ?? 'Sin correo registrado'}</span>
        </p>
        <Button to="/mi-perfil" variante="secundario">
          Ver mi información
        </Button>
      </Card>

      {/* Panel reservado para las tarjetas de Sprint 2 (membresía, acceso facial, visitas y pagos).
          No muestra nada hasta que se declaren disponibles en config/tarjetasCliente.js */}
      {tarjetas.length > 0 && (
        <div className="inicio-cliente-panel">
          {tarjetas.map(({ id, componente: Tarjeta }) => (
            <Tarjeta key={id} cliente={cliente} />
          ))}
        </div>
      )}
    </>
  );
}

function ResumenPersonal({ rol, resumen }) {
  const indicadores = indicadoresParaRol(rol);
  const ultimos = resumen.ultimos_clientes;
  const porRol = resumen.usuarios?.por_rol;

  return (
    <>
      {/* Aquí se sumarán los indicadores de Sprint 2: basta con declararlos disponibles en config/indicadores.js */}
      <div className="inicio-indicadores">
        {indicadores.map((indicador) => {
          const Icono = indicador.icono;
          return (
            <StatCard
              key={indicador.id}
              etiqueta={indicador.etiqueta}
              valor={indicador.valor(resumen) ?? 0}
              icono={<Icono size={20} aria-hidden="true" />}
            />
          );
        })}
      </div>

      <div className="inicio-paneles">
        {/* Entrenador: lista de clientes nuevos con la proyección básica (sin datos de contacto) */}
        {ultimos && rol === 'entrenador' && (
          <div className="inicio-panel-ancho">
            <ClientesNuevos clientes={ultimos} />
          </div>
        )}

        {ultimos && rol !== 'entrenador' && (
          <Card titulo="Últimos clientes registrados" className="inicio-panel-ancho">
            <Table
              etiquetaTabla="Últimos clientes registrados"
              columnas={COLUMNAS_ULTIMOS}
              filas={ultimos.map((cliente) => ({ ...cliente, id: cliente.id_cliente }))}
              vacio={
                <EmptyState
                  titulo="Aún no hay clientes registrados"
                  texto="Cuando registres clientes, los más recientes aparecerán aquí."
                  accion={
                    PUEDE_REGISTRAR.includes(rol) ? <Button to="/clientes/nuevo">Registrar el primer cliente</Button> : null
                  }
                />
              }
            />
          </Card>
        )}

        {porRol && (
          <Card titulo="Usuarios por rol">
            <Table
              etiquetaTabla="Usuarios por rol"
              columnas={COLUMNAS_ROLES}
              filas={Object.entries(porRol).map(([clave, cantidad]) => ({
                id: clave,
                rol: ETIQUETAS_ROL[clave] ?? clave,
                cantidad,
              }))}
            />
          </Card>
        )}
      </div>
    </>
  );
}
