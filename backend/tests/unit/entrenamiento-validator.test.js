import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  rutinaCrearEsquema,
  objetivoCrearEsquema,
  objetivoActualizarEsquema,
  progresoCrearEsquema,
  progresoActualizarEsquema,
} from '../../src/validators/entrenamiento.validator.js';
import { entrenadorCrearEsquema, entrenadorActualizarEsquema } from '../../src/validators/entrenador.validator.js';
import { asignacionEsquema } from '../../src/validators/asignacion.validator.js';

// Validadores del Sprint 3 (spec 004, FR-001, FR-005, FR-009 a FR-014).

const campos = (r) => r.error.issues.map((i) => i.path.join('.'));
const ej = (extra = {}) => ({ nombre: 'Sentadilla', series: 4, repeticiones: '10-12', ...extra });

describe('rutinaCrearEsquema', () => {
  it('acepta una rutina válida, descarta días vacíos y ordena por día', () => {
    const r = rutinaCrearEsquema.safeParse({
      nombre: '  Fuerza  ',
      dias: [{ dia: 3, ejercicios: [ej()] }, { dia: 2, ejercicios: [] }, { dia: 1, ejercicios: [ej({ series: null, repeticiones: null, instrucciones: 'Trote suave 10 min' })] }],
    });
    assert.equal(r.success, true);
    assert.equal(r.data.nombre, 'Fuerza');
    assert.equal(r.data.indicaciones, null);
    assert.deepEqual(r.data.dias.map((d) => d.dia), [1, 3]);
    assert.equal(r.data.dias[1].ejercicios[0].peso_kg, null);
  });

  it('exige al menos un ejercicio y nombre', () => {
    assert.deepEqual(campos(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 1, ejercicios: [] }] })), ['dias']);
    assert.ok(campos(rutinaCrearEsquema.safeParse({ nombre: ' ', dias: [{ dia: 1, ejercicios: [ej()] }] })).includes('nombre'));
  });

  it('ejercicio sin series, repeticiones ni instrucciones se rechaza indicando el ejercicio', () => {
    const r = rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 1, ejercicios: [ej(), { nombre: 'Plancha' }] }] });
    assert.equal(r.success, false);
    assert.deepEqual(campos(r), ['dias.0.ejercicios.1.series']);
  });

  it('límites: día 1-7 sin repetir, 20 ejercicios por día, series 1-20, peso 0-500, descanso 0-600', () => {
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 8, ejercicios: [ej()] }] }).success, false);
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 1, ejercicios: [ej()] }, { dia: 1, ejercicios: [ej()] }] }).success, false);
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 1, ejercicios: Array.from({ length: 21 }, () => ej()) }] }).success, false);
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 1, ejercicios: [ej({ series: 21 })] }] }).success, false);
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 1, ejercicios: [ej({ peso_kg: 500.5 })] }] }).success, false);
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 1, ejercicios: [ej({ descanso_seg: 601 })] }] }).success, false);
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', dias: [{ dia: 7, ejercicios: [ej({ peso_kg: 22.5, descanso_seg: 90 })] }] }).success, true);
  });

  it('rechaza campos desconocidos', () => {
    assert.equal(rutinaCrearEsquema.safeParse({ nombre: 'X', id_entrenador: 3, dias: [{ dia: 1, ejercicios: [ej()] }] }).success, false);
  });
});

describe('objetivos', () => {
  it('crear: descripción obligatoria, meta y fecha opcionales', () => {
    const r = objetivoCrearEsquema.safeParse({ descripcion: 'Bajar 5 kg', meta: '75 kg', fecha_limite: '2027-01-31' });
    assert.equal(r.success, true);
    assert.deepEqual(objetivoCrearEsquema.parse({ descripcion: 'Correr 5 km' }), { descripcion: 'Correr 5 km', meta: null, fecha_limite: null });
    assert.equal(objetivoCrearEsquema.safeParse({ descripcion: '' }).success, false);
    assert.equal(objetivoCrearEsquema.safeParse({ descripcion: 'X', fecha_limite: '2027-02-30' }).success, false);
  });

  it('actualizar: editar o cerrar, no ambos, y al menos un campo', () => {
    const cerrar = objetivoActualizarEsquema.safeParse({ estado: 'cumplido' });
    assert.equal(cerrar.success, true);
    assert.equal(cerrar.data.meta, undefined);
    assert.equal(objetivoActualizarEsquema.safeParse({ meta: '70 kg' }).success, true);
    assert.equal(objetivoActualizarEsquema.safeParse({ estado: 'cumplido', meta: '70 kg' }).success, false);
    assert.equal(objetivoActualizarEsquema.safeParse({ estado: 'en_curso' }).success, false);
    assert.equal(objetivoActualizarEsquema.safeParse({}).success, false);
  });
});

