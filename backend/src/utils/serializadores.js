import { aCentavos, deCentavos } from './dinero.js';
import { diasRestantes, estadoEfectivo, porVencer } from './membresia.js';

// Vista completa de un cliente (administrador, recepcionista y el propio cliente).
// La vista reducida del entrenador se arma aparte (utils/vistaCliente.js, historia US4).
export function clientePublico(fila) {
  return {
    id_cliente: fila.id_cliente,
    nombre: fila.nombre,
    apellido: fila.apellido,
    correo: fila.correo ?? null,
    telefono: fila.telefono,
    direccion: fila.direccion ?? null,
    fecha_registro: fila.fecha_registro,
    estado: fila.estado,
  };
}

// Forma pública de un usuario: NUNCA incluye `password` (el hash) ni ningún otro campo extra.
export function usuarioPublico(fila) {
  return {
    id_usuario: fila.id_usuario,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: fila.rol,
    estado: fila.estado,
    id_cliente: fila.id_cliente ?? null,
    fecha_registro: fila.fecha_registro,
  };
}

// ---------------------------------------------------------------------------------------------
// Sprint 2: membresías, pagos, rostros y accesos.
// REGLA: ninguna salida incluye el descriptor facial (ni el campo descriptor_facial).
// ---------------------------------------------------------------------------------------------

const numeroMonto = (valor) => deCentavos(aCentavos(valor));

// Plan de membresía.
export function tipoMembresiaPublico(fila) {
  return {
    id_tipo_membresia: fila.id_tipo_membresia,
    nombre: fila.nombre,
    descripcion: fila.descripcion ?? null,
    duracion: fila.duracion,
    precio: numeroMonto(fila.precio),
    estado: fila.estado,
  };
}

// Membresía con su estado efectivo. La fila viene de membresias + tipos_membresia + el pago registrado:
//   tipo_nombre, tipo_duracion, tipo_precio y pago_id, pago_fecha, pago_metodo, pago_monto (nulos si no hay pago).
export function membresiaPublica(fila, hoy) {
  const tienePago = fila.pago_id !== null && fila.pago_id !== undefined;
  const datos = { estado: fila.estado, fecha_inicio: fila.fecha_inicio, fecha_fin: fila.fecha_fin, tiene_pago: tienePago };
  const estado = estadoEfectivo(datos, hoy);
  const precioPlan = numeroMonto(fila.tipo_precio);
  return {
    id_membresia: fila.id_membresia,
    id_cliente: fila.id_cliente,
    tipo: { id_tipo_membresia: fila.id_tipo_membresia, nombre: fila.tipo_nombre, duracion: fila.tipo_duracion },
    fecha_inicio: fila.fecha_inicio,
    fecha_fin: fila.fecha_fin,
    estado,
    dias_restantes: diasRestantes(fila.fecha_fin, hoy),
    por_vencer: porVencer(datos, hoy),
    precio: tienePago ? numeroMonto(fila.pago_monto) : precioPlan,
    adeudo: estado === 'pendiente_de_pago' ? precioPlan : 0,
    pago: tienePago
      ? { id_pago: fila.pago_id, fecha_pago: fila.pago_fecha, metodo_pago: fila.pago_metodo, monto: numeroMonto(fila.pago_monto) }
      : null,
  };
}

// Pago del historial (fila de pagos + clientes + membresías/tipos + usuarios).
export function pagoPublico(fila) {
  return {
    id_pago: fila.id_pago,
    fecha_pago: fila.fecha_pago,
    cliente: { id_cliente: fila.id_cliente, nombre: fila.cliente_nombre, apellido: fila.cliente_apellido },
    membresia: { id_membresia: fila.id_membresia, plan: fila.tipo_nombre },
    monto: numeroMonto(fila.monto),
    metodo_pago: fila.metodo_pago,
    registrado_por: fila.usuario_nombre ?? null,
  };
}

// Intento de acceso. Con { basico: true } (entrenador) solo nombre, fecha, hora y resultado.
export function accesoPublico(fila, { basico = false } = {}) {
  const cliente = fila.id_cliente
    ? { id_cliente: fila.id_cliente, nombre: fila.cliente_nombre, apellido: fila.cliente_apellido }
    : null;
  const comun = { id_acceso: fila.id_acceso, fecha: fila.fecha, hora: fila.hora, resultado: fila.resultado, cliente };
  if (basico) return comun;
  return { ...comun, tipo: fila.tipo, motivo_rechazo: fila.motivo_rechazo ?? null };
}

// Rostro: SOLO datos de control. Jamás el descriptor.
export function rostroPublico(fila) {
  return { id_rostro: fila.id_rostro, fecha_registro: fila.fecha_registro, estado: fila.estado };
}

