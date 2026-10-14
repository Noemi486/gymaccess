import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import PerfilCliente from '../components/PerfilCliente.jsx';
import InfoBox from '../components/ui/InfoBox.jsx';
import Spinner from '../components/ui/Spinner.jsx';

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

  if (cargando) return <Spinner etiqueta="Cargando tu información…" />;
  if (!cliente) {
    return (
      <div className="mensaje mensaje-error" role="alert">
        {error ?? 'No se encontró tu información.'}
      </div>
    );
  }

  return (
    <section className="perfil-pagina">
      <PerfilCliente cliente={cliente} />
      <InfoBox>Si algún dato es incorrecto, pide a recepción que lo actualice.</InfoBox>
    </section>
  );
}
