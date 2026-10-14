// Indicador de carga accesible.
export default function Spinner({ etiqueta = 'Cargando…' }) {
  return (
    <span role="status" className="spinner-contenedor">
      <span className="spinner" aria-hidden="true" />
      <span className="solo-lectores">{etiqueta}</span>
    </span>
  );
}
