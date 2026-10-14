// Encabezado de página: título, descripción corta y acciones (por ejemplo, "+ Registrar cliente").
export default function PageHeader({ titulo, descripcion, acciones }) {
  return (
    <div className="page-header">
      <div className="page-header-texto">
        <h1>{titulo}</h1>
        {descripcion && <p className="page-header-descripcion">{descripcion}</p>}
      </div>
      {acciones && <div className="page-header-acciones">{acciones}</div>}
    </div>
  );
}