describe('avances', () => {
  it('al menos un dato, rangos y decimales', () => {
    assert.equal(progresoCrearEsquema.safeParse({ fecha: '2026-11-03', peso_kg: 78.4 }).success, true);
    assert.equal(progresoCrearEsquema.safeParse({ fecha: '2026-11-03', comentario: 'Buena técnica' }).success, true);
    assert.deepEqual(campos(progresoCrearEsquema.safeParse({ fecha: '2026-11-03', comentario: '  ' })), ['peso_kg']);
    assert.ok(campos(progresoCrearEsquema.safeParse({ fecha: '2026-11-03', peso_kg: 19.9 })).includes('peso_kg'));
    assert.ok(campos(progresoCrearEsquema.safeParse({ fecha: '2026-11-03', grasa_pct: 71 })).includes('grasa_pct'));
    assert.ok(campos(progresoCrearEsquema.safeParse({ fecha: '2026-11-03', cintura_cm: 29 })).includes('cintura_cm'));
    assert.ok(campos(progresoCrearEsquema.safeParse({ fecha: '2026-11-03', grasa_pct: 20.25 })).includes('grasa_pct'));
    assert.equal(progresoCrearEsquema.safeParse({ peso_kg: 70 }).success, false, 'fecha obligatoria');
  });

  it('corrección: campos opcionales, null borra un dato', () => {
    const r = progresoActualizarEsquema.safeParse({ peso_kg: null, comentario: 'Corregido' });
    assert.equal(r.success, true);
    assert.equal(r.data.peso_kg, null);
    assert.equal(r.data.grasa_pct, undefined, 'lo no enviado no se toca');
    assert.equal(progresoActualizarEsquema.safeParse({ id_entrenador: 2 }).success, false);
    assert.equal(progresoActualizarEsquema.safeParse({}).success, false);
  });
});

describe('entrenadores y asignación', () => {
  it('alta con política de contraseña; vacíos opcionales quedan en null', () => {
    const r = entrenadorCrearEsquema.safeParse({ nombre: 'Luis', correo: 'LUIS@Gym.com', password: 'Secreta123', telefono: '', especialidad: 'Fuerza' });
    assert.equal(r.success, true);
    assert.equal(r.data.correo, 'luis@gym.com');
    assert.equal(r.data.telefono, null);
    assert.ok(campos(entrenadorCrearEsquema.safeParse({ nombre: 'Luis', correo: 'l@g.com', password: 'corta' })).includes('password'));
    assert.ok(campos(entrenadorCrearEsquema.safeParse({ nombre: 'Luis', correo: 'l@g.com', password: 'Secreta123', telefono: 'abc' })).includes('telefono'));
  });

  it('edición sin campos o con rol se rechaza', () => {
    assert.equal(entrenadorActualizarEsquema.safeParse({}).success, false);
    assert.equal(entrenadorActualizarEsquema.safeParse({ rol: 'administrador' }).success, false);
    assert.equal(entrenadorActualizarEsquema.safeParse({ especialidad: 'Yoga' }).success, true);
  });

  it('asignación: id positivo o null', () => {
    assert.equal(asignacionEsquema.safeParse({ id_entrenador: 4 }).success, true);
    assert.equal(asignacionEsquema.safeParse({ id_entrenador: null }).success, true);
    assert.equal(asignacionEsquema.safeParse({ id_entrenador: 0 }).success, false);
    assert.equal(asignacionEsquema.safeParse({}).success, false);
  });
});
