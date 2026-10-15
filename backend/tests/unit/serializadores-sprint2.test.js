import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  accesoPublico,
  membresiaPublica,
  pagoPublico,
  rostroPublico,
  tipoMembresiaPublico,
} from '../../src/utils/serializadores.js';

const HOY = '2026-10-14';

const fila = (extra = {}) => ({
  id_membresia: 12,
  id_cliente: 7,
  id_tipo_membresia: 2,
  tipo_nombre: 'Plan Mensual',
  tipo_duracion: 30,
  tipo_precio: '450.00',
  fecha_inicio: '2026-10-14',
  fecha_fin: '2026-11-12',
  estado: 'activa',
  pago_id: 31,
  pago_fecha: '2026-10-14T10:02:11',
  pago_metodo: 'efectivo',
  pago_monto: '450.00',
  ...extra,
});

describe('tipoMembresiaPublico', () => {
  it('devuelve el precio como número con dos decimales', () => {
    const salida = tipoMembresiaPublico({ id_tipo_membresia: 2, nombre: 'Plan', descripcion: null, duracion: 30, precio: '450.50', estado: 'activo', otro: 'x' });
    assert.deepEqual(salida, { id_tipo_membresia: 2, nombre: 'Plan', descripcion: null, duracion: 30, precio: 450.5, estado: 'activo' });
  });
});

describe('membresiaPublica', () => {
  it('una membresía pagada y vigente tiene precio del pago y adeudo 0', () => {
    const m = membresiaPublica(fila(), HOY);
    assert.equal(m.estado, 'vigente');
    assert.equal(m.precio, 450);
    assert.equal(m.adeudo, 0);
    assert.equal(m.dias_restantes, 29);
    assert.equal(m.por_vencer, false);
    assert.deepEqual(m.pago, { id_pago: 31, fecha_pago: '2026-10-14T10:02:11', metodo_pago: 'efectivo', monto: 450 });
    assert.deepEqual(m.tipo, { id_tipo_membresia: 2, nombre: 'Plan Mensual', duracion: 30 });
  });

  it('el precio de una pagada es lo que se pagó, aunque el plan haya cambiado de precio', () => {
    const m = membresiaPublica(fila({ tipo_precio: '600.00', pago_monto: '450.00' }), HOY);
    assert.equal(m.precio, 450);
    assert.equal(m.adeudo, 0);
  });

  it('una pendiente de pago cobra el precio vigente del plan y su adeudo es ese precio', () => {
    const m = membresiaPublica(fila({ pago_id: null, pago_fecha: null, pago_metodo: null, pago_monto: null, tipo_precio: '500.00' }), HOY);
    assert.equal(m.estado, 'pendiente_de_pago');
    assert.equal(m.precio, 500);
    assert.equal(m.adeudo, 500);
    assert.equal(m.pago, null);
  });

  it('marca por_vencer solo si está vigente con 0 a 5 días', () => {
    assert.equal(membresiaPublica(fila({ fecha_fin: '2026-10-19' }), HOY).por_vencer, true);
    assert.equal(membresiaPublica(fila({ fecha_fin: '2026-10-20' }), HOY).por_vencer, false);
  });

  it('una vencida tiene días restantes negativos y adeudo 0', () => {
    const m = membresiaPublica(fila({ fecha_fin: '2026-10-10', pago_id: null, pago_monto: null }), HOY);
    assert.equal(m.estado, 'vencida');
    assert.equal(m.dias_restantes, -4);
    assert.equal(m.adeudo, 0);
  });
});

describe('pagoPublico y accesoPublico', () => {
  it('pagoPublico agrupa cliente y membresía y devuelve el monto numérico', () => {
    const salida = pagoPublico({
      id_pago: 1, fecha_pago: '2026-10-14T10:00:00', id_cliente: 7, cliente_nombre: 'Ana', cliente_apellido: 'Pérez',
      id_membresia: 12, tipo_nombre: 'Plan Mensual', monto: '450.00', metodo_pago: 'tarjeta', usuario_nombre: 'Rita',
    });
    assert.equal(salida.monto, 450);
    assert.deepEqual(salida.cliente, { id_cliente: 7, nombre: 'Ana', apellido: 'Pérez' });
    assert.deepEqual(salida.membresia, { id_membresia: 12, plan: 'Plan Mensual' });
    assert.equal(salida.registrado_por, 'Rita');
  });

  const acceso = { id_acceso: 5, fecha: '2026-10-14', hora: '07:15:02', tipo: 'entrada', resultado: 'rechazado', motivo_rechazo: 'Pago pendiente', id_cliente: 9, cliente_nombre: 'Luis', cliente_apellido: 'Soto' };

  it('accesoPublico completo incluye tipo y motivo', () => {
    assert.deepEqual(Object.keys(accesoPublico(acceso)).sort(), ['cliente', 'fecha', 'hora', 'id_acceso', 'motivo_rechazo', 'resultado', 'tipo']);
  });

  it('accesoPublico básico (entrenador) omite tipo y motivo', () => {
    const salida = accesoPublico(acceso, { basico: true });
    assert.deepEqual(Object.keys(salida).sort(), ['cliente', 'fecha', 'hora', 'id_acceso', 'resultado']);
  });

  it('un acceso sin cliente identificado devuelve cliente null', () => {
    assert.equal(accesoPublico({ ...acceso, id_cliente: null, cliente_nombre: null, cliente_apellido: null }).cliente, null);
  });
});

describe('rostroPublico: nunca expone el descriptor', () => {
  it('devuelve solo id, fecha y estado aunque la fila traiga el descriptor', () => {
    const descriptor = Buffer.from('datos-biometricos-cifrados');
    const salida = rostroPublico({ id_rostro: 3, id_cliente: 7, descriptor_facial: descriptor, fecha_registro: '2026-10-14T09:00:00', estado: 'activo' });
    assert.deepEqual(salida, { id_rostro: 3, fecha_registro: '2026-10-14T09:00:00', estado: 'activo' });
    assert.ok(!JSON.stringify(salida).includes('descriptor'));
  });

  it('ningún serializador del Sprint 2 deja pasar un campo descriptor_facial', () => {
    const conDescriptor = { ...fila(), descriptor_facial: Buffer.from('x'), descriptor: [1, 2, 3] };
    for (const salida of [membresiaPublica(conDescriptor, HOY), accesoPublico(conDescriptor), pagoPublico({ ...conDescriptor, monto: '1.00' })]) {
      assert.ok(!JSON.stringify(salida).includes('descriptor'));
    }
  });
});
