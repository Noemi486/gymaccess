import { Link } from 'react-router-dom';

// Tarjeta contenedora. Con `to` es una tarjeta de acceso rápido (ícono, título y descripción).
export default function Card({ titulo, descripcion, icono, to, className = '', children }) {
  if (to) {
    return (
      <Link to={to} className={`card card-enlace ${className}`.trim()}>
        {icono && <span className="card-icono">{icono}</span>}
        <h3 className="card-titulo">{titulo}</h3>
        {descripcion && <p className="card-texto">{descripcion}</p>}
      </Link>
    );
  }
  return (
    <section className={`card ${className}`.trim()}>
      {titulo && <h2 className="card-titulo">{titulo}</h2>}
      {children}
    </section>
  );
}
