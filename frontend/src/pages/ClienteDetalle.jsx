import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Mensaje from '../components/Mensaje.jsx';
import { InsigniaEstado, formatearFecha } from './Clientes.jsx';

// Datos que se muestran si el backend los envía (el entrenador no recibe los de contacto).
const CAMPOS = [
  ['nombre', 'Nombre'],
  ['apellido', 'Apellido'],
  ['telefono', 'Teléfono'],
  ['correo', 'Correo'],
  ['direccion', 'Dirección'],
];

export default function ClienteDetalle() {
  const { id } = useParams();
  const { rol } = useAuth();
  const [cliente, setCliente] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    solicitar(`/clientes/${id}`)
      .then((datos) => activo && setCliente(datos))
      .catch((e) => activo && setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar el cliente.'))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [id]);

  if (cargando) return <p>Cargando…</p>;
  if (!cliente) {
    return (
      <section>
        <Mensaje tipo="error" texto={error ?? 'El cliente no existe.'} />
        <Link to="/clientes">Volver a la lista</Link>
      </section>
    );
  }

  const puedeEditar = rol === 'administrador' || rol === 'recepcionista';

  return (
    <section style={{ maxWidth: 520 }}>
      <h1>
        {cliente.nombre} {cliente.apellido}
      </h1>

      <dl className="tarjeta">
        {CAMPOS.filter(([campo]) => campo in cliente).map(([campo, etiqueta]) => (
          <div key={campo} style={{ marginBottom: 12 }}>
            <dt style={{ fontWeight: 600 }}>{etiqueta}</dt>
            <dd style={{ margin: 0 }}>{cliente[campo] ?? '—'}</dd>
          </div>
        ))}
        <div style={{ marginBottom: 12 }}>
          <dt style={{ fontWeight: 600 }}>Estado</dt>
          <dd style={{ margin: 0 }}>
            <InsigniaEstado estado={cliente.estado} />
          </dd>
        </div>
        <div>
          <dt style={{ fontWeight: 600 }}>Fecha de registro</dt>
          <dd style={{ margin: 0 }}>{formatearFecha(cliente.fecha_registro)}</dd>
        </div>
      </dl>

      <div className="acciones" style={{ marginTop: 16 }}>
        <Link to="/clientes" className="boton boton-secundario">
          Volver a la lista
        </Link>
        {puedeEditar && (
          <Link to={`/clientes/${cliente.id_cliente}/editar`} className="boton">
            Editar
          </Link>
        )}
      </div>
    </section>
  );
}
