import { SearchX } from 'lucide-react';
import Button from '../components/ui/Button.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

// Página "No encontrado": la dirección no existe (o fue movida).
export default function NoEncontrado() {
  return (
    <div className="pagina-error">
      <EmptyState
        icono={<SearchX size={48} aria-hidden="true" />}
        titulo="No encontrado"
        texto="La página que buscas no existe o fue movida."
        accion={<Button to="/">Volver al inicio</Button>}
      />
    </div>
  );
}
