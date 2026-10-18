import * as clienteModeloReal from '../models/cliente.model.js';
import * as accesoModeloReal from '../models/acceso.model.js';
import * as fechaModeloReal from '../models/fecha.model.js';
import * as membresiaModeloReal from '../models/membresia.model.js';
import * as rostrosServicioReal from './rostros.service.js';
import { cubreHoy, diasRestantes, estadoEfectivo } from '../utils/membresia.js';

// Motivos exactos de rechazo (se guardan y se muestran tal cual).
export const MOTIVOS = {
  NO_RECONOCIDO: 'Rostro no reconocido',
  BAJA: 'Cliente dado de baja',
  SIN_MEMBRESIA: 'Sin membresía',
  PAGO_PENDIENTE: 'Pago pendiente',
  VENCIDA: 'Membresía vencida',
  SUSPENDIDA: 'Membresía suspendida',
  CANCELADA: 'Membresía cancelada',
};

const MOTIVO_POR_ESTADO = {
  pendiente_de_pago: MOTIVOS.PAGO_PENDIENTE,
  vencida: MOTIVOS.VENCIDA,
  suspendida: MOTIVOS.SUSPENDIDA,
  cancelada: MOTIVOS.CANCELADA,
};

// Entre las que cubren hoy se prefiere la que permite el acceso y luego la más "viva".
const PRIORIDAD = { vigente: 0, pendiente_de_pago: 1, suspendida: 2, cancelada: 3 };

// Control de acceso: decide con lo que ya existe (cliente y membresía) y registra SIEMPRE un acceso.
// No sabe cómo se reconoce el rostro: solo le pide a `rostros.encontrarCoincidencia` quién es.
export function crearAccesosService({
  rostros = rostrosServicioReal,
  clienteModelo = clienteModeloReal,
  membresiaModelo = membresiaModeloReal,
  fechaModelo = fechaModeloReal,
  accesoModelo = accesoModeloReal,
} = {}) {
  const estadoDe = (fila, hoy) =>
    estadoEfectivo({ estado: fila.estado, fecha_inicio: fila.fecha_inicio, fecha_fin: fila.fecha_fin, tiene_pago: fila.pago_id != null }, hoy);

  // Membresía "en curso": la que cubre hoy; si ninguna, la más reciente que ya haya empezado.
  // Una renovación futura (todavía no empieza) no cuenta.
  function membresiaEnCurso(filas, hoy) {
    const cubren = filas.filter((fila) => cubreHoy(fila, hoy));
    if (cubren.length > 0) {
      return [...cubren].sort((a, b) => (PRIORIDAD[estadoDe(a, hoy)] ?? 9) - (PRIORIDAD[estadoDe(b, hoy)] ?? 9))[0];
    }
    return filas.find((fila) => fila.fecha_inicio <= hoy) ?? null;
  }

  async function rechazar(cliente, motivo) {
    const id_acceso = await accesoModelo.insertar({ id_cliente: cliente?.id_cliente ?? null, resultado: 'rechazado', motivo_rechazo: motivo });
    const respuesta = { resultado: 'rechazado', id_acceso, motivo };
    if (cliente) respuesta.cliente = { id_cliente: cliente.id_cliente, nombre: cliente.nombre, apellido: cliente.apellido };
    return respuesta;
  }

  // POST /accesos/identificar. El descriptor ya viene validado; nunca se guarda ni se devuelve.
  async function identificar(descriptor) {
    const coincidencia = await rostros.encontrarCoincidencia(descriptor);
    if (coincidencia.tipo !== 'clara') return rechazar(null, MOTIVOS.NO_RECONOCIDO);

    const cliente = await clienteModelo.buscarPorId(coincidencia.id_cliente);
    if (!cliente) return rechazar(null, MOTIVOS.NO_RECONOCIDO);
    if (cliente.estado !== 'activo') return rechazar(cliente, MOTIVOS.BAJA);

    const hoy = await fechaModelo.obtenerHoy();
    const actual = membresiaEnCurso(await membresiaModelo.listarPorCliente(cliente.id_cliente), hoy);
    if (!actual) return rechazar(cliente, MOTIVOS.SIN_MEMBRESIA);

    const estado = estadoDe(actual, hoy);
    if (estado !== 'vigente') return rechazar(cliente, MOTIVO_POR_ESTADO[estado] ?? MOTIVOS.SIN_MEMBRESIA);

    const id_acceso = await accesoModelo.insertar({ id_cliente: cliente.id_cliente, resultado: 'autorizado' });
    return {
      resultado: 'autorizado',
      id_acceso,
      cliente: { id_cliente: cliente.id_cliente, nombre: cliente.nombre, apellido: cliente.apellido },
      membresia: { plan: actual.tipo_nombre, fecha_fin: actual.fecha_fin, dias_restantes: diasRestantes(actual.fecha_fin, hoy) },
    };
  }

  return { identificar };
}

export const { identificar } = crearAccesosService();
