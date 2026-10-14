import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { ErrorApi } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import CarruselLogin from '../components/CarruselLogin.jsx';
import Button from '../components/ui/Button.jsx';
import FormField from '../components/ui/FormField.jsx';
import Input from '../components/ui/Input.jsx';
import PasswordInput from '../components/ui/PasswordInput.jsx';

// Inicio de sesión en dos paneles: a la izquierda la marca y un carrusel de tres diapositivas (frase e
// ilustración, para todos los roles); a la derecha el formulario. En pantallas pequeñas se oculta todo salvo el logo y el formulario.
// No hay registro de cuenta nueva: solo el administrador crea cuentas.
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
          <CarruselLogin />
        </div>
      </aside>

      <section className="login-formulario" aria-labelledby="titulo-login">
        <div className="login-caja">
          <div className="login-logo-movil" aria-hidden="true">
            <span className="sidebar-logo">
              <Dumbbell size={22} />
            </span>
            <strong>GymAccess</strong>
          </div>

          <h1 id="titulo-login">Iniciar sesión en GymAccess</h1>

          {error && !hayErroresDeCampo && (
            <div className="mensaje mensaje-error" role="alert">
              {error.message}
            </div>
          )}

          <form onSubmit={alEnviar} noValidate>
            <FormField id="correo" etiqueta="Correo electrónico" etiquetaOculta error={errorCorreo}>
              <Input
                type="email"
                className="entrada-grande"
                placeholder="Correo electrónico"
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
            </FormField>

            <FormField id="password" etiqueta="Contraseña" etiquetaOculta error={errorPassword}>
              <PasswordInput
                className="entrada-grande"
                placeholder="Contraseña"
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

          <p className="login-olvido">
            ¿Olvidaste tu contraseña? Pide a recepción que la restablezca.
          </p>
        </div>
      </section>
    </main>
  );
}
