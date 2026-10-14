import { CalendarClock, Check, Clock, DoorOpen, ScanFace, Wallet } from 'lucide-react';
import Avatar from './ui/Avatar.jsx';
import Badge from './ui/Badge.jsx';
import Card from './ui/Card.jsx';
import StatCard from './ui/StatCard.jsx';

// Ilustraciones del carrusel del inicio de sesión. Están hechas solo con HTML/CSS y los componentes del
// sistema (sin imágenes ni logos de terceros): tarjetas encimadas e inclinadas con una animación sutil de
// flotación. Son decorativas (aria-hidden) y todos los datos que muestran son de ejemplo.

// Diapositiva 1: control de acceso con el rostro.
export function IlustracionAcceso() {
  return (
    <div className="ilustracion" aria-hidden="true">
      <StatCard
        className="ilu-der"
        etiqueta="accesos hoy"
        valor="128"
        icono={<DoorOpen size={20} />}
      />

      <Card className="ilu-centro ilu-rostro">
        <span className="ilu-escaner">
          <span className="ilu-esquina ilu-esquina-sup-izq" />
          <span className="ilu-esquina ilu-esquina-sup-der" />
          <span className="ilu-esquina ilu-esquina-inf-izq" />
          <span className="ilu-esquina ilu-esquina-inf-der" />
          <ScanFace size={84} strokeWidth={1.25} />
        </span>
        <strong className="ilu-nombre">Min Cabrera</strong>
      </Card>

      <span className="ilu-burbuja">
        <Check size={16} strokeWidth={3} />
        Acceso autorizado
      </span>
    </div>
  );
}

// Diapositiva 2: membresías y pagos al día.
export function IlustracionPagos() {
  return (
    <div className="ilustracion" aria-hidden="true">
      <Card className="ilu-izq ilu-plan">
        <span className="ilu-etiqueta">Plan Mensual</span>
        <Badge estado="vigente" />
      </Card>

      <StatCard
        className="ilu-der ilu-alerta"
        etiqueta="membresías por vencer"
        valor="3"
        icono={<CalendarClock size={20} />}
      />

      <Card className="ilu-centro ilu-pago">
        <span className="card-icono">
          <Wallet size={22} />
        </span>
        <span className="ilu-etiqueta">Pago registrado</span>
        <strong className="ilu-monto">$450</strong>
      </Card>
    </div>
  );
}

// Diapositiva 3: el cliente consulta su membresía y sus visitas.
const VISITAS = ['Hoy · 07:15', 'Ayer · 18:40', 'Lun · 07:05'];

export function IlustracionCliente() {
  return (
    <div className="ilustracion" aria-hidden="true">
      <Card className="ilu-izq ilu-visitas">
        <span className="ilu-etiqueta">Últimas visitas</span>
        <ul className="ilu-visitas-lista">
          {VISITAS.map((visita) => (
            <li key={visita}>
              <Clock size={14} />
              {visita}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="ilu-der ilu-vence">
        <strong className="ilu-vence-texto">Vence en 18 días</strong>
        <span className="ilu-barra">
          <span className="ilu-barra-relleno" />
        </span>
      </Card>

      <Card className="ilu-centro ilu-perfil">
        <Avatar nombre="Min Cabrera" tamano="grande" />
        <strong className="ilu-nombre">Min Cabrera</strong>
        <Badge estado="vigente" />
      </Card>
    </div>
  );
}
