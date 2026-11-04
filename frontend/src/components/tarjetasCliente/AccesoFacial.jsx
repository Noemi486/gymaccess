import Badge from '../ui/Badge.jsx';
import Card from '../ui/Card.jsx';
import { formatearFechaCorta } from '../../utils/formato.js';

// Tarjeta "Acceso facial": solo si el rostro está registrado. Nunca muestra datos biométricos.
export default function AccesoFacial({ resumen }) {
  const rostro = resumen?.rostro;
  const registrado = Boolean(rostro?.registrado);
  return (
    <Card titulo="Acceso facial" className="tarjeta-cliente">
      <div className="tarjeta-cliente-fila">
        <span>Rostro</span>
        <Badge variante={registrado ? 'exito' : 'neutral'}>{registrado ? 'Registrado' : 'No registrado'}</Badge>
      </div>
      <p className="tarjeta-cliente-dato">
        {registrado
          ? `Registrado el ${formatearFechaCorta(rostro.fecha_registro)}. Ya puedes entrar con tu rostro.`
          : 'Pide a recepción que registre tu rostro.'}
      </p>
    </Card>
  );
}
