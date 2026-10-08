// Controles de paginación para las listas. `page` empieza en 1.
export default function Paginacion({ page, limit, total, onCambiar }) {
  const totalPaginas = Math.max(1, Math.ceil(total / limit));
  return (
    <nav className="paginacion" aria-label="Paginación">
      <button
        type="button"
        className="boton boton-secundario"
        disabled={page <= 1}
        onClick={() => onCambiar(page - 1)}
      >
        Anterior
      </button>
      <span>
        Página {page} de {totalPaginas} ({total} en total)
      </span>
      <button
        type="button"
        className="boton boton-secundario"
        disabled={page >= totalPaginas}
        onClick={() => onCambiar(page + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
