import { useEffect, useState } from 'react';
import { KeyRound, Mail } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCambiarPassword } from '../components/CambiarPassword.jsx';
import PerfilCliente from '../components/PerfilCliente.jsx';
import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import InfoBox from '../components/ui/InfoBox.jsx';
import Spinner from '../components/ui/Spinner.jsx';

// "Mi información": el cliente consulta únicamente sus propios datos (solo lectura).
// Pide /clientes/me: no envía ningún id, el servidor usa el cliente vinculado a la sesión.
// En pantallas grandes: el perfil a la izquierda y la tarjeta "Mi cuenta" a la derecha.
export default function MiPerfil() {
  const { usuario } = useAuth();
  const { abrir: abrirCambiarPassword } = useCambiarPassword();
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
    <section className="mi-informacion">
      <div className="mi-informacion-perfil">
        <PerfilCliente cliente={cliente} />
        <InfoBox>Si algún dato es incorrecto, pide a recepción que lo actualice.</InfoBox>
      </div>

      <Card titulo="Mi cuenta" className="mi-cuenta">
        <div className="perfil-dato">
          <span className="perfil-dato-icono">
            <Mail size={18} aria-hidden="true" />
          </span>
          <dl>
            <dt>Correo de acceso</dt>
            <dd>{usuario.correo}</dd>
          </dl>
        </div>
        <Button variante="secundario" icono={<KeyRound size={16} aria-hidden="true" />} onClick={abrirCambiarPassword}>
          Cambiar contraseña
        </Button>
      </Card>
    </section>
  );
}
