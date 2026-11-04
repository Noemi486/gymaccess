import AccesoFacial from '../components/tarjetasCliente/AccesoFacial.jsx';
import MiMembresia from '../components/tarjetasCliente/MiMembresia.jsx';
import MisPagos from '../components/tarjetasCliente/MisPagos.jsx';
import MisVisitas from '../components/tarjetasCliente/MisVisitas.jsx';

// Tarjetas del Inicio del cliente. Su diseño está en el Anexo "Diseño reservado para Sprint 2: Inicio del
// cliente" de specs/002-interfaz-menu-lateral/spec.md; quedaron activadas por la funcionalidad 003 (US9).
// Cada componente recibe el resumen propio del cliente (GET /api/clientes/me/resumen).
//
// Para ocultar una tarjeta basta con poner `disponible: false`; el Inicio no necesita más cambios.
export const TARJETAS_CLIENTE = [
  { id: 'mi-membresia', titulo: 'Mi membresía', componente: MiMembresia, disponible: true },
  { id: 'acceso-facial', titulo: 'Acceso facial', componente: AccesoFacial, disponible: true },
  { id: 'mis-visitas', titulo: 'Mis últimas visitas', componente: MisVisitas, disponible: true },
  { id: 'mis-pagos', titulo: 'Mis pagos', componente: MisPagos, disponible: true },
];

// Tarjetas que se deben mostrar: las disponibles que ya tienen componente.
export function tarjetasClienteVisibles(tarjetas = TARJETAS_CLIENTE) {
  return tarjetas.filter((tarjeta) => tarjeta.disponible && tarjeta.componente);
}
