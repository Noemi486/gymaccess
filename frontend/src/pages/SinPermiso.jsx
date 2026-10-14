import { ShieldAlert } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

// Página "Sin permiso": el rol del usuario no puede ver la pantalla que pidió.
// Es solo la parte visible: los permisos reales los valida siempre el backend.
export default function SinPermiso() {
  return (
    <div className="pagina-error" role="alert">
      <EmptyState
        icono={<ShieldAlert size={48} aria-hidden="true" />}
        titulo="Sin permiso"
        texto="Tu rol no puede ver esta página. Si crees que es un error, avisa al administrador."
        accion={<Button to="/">Volver al inicio</Button>}
      />
    </div>
  );
}
