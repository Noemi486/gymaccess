import { House, UserCog, UserRound, Users } from 'lucide-react';

// ÚNICA fuente de las secciones del menú lateral.
// Para agregar una sección (por ejemplo, las de Sprint 2) basta con añadir una entrada a SECCIONES.
// Ocultar una sección aquí es solo comodidad: los permisos reales los valida el backend.

export const BLOQUES = [
  { id: 'general', etiqueta: 'General' },
  { id: 'operacion', etiqueta: 'Operación' },
  { id: 'administracion', etiqueta: 'Administración' },
];

export const SECCIONES = [
  {
    id: 'inicio',
    etiqueta: 'Inicio',
    ruta: '/',
    icono: House,
    bloque: 'general',
    roles: ['administrador', 'recepcionista', 'entrenador', 'cliente'],
  },
  {
    id: 'mi-informacion',
    etiqueta: 'Mi información',
    ruta: '/mi-perfil',
    icono: UserRound,
    bloque: 'general',
    roles: ['cliente'],
  },
  {
    id: 'clientes',
    etiqueta: 'Clientes',
    ruta: '/clientes',
    icono: Users,
    bloque: 'operacion',
    roles: ['administrador', 'recepcionista', 'entrenador'],
  },
  {
    id: 'usuarios',
    etiqueta: 'Usuarios y roles',
    ruta: '/usuarios',
    icono: UserCog,
    bloque: 'administracion',
    roles: ['administrador'],
  },
];

// Secciones visibles para un rol, agrupadas por bloque en el orden de BLOQUES.
// Los bloques sin secciones para ese rol se omiten. Devuelve [{ bloque, secciones }].
export function menuParaRol(rol, secciones = SECCIONES) {
  return BLOQUES.map((bloque) => ({
    bloque,
    secciones: secciones.filter((seccion) => seccion.bloque === bloque.id && seccion.roles.includes(rol)),
  })).filter((grupo) => grupo.secciones.length > 0);
}

// Sección del menú que corresponde a una ruta (por prefijo; "/" solo coincide exacto).
export function seccionDeRuta(ruta, secciones = SECCIONES) {
  return (
    [...secciones]
      .sort((a, b) => b.ruta.length - a.ruta.length)
      .find((seccion) => (seccion.ruta === '/' ? ruta === '/' : ruta === seccion.ruta || ruta.startsWith(`${seccion.ruta}/`))) ??
    null
  );
}
