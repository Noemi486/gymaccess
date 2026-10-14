// Estado vacío: se muestra cuando una lista o sección no tiene contenido.
export default function EmptyState({ titulo, texto, icono, accion }) {
  return (
    <div className="estado-vacio">
      {icono}
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}
