import * as auditoriaModel from '../models/auditoria.model.js';

// Auditoría de acciones importantes (FR-045, FR-046, research R12).
// - Los eventos de ÉXITO se insertan dentro de la misma transacción que la acción: si una falla, no queda la otra.
// - Los eventos de ERROR se registran aparte y nunca impiden responder.
// - Las descripciones no pueden contener datos biométricos, contraseñas ni datos sensibles.

export const MODULOS = Object.freeze({
  TIPOS_MEMBRESIA: 'tipos_membresia',
  MEMBRESIAS: 'membresias',
  PAGOS: 'pagos',
  ROSTROS: 'rostros',
});

export const ACCIONES = Object.freeze({
  [MODULOS.TIPOS_MEMBRESIA]: Object.freeze(['crear', 'modificar', 'desactivar', 'activar']),
  [MODULOS.MEMBRESIAS]: Object.freeze(['asignar', 'renovar', 'suspender', 'reactivar', 'cancelar']),
  [MODULOS.PAGOS]: Object.freeze(['registrar']),
  [MODULOS.ROSTROS]: Object.freeze(['registrar', 'reemplazar', 'desactivar', 'reactivar']),
});

const MAX_ACCION = 100;
const MAX_MODULO = 50;
const MAX_DESCRIPCION = 500;
const PALABRAS_PROHIBIDAS = /descriptor|password|contrase(ñ|n)a|token/i;

const recortar = (texto, maximo) => (texto == null ? null : String(texto).slice(0, maximo));

function normalizar({ id_usuario, accion, modulo, resultado, descripcion }) {
  if (descripcion != null && PALABRAS_PROHIBIDAS.test(String(descripcion))) {
    throw new Error('La descripción de auditoría no puede contener datos sensibles.');
  }
  return {
    id_usuario: id_usuario ?? null,
    accion: recortar(accion, MAX_ACCION),
    modulo: recortar(modulo, MAX_MODULO),
    resultado,
    descripcion: recortar(descripcion, MAX_DESCRIPCION),
  };
}

// Las dependencias se inyectan para poder probar el servicio sin base de datos.
export function crearAuditoriaService({ modelo }) {
  // Dentro de la transacción de la acción. Si falla, la transacción completa se revierte.
  async function registrarExito(conexion, datos) {
    return modelo.insertar(normalizar({ ...datos, resultado: 'exito' }), conexion);
  }

  // Fuera de la transacción: solo deja constancia; si falla escribe un aviso SIN el contenido del evento.
  async function registrarError(datos) {
    try {
      await modelo.insertar(normalizar({ ...datos, resultado: 'error' }));
    } catch {
      console.error('No se pudo registrar un evento de auditoría de error.');
    }
  }

  return { registrarExito, registrarError };
}

const servicio = crearAuditoriaService({ modelo: auditoriaModel });

export const { registrarExito, registrarError } = servicio;
