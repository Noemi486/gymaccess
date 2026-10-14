// Tarjeta de indicador: un valor destacado con su etiqueta.
export default function StatCard({ etiqueta, valor, icono }) {
  return (
    <div className="card stat-card">
      {icono && <span className="card-icono">{icono}</span>}
      <div>
        <span className="stat-valor">{valor}</span>
        <span className="stat-etiqueta">{etiqueta}</span>
      </div>
    </div>
  );
}
