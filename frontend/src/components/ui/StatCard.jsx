// Tarjeta de indicador: un valor destacado con su etiqueta.
export default function StatCard({ etiqueta, valor, icono, className = '' }) {
  return (
    <div className={`card stat-card ${className}`.trim()}>
      {icono && <span className="card-icono">{icono}</span>}
      <div>
        <span className="stat-valor">{valor}</span>
        <span className="stat-etiqueta">{etiqueta}</span>
      </div>
    </div>
  );
}
