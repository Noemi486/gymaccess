import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { conDiferencias } from '../../src/utils/progreso.js';

// Diferencias del historial de avances (spec 004, FR-015).
describe('conDiferencias', () => {
  it('compara cada medida con el avance anterior que la tenga, saltando los que no', () => {
    const avances = [
      { id: 3, peso_kg: '78.40', grasa_pct: null, cintura_cm: '88.0' },
      { id: 2, peso_kg: null, grasa_pct: '22.5', cintura_cm: null },
      { id: 1, peso_kg: '80.00', grasa_pct: '24.0', cintura_cm: '90.5' },
    ];
    const r = conDiferencias(avances);
    assert.deepEqual(r[0].diferencias, { peso_kg: -1.6, grasa_pct: null, cintura_cm: -2.5 });
    assert.deepEqual(r[1].diferencias, { peso_kg: null, grasa_pct: -1.5, cintura_cm: null });
    assert.deepEqual(r[2].diferencias, { peso_kg: null, grasa_pct: null, cintura_cm: null });
    assert.equal(r[0].id, 3, 'conserva los demás campos y el orden');
  });

  it('lista vacía y un solo avance', () => {
    assert.deepEqual(conDiferencias([]), []);
    assert.deepEqual(conDiferencias([{ peso_kg: 70 }])[0].diferencias, { peso_kg: null, grasa_pct: null, cintura_cm: null });
  });

  it('sin errores de punto flotante', () => {
    const r = conDiferencias([{ peso_kg: 70.3 }, { peso_kg: 70.1 }]);
    assert.equal(r[0].diferencias.peso_kg, 0.2);
  });
});
