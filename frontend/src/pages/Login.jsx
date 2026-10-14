import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, Dumbbell, ScanFace } from 'lucide-react';
import { ErrorApi } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';

const CARACTERISTICAS = [
  'Acceso con reconocimiento facial',
  'Membresías y pagos al día',
  'Control de permisos por rol',
];

// Inicio de sesión en dos paneles: a la izquierda la marca GymAccess con una frase y a la derecha
// el formulario. En pantallas pequeñas el panel de marca pasa arriba, reducido a la marca.
export default function Login() {
  const { usuario, iniciarSesion } = useAuth();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  if (usuario) return <Navigate to="/" replace />;

  async function alEnviar(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(correo, password);
      navegar('/', { replace: true });
    } catch (e) {
      setError(
        e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'),
      );
    } finally {
      setEnviando(false);
    }
  }

  const errorCorreo = error?.mensajeDeCampo('correo');
  const errorPassword = error?.mensajeDeCampo('password');
  // El mensaje general solo se muestra cuando no hay errores por campo.
  const hayErroresDeCampo = Boolean(errorCorreo || errorPassword);

  return (
    <main className="login">
      <aside className="login-marca">
        <div className="login-marca-logo">
          <span className="sidebar-logo" aria-hidden="true">
            <Dumbbell size={22} />
          </span>
          <strong>GymAccess</strong>
        </div>
        <div className="login-marca-centro">
          <span className="login-icono" aria-hidden="true">
            <ScanFace size={72} strokeWidth={1.5} />
          </span>
          <p className="login-frase">Clientes, membresías y accesos, en un solo lugar.</p>
          <p className="login-subfrase">Administra tu gimnasio con orden y sin papeleo.</p>
          <ul className="login-caracteristicas">
            {CARACTERISTICAS.map((texto) => (
              <li key={texto}>
                <Check size={18} strokeWidth={3} aria-hidden="true" />
                {texto}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="login-formulario" aria-labelledby="titulo-login">
        <div className="login-caja">
          <h1 id="titulo-login">Iniciar sesión</h1>
          <p className="login-ayuda">Ingresa con tu correo y tu contraseña.</p>

          {error && !hayErroresDeCampo && (
            <div className="mensaje mensaje-error" role="alert">
              {error.message}
            </div>
          )}

          <form onSubmit={alEnviar} noValidate>
            <FormField id="correo" etiqueta="Correo" error={errorCorreo}>
              <Input
                type="email"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
            </FormField>

            <FormField id="password" etiqueta="Contraseña" error={errorPassword}>
              <PasswordInput
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </FormField>

            <Button type="submit" cargando={enviando} className="login-boton">
              Iniciar sesión
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
