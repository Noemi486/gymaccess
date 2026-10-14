// Tarjetas del Inicio del cliente reservadas para Sprint 2. NO se muestran todavía: están
// declaradas sin componente y con `disponible: false`. Su diseño está en el Anexo "Diseño reservado
// para Sprint 2: Inicio del cliente" de specs/002-interfaz-menu-lateral/spec.md.
//
// Para activar una en Sprint 2: crear su componente, asignarlo en `componente` y poner
// `disponible: true`. El Inicio la mostrará en el panel reservado sin más cambios.
export const TARJETAS_CLIENTE = [
  { id: 'mi-membresia', titulo: 'Mi membresía', componente: null, disponible: false },
  { id: 'acceso-facial', titulo: 'Acceso facial', componente: null, disponible: false },
  { id: 'mis-visitas', titulo: 'Mis últimas visitas', componente: null, disponible: false },
  { id: 'mis-pagos', titulo: 'Mis pagos', componente: null, disponible: false },
];

// Tarjetas que se deben mostrar: las disponibles que ya tienen componente.
export function tarjetasClienteVisibles(tarjetas = TARJETAS_CLIENTE) {
  return tarjetas.filter((tarjeta) => tarjeta.disponible && tarjeta.componente);
}
