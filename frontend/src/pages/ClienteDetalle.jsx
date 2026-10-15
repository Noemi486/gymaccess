import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import PanelRostro from '../components/PanelRostro.jsx';
import PanelMembresia from '../components/PanelMembresia.jsx';
import PerfilCliente from '../components/PerfilCliente.jsx';
import Button from '../components/ui/Button.jsx';
import Spinner from '../components/ui/Spinner.jsx';

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

  if (cargando) return <Spinner etiqueta="Cargando cliente…" />;
  if (!cliente) {
    return (
      <section className="perfil-pagina">
        <div className="mensaje mensaje-error" role="alert">
          {error ?? 'El cliente no existe.'}
        </div>
        <Button to="/clientes" variante="secundario">
          Volver a la lista
        </Button>
      </section>
    );
  }

  const puedeEditar = rol === 'administrador' || rol === 'recepcionista';

  return (
    <section className="perfil-pagina">
      <PerfilCliente cliente={cliente} />

      {puedeEditar && <PanelMembresia idCliente={cliente.id_cliente} clienteActivo={cliente.estado === 'activo'} rol={rol} />}
      {puedeEditar && <PanelRostro cliente={cliente} rol={rol} />}

      <div className="acciones perfil-acciones">
        <Button to="/clientes" variante="secundario">
          Volver a la lista
        </Button>
        {puedeEditar && (
          <Button to={`/clientes/${cliente.id_cliente}/editar`} icono={<Pencil size={16} aria-hidden="true" />}>
            Editar
          </Button>
        )}
      </div>
    </section>
  );
}
