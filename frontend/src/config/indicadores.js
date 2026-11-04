import { CalendarClock, ClipboardList, DoorOpen, ShieldCheck, UserCheck, UserPlus, UserX, Users } from 'lucide-react';

// Indicadores (StatCard) del inicio. Cada uno dice qué rol lo ve y de dónde sale su valor en la
// respuesta de GET /api/resumen. El servidor solo envía a cada rol lo que le corresponde.
//
// Sprint 2 (US9): "Accesos de hoy" y "Membresías por vencer" (administrador y recepcionista) y
// "Clientes que entraron hoy" (entrenador) ya están activos. Un indicador con `disponible: false` no se muestra.
export const INDICADORES = [
  {
    id: 'clientes-activos',
    etiqueta: 'Clientes activos',
    icono: UserCheck,
    roles: ['administrador', 'recepcionista', 'entrenador'],
    valor: (resumen) => resumen.clientes?.activos,
  },
  {
    id: 'clientes-7-dias',
    etiqueta: 'Clientes nuevos (7 días)',
    icono: UserPlus,
    roles: ['entrenador'],
    valor: (resumen) => resumen.clientes?.nuevos_7_dias,
  },
  {
    id: 'clientes-inactivos',
    etiqueta: 'Clientes inactivos',
    icono: UserX,
    roles: ['administrador'],
    valor: (resumen) => resumen.clientes?.inactivos,
  },
  {
    id: 'clientes-mes',
    etiqueta: 'Registrados este mes',
    icono: UserPlus,
    roles: ['administrador'],
    valor: (resumen) => resumen.clientes?.registrados_mes,
  },
  {
    id: 'usuarios-sistema',
    etiqueta: 'Usuarios del sistema',
    icono: ShieldCheck,
    roles: ['administrador'],
    valor: (resumen) => resumen.usuarios?.total,
  },
  {
    id: 'clientes-hoy',
    etiqueta: 'Registrados hoy',
    icono: Users,
    roles: ['recepcionista'],
    valor: (resumen) => resumen.clientes?.registrados_hoy,
  },
  // --- Sprint 2 (US9, FR-043 y FR-044) ---
  {
    id: 'accesos-hoy',
    etiqueta: 'Accesos de hoy',
    icono: DoorOpen,
    roles: ['administrador', 'recepcionista'],
    valor: (resumen) => resumen.accesos?.hoy,
    disponible: true,
  },
  {
    id: 'membresias-por-vencer',
    etiqueta: 'Membresías por vencer',
    icono: CalendarClock,
    roles: ['administrador', 'recepcionista'],
    valor: (resumen) => resumen.membresias?.por_vencer,
    disponible: true,
  },
  {
    id: 'clientes-entraron-hoy',
    etiqueta: 'Clientes que entraron hoy',
    icono: DoorOpen,
    roles: ['entrenador'],
    valor: (resumen) => resumen.accesos?.clientes_hoy,
    disponible: true,
  },
  // --- Sprint 3 (spec 004, FR-024) ---
  {
    id: 'mis-clientes-asignados',
    etiqueta: 'Mis clientes asignados',
    icono: ClipboardList,
    roles: ['entrenador'],
    valor: (resumen) => resumen.mis_clientes?.total,
    disponible: true,
  },
];

// Indicadores que debe mostrar un rol: los de su rol que ya están disponibles.
export function indicadoresParaRol(rol, indicadores = INDICADORES) {
  return indicadores.filter((indicador) => indicador.disponible !== false && indicador.roles.includes(rol));
}
