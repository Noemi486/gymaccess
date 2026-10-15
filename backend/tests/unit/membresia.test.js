import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularFechaFin,
  cubreHoy,
  diasRestantes,
  estadoEfectivo,
  porVencer,
  sumarDias,
} from '../../src/utils/membresia.js';

const HOY = '2026-10-14';
const m = (extra = {}) => ({
  estado: 'activa',
  fecha_inicio: '2026-10-01',
  fecha_fin: '2026-11-12',
  tiene_pago: true,
  ...extra,
});

describe('estadoEfectivo: tabla de reglas (research R1)', () => {
  it('1. cancelada gana sobre todo, aunque esté pagada y dentro de fechas', () => {
    assert.equal(estadoEfectivo(m({ estado: 'cancelada' }), HOY), 'cancelada');
    assert.equal(estadoEfectivo(m({ estado: 'cancelada', fecha_fin: '2020-01-01' }), HOY), 'cancelada');
    assert.equal(estadoEfectivo(m({ estado: 'cancelada', tiene_pago: false }), HOY), 'cancelada');
  });

  it('2. suspendida gana sobre vencida, pendiente y vigente', () => {
    assert.equal(estadoEfectivo(m({ estado: 'suspendida' }), HOY), 'suspendida');
    assert.equal(estadoEfectivo(m({ estado: 'suspendida', fecha_fin: '2020-01-01' }), HOY), 'suspendida');
    assert.equal(estadoEfectivo(m({ estado: 'suspendida', tiene_pago: false }), HOY), 'suspendida');
  });

  it('3. fecha de fin anterior a hoy es vencida, aunque nadie la haya actualizado ni esté pagada', () => {
    assert.equal(estadoEfectivo(m({ fecha_fin: '2026-10-13' }), HOY), 'vencida');
    assert.equal(estadoEfectivo(m({ fecha_fin: '2026-10-13', tiene_pago: false }), HOY), 'vencida');
    // El estado guardado "vencida" (si existiera) no se usa: manda la fecha.
    assert.equal(estadoEfectivo(m({ estado: 'vencida', fecha_fin: '2026-12-01' }), HOY), 'vigente');
  });

  it('4. sin pago registrado es pendiente de pago, incluso si empieza en el futuro', () => {
    assert.equal(estadoEfectivo(m({ tiene_pago: false }), HOY), 'pendiente_de_pago');
    assert.equal(estadoEfectivo(m({ tiene_pago: false, fecha_inicio: '2026-11-13', fecha_fin: '2026-12-12' }), HOY), 'pendiente_de_pago');
  });

  it('5. pagada que empieza después de hoy es próxima (renovación futura)', () => {
    assert.equal(estadoEfectivo(m({ fecha_inicio: '2026-10-15', fecha_fin: '2026-11-13' }), HOY), 'proxima');
  });

  it('6. activa, pagada y dentro de su periodo es vigente', () => {
    assert.equal(estadoEfectivo(m(), HOY), 'vigente');
  });

  it('límites: empieza hoy es vigente; termina hoy sigue vigente; terminó ayer es vencida', () => {
    assert.equal(estadoEfectivo(m({ fecha_inicio: HOY }), HOY), 'vigente');
    assert.equal(estadoEfectivo(m({ fecha_fin: HOY }), HOY), 'vigente');
    assert.equal(estadoEfectivo(m({ fecha_fin: '2026-10-13' }), HOY), 'vencida');
    assert.equal(estadoEfectivo(m({ fecha_inicio: '2026-10-15' }), HOY), 'proxima');
  });
});

describe('diasRestantes', () => {
  it('es 0 el último día, positivo antes y negativo después', () => {
    assert.equal(diasRestantes('2026-10-14', HOY), 0);
    assert.equal(diasRestantes('2026-10-15', HOY), 1);
    assert.equal(diasRestantes('2026-11-12', HOY), 29);
    assert.equal(diasRestantes('2026-10-13', HOY), -1);
    assert.equal(diasRestantes('2026-10-04', HOY), -10);
  });

  it('cruza cambios de mes y de año y años bisiestos', () => {
    assert.equal(diasRestantes('2027-01-01', '2026-12-31'), 1);
    assert.equal(diasRestantes('2028-03-01', '2028-02-28'), 2); // 2028 es bisiesto (29 de febrero)
    assert.equal(diasRestantes('2027-03-01', '2027-02-28'), 1);
  });
});

describe('porVencer (vigente con 0 a 5 días)', () => {
  const con = (fin) => m({ fecha_fin: fin });
  it('0 a 5 días restantes es por vencer; 6 no', () => {
    assert.equal(porVencer(con('2026-10-14'), HOY), true); // vence hoy
    assert.equal(porVencer(con('2026-10-19'), HOY), true); // 5 días
    assert.equal(porVencer(con('2026-10-20'), HOY), false); // 6 días
  });

  it('una vencida no está por vencer', () => {
    assert.equal(porVencer(con('2026-10-13'), HOY), false);
  });

  it('solo las vigentes pueden estar por vencer (no pendientes, suspendidas ni próximas)', () => {
    assert.equal(porVencer(m({ fecha_fin: '2026-10-16', tiene_pago: false }), HOY), false);
    assert.equal(porVencer(m({ fecha_fin: '2026-10-16', estado: 'suspendida' }), HOY), false);
    assert.equal(porVencer(m({ fecha_inicio: '2026-10-15', fecha_fin: '2026-10-16' }), HOY), false);
  });
});

describe('fechas', () => {
  it('calcularFechaFin cuenta el día de inicio como día 1', () => {
    assert.equal(calcularFechaFin('2026-10-14', 30), '2026-11-12');
    assert.equal(calcularFechaFin('2026-10-14', 1), '2026-10-14');
    assert.equal(calcularFechaFin('2026-12-20', 30), '2027-01-18');
    assert.equal(calcularFechaFin('2028-02-01', 29), '2028-02-29');
    assert.equal(calcularFechaFin('2027-02-01', 28), '2027-02-28');
  });

  it('sumarDias suma y resta sin desfases de zona horaria', () => {
    assert.equal(sumarDias('2026-10-31', 1), '2026-11-01');
    assert.equal(sumarDias('2026-03-01', -1), '2026-02-28');
    assert.equal(sumarDias('2026-10-14', 0), '2026-10-14');
  });

  it('cubreHoy incluye los dos extremos', () => {
    assert.equal(cubreHoy({ fecha_inicio: HOY, fecha_fin: HOY }, HOY), true);
    assert.equal(cubreHoy({ fecha_inicio: '2026-10-15', fecha_fin: '2026-11-01' }, HOY), false);
    assert.equal(cubreHoy({ fecha_inicio: '2026-09-01', fecha_fin: '2026-10-13' }, HOY), false);
  });
});
