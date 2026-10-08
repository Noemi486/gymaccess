import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErrorApi } from '../api/cliente.js';
import { useAuth } from '../context/AuthContext.jsx';
import Mensaje from '../components/Mensaje.jsx';

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
    <main className="contenido" style={{ maxWidth: 420 }}>
      <h1>GymAccess</h1>
      <section className="tarjeta" aria-labelledby="titulo-login">
        <h2 id="titulo-login">Iniciar sesión</h2>

        {error && !hayErroresDeCampo && <Mensaje tipo="error" texto={error.message} />}

        <form onSubmit={alEnviar} noValidate>
          <div className="campo">
            <label htmlFor="correo">Correo</label>
            <input
              id="correo"
              type="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              aria-invalid={Boolean(errorCorreo)}
              required
            />
            {errorCorreo && <span className="error-campo">{errorCorreo}</span>}
          </div>

          <div className="campo">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(errorPassword)}
              required
            />
            {errorPassword && <span className="error-campo">{errorPassword}</span>}
          </div>

          <div className="acciones">
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Iniciar sesión'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
