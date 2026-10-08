import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Mensaje from '../components/Mensaje.jsx';
import { InsigniaEstado, formatearFecha } from './Clientes.jsx';

// "Mi información": el cliente consulta únicamente sus propios datos (solo lectura).
// Pide /clientes/me: no envía ningún id, el servidor usa el cliente vinculado a la sesión.
export default function MiPerfil() {
  const [cliente, setCliente] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let activo = true;
    solicitar('/clientes/me')
      .then((datos) => activo && setCliente(datos))
      .catch((e) => activo && setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar tu información.'))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  if (cargando) return <p>Cargando…</p>;
  if (!cliente) return <Mensaje tipo="error" texto={error ?? 'No se encontró tu información.'} />;

  const filas = [
    ['Teléfono', cliente.telefono],
    ['Correo', cliente.correo ?? '—'],
    ['Dirección', cliente.direccion ?? '—'],
  ];

  return (
    <section style={{ maxWidth: 520 }}>
      <h1>
        {cliente.nombre} {cliente.apellido}
      </h1>
      <p className="ayuda">Estos son los datos que el gimnasio tiene registrados de ti.</p>

      <dl className="tarjeta">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} style={{ marginBottom: 12 }}>
            <dt style={{ fontWeight: 600 }}>{etiqueta}</dt>
            <dd style={{ margin: 0 }}>{valor}</dd>
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

      <p className="ayuda">Si algún dato es incorrecto, pide a recepción que lo actualice.</p>
    </section>
  );
}
