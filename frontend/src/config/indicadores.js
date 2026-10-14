import { CalendarClock, DoorOpen, ShieldCheck, UserCheck, UserPlus, UserX, Users } from 'lucide-react';

// Indicadores (StatCard) del inicio. Cada uno dice qué rol lo ve y de dónde sale su valor en la
// respuesta de GET /api/resumen. El servidor solo envía a cada rol lo que le corresponde.
//
// Espacio para Sprint 2: "Accesos de hoy" y "Membresías por vencer" ya están declarados con
// `disponible: false` y no se muestran. Para activarlos basta con que el servidor devuelva la clave
// en el resumen y cambiar `disponible` a true; el inicio no necesita más cambios.
export const INDICADORES = [
  {
    id: 'clientes-activos',
    etiqueta: 'Clientes activos',
    icono: UserCheck,
    roles: ['administrador', 'recepcionista', 'entrenador'],
    valor: (resumen) => resumen.clientes?.activos,
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
  // --- Reservados para Sprint 2 (no se muestran todavía) ---
  {
    id: 'accesos-hoy',
    etiqueta: 'Accesos de hoy',
    icono: DoorOpen,
    roles: ['administrador', 'recepcionista'],
    valor: (resumen) => resumen.accesos?.hoy,
    disponible: false,
  },
  {
    id: 'membresias-por-vencer',
    etiqueta: 'Membresías por vencer',
    icono: CalendarClock,
    roles: ['administrador', 'recepcionista'],
    valor: (resumen) => resumen.membresias?.por_vencer,
    disponible: false,
  },
];

// Indicadores que debe mostrar un rol: los de su rol que ya están disponibles.
export function indicadoresParaRol(rol, indicadores = INDICADORES) {
  return indicadores.filter((indicador) => indicador.disponible !== false && indicador.roles.includes(rol));
}
