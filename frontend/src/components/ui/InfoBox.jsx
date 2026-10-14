import { Info } from 'lucide-react';

// Caja informativa con ícono, para avisos que no son errores ni confirmaciones.
export default function InfoBox({ children }) {
  return (
    <div className="info-box" role="note">
      <Info size={20} className="info-box-icono" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
