import { Mail, MapPin, Phone } from 'lucide-react';
import Avatar from './ui/Avatar.jsx';
import Badge from './ui/Badge.jsx';
import Card from './ui/Card.jsx';

// Datos que se muestran si el backend los envía (el entrenador no recibe los de contacto).
const CAMPOS = [
  { campo: 'telefono', etiqueta: 'Teléfono', icono: Phone },
  { campo: 'correo', etiqueta: 'Correo', icono: Mail },
  { campo: 'direccion', etiqueta: 'Dirección', icono: MapPin },
];

// "12 de octubre de 2026"
const fechaLarga = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

// Perfil de un cliente: encabezado (avatar grande, nombre, estado y "Cliente desde …") y sus
// datos en una cuadrícula de 2 columnas (1 en pantallas pequeñas). Lo usan "Mi información" y
// el detalle de cliente.
export default function PerfilCliente({ cliente }) {
  const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`;
  const datos = CAMPOS.filter(({ campo }) => campo in cliente);

  return (
    <Card className="perfil">
      <div className="perfil-encabezado">
        <Avatar nombre={nombreCompleto} tamano="grande" />
        <div className="perfil-identidad">
          <h1>{nombreCompleto}</h1>
          <div className="perfil-estado">
            <Badge estado={cliente.estado} />
            <span className="perfil-desde">Cliente desde {fechaLarga(cliente.fecha_registro)}</span>
          </div>
        </div>
      </div>

      {datos.length > 0 && (
        <dl className="perfil-datos">
          {datos.map(({ campo, etiqueta, icono: Icono }) => (
            <div key={campo} className="perfil-dato">
              <span className="perfil-dato-icono">
                <Icono size={18} aria-hidden="true" />
              </span>
              <div>
                <dt>{etiqueta}</dt>
                <dd>{cliente[campo] ?? '—'}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
