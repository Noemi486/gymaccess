import Button from './Button.jsx';

// Controles de paginación. `page` empieza en 1. Mantiene el texto "Página N de M".
export default function Pagination({ page, limit, total, onCambiar }) {
  const totalPaginas = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className="paginacion" aria-label="Paginación">
      <Button variante="secundario" disabled={page <= 1} onClick={() => onCambiar(page - 1)}>
        Anterior
      </Button>
      <span>
        Página {page} de {totalPaginas} ({total} en total)
      </span>
      <Button variante="secundario" disabled={page >= totalPaginas} onClick={() => onCambiar(page + 1)}>
        Siguiente
      </Button>
    </nav>
  );
}
