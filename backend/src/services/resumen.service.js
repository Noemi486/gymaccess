import * as resumenModel from '../models/resumen.model.js';
import { errorSinPermiso } from '../utils/errores.js';
import { vistaCliente } from '../utils/vistaCliente.js';

const ROLES_PERSONAL = ['administrador', 'recepcionista', 'entrenador'];
const ROLES_USUARIO = ['administrador', 'recepcionista', 'entrenador', 'cliente'];
const CANTIDAD_ULTIMOS = 5;

// Cada entrada del resumen se declara aquí: `roles` dice quién la recibe y `obtener` la calcula.
// El servicio solo calcula y devuelve lo que el rol puede ver (negar por defecto).
// Para agregar un indicador (por ejemplo, en Sprint 2 `accesos_hoy` o `membresias_por_vencer`)
// basta con añadir una entrada nueva; las existentes no cambian.
export function crearResumenService({ modelo }) {
  const ENTRADAS = [
    {
      clave: 'clientes',
      roles: ROLES_PERSONAL,
      async obtener(rol) {
        const porEstado = await modelo.contarClientesPorEstado();
        const clientes = { activos: porEstado.activo ?? 0 };
        if (rol === 'administrador') {
          clientes.inactivos = porEstado.inactivo ?? 0;
          clientes.registrados_mes = await modelo.contarClientesRegistradosEsteMes();
        }
        if (rol === 'recepcionista') {
          clientes.registrados_hoy = await modelo.contarClientesRegistradosHoy();
        }
        return clientes;
      },
    },
    {
      clave: 'usuarios',
      roles: ['administrador'],
      async obtener() {
        const contados = await modelo.contarUsuariosPorRol();
        const por_rol = Object.fromEntries(ROLES_USUARIO.map((rol) => [rol, contados[rol] ?? 0]));
        const total = Object.values(por_rol).reduce((suma, cantidad) => suma + cantidad, 0);
        return { total, por_rol };
      },
    },
    {
      clave: 'ultimos_clientes',
      roles: ['administrador', 'recepcionista'],
      async obtener(rol) {
        const filas = await modelo.ultimosClientes(CANTIDAD_ULTIMOS);
        return filas.map((fila) => vistaCliente(fila, rol));
      },
    },
  ];

  // Resumen del inicio para el personal. El rol cliente no tiene resumen (usa su información propia).
  async function obtener(actor) {
    if (!actor || !ROLES_PERSONAL.includes(actor.rol)) throw errorSinPermiso();
    const resumen = {};
    for (const entrada of ENTRADAS) {
      if (entrada.roles.includes(actor.rol)) resumen[entrada.clave] = await entrada.obtener(actor.rol);
    }
    return resumen;
  }

  return { obtener };
}

const servicio = crearResumenService({ modelo: resumenModel });

export const { obtener } = servicio;
