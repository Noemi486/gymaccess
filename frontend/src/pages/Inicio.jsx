import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Accesos que ofrece cada rol. El cliente solo ve "Mi información"; las pantallas del personal
// además están protegidas por rol (RutaProtegida) y, sobre todo, por el backend.
const ACCESOS_POR_ROL = {
  administrador: [
    { ruta: '/usuarios', texto: 'Usuarios y roles' },
    { ruta: '/clientes/nuevo', texto: 'Registrar cliente' },
    { ruta: '/clientes', texto: 'Clientes' },
  ],
  recepcionista: [
    { ruta: '/clientes/nuevo', texto: 'Registrar cliente' },
    { ruta: '/clientes', texto: 'Clientes' },
  ],
  entrenador: [{ ruta: '/clientes', texto: 'Consulta de clientes' }],
  cliente: [{ ruta: '/mi-perfil', texto: 'Mi información' }],
};

export default function Inicio() {
  const { usuario } = useAuth();
  const accesos = ACCESOS_POR_ROL[usuario.rol] ?? [];

  return (
    <section>
      <h1>Hola, {usuario.nombre}</h1>
      <p>¿Qué quieres hacer?</p>
      <ul className="tarjeta">
        {accesos.map((acceso) => (
          <li key={acceso.ruta}>
            <Link to={acceso.ruta}>{acceso.texto}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
