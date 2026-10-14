import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SinPermiso from '../pages/SinPermiso.jsx';

// Protege una pantalla: sin sesión lleva a /login; con un rol no permitido muestra "Sin permiso".
// `roles` es opcional: si se omite basta con haber iniciado sesión.
// Esto solo mejora la experiencia: la seguridad real se valida siempre en el backend.
export default function RutaProtegida({ roles, children }) {
  const { usuario } = useAuth();

  if (!usuario) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(usuario.rol)) return <SinPermiso />;

  return children;
}
