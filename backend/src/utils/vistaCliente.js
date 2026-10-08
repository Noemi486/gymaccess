import { clientePublico } from './serializadores.js';

// Roles que ven todos los datos del cliente (FR-019).
const ROLES_CON_DATOS_COMPLETOS = ['administrador', 'recepcionista'];

// Qué datos de un cliente ve cada rol (tabla "Vista de datos por rol" de data-model.md):
// - administrador y recepcionista: todos los campos.
// - entrenador: solo id_cliente, nombre, apellido, estado y fecha_registro.
// Cualquier otro rol recibe la vista básica (negar por defecto). El cliente que consulta su
// propia información usa `clientePublico` directamente, nunca esta función.
export function vistaCliente(fila, rol) {
  if (ROLES_CON_DATOS_COMPLETOS.includes(rol)) return clientePublico(fila);
  return {
    id_cliente: fila.id_cliente,
    nombre: fila.nombre,
    apellido: fila.apellido,
    estado: fila.estado,
    fecha_registro: fila.fecha_registro,
  };
}
