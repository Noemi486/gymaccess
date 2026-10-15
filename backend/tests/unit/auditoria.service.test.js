import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCIONES, MODULOS, crearAuditoriaService } from '../../src/services/auditoria.service.js';

function crearModeloSimulado({ falla = false } = {}) {
  const llamadas = [];
  return {
    llamadas,
    async insertar(datos, conexion) {
      if (falla) throw new Error('fallo de base de datos con detalles internos');
      llamadas.push({ datos, conexion });
      return llamadas.length;
    },
  };
}

describe('auditoria.service', () => {
  it('el éxito se inserta con la conexión de la transacción y resultado "exito"', async () => {
    const modelo = crearModeloSimulado();
    const servicio = crearAuditoriaService({ modelo });
    const conexion = { id: 'tx' };

    await servicio.registrarExito(conexion, {
      id_usuario: 4,
      accion: 'asignar',
      modulo: 'membresias',
      descripcion: 'Membresía 12 asignada al cliente 7.',
    });

    assert.equal(modelo.llamadas.length, 1);
    assert.equal(modelo.llamadas[0].conexion, conexion);
    assert.deepEqual(modelo.llamadas[0].datos, {
      id_usuario: 4,
      accion: 'asignar',
      modulo: 'membresias',
      resultado: 'exito',
      descripcion: 'Membresía 12 asignada al cliente 7.',
    });
  });

  it('el error se registra con resultado "error" y sin conexión de transacción', async () => {
    const modelo = crearModeloSimulado();
    await crearAuditoriaService({ modelo }).registrarError({ id_usuario: 4, accion: 'registrar', modulo: 'pagos', descripcion: 'Monto incorrecto.' });
    assert.equal(modelo.llamadas[0].datos.resultado, 'error');
    assert.equal(modelo.llamadas[0].conexion, undefined);
  });

  it('un fallo al registrar un error no se propaga ni filtra el contenido', async () => {
    const original = console.error;
    const mensajes = [];
    console.error = (...args) => mensajes.push(args.join(' '));
    try {
      await crearAuditoriaService({ modelo: crearModeloSimulado({ falla: true }) }).registrarError({
        accion: 'registrar',
        modulo: 'pagos',
        descripcion: 'dato',
      });
    } finally {
      console.error = original;
    }
    assert.equal(mensajes.length, 1);
    assert.ok(!mensajes[0].includes('detalles internos'));
    assert.ok(!mensajes[0].includes('dato'));
  });

  it('un fallo al registrar un éxito SÍ se propaga (para revertir la transacción)', async () => {
    const servicio = crearAuditoriaService({ modelo: crearModeloSimulado({ falla: true }) });
    await assert.rejects(servicio.registrarExito({}, { accion: 'crear', modulo: 'tipos_membresia' }));
  });

  it('recorta accion a 100, modulo a 50 y descripcion a 500 caracteres', async () => {
    const modelo = crearModeloSimulado();
    await crearAuditoriaService({ modelo }).registrarExito({}, {
      accion: 'a'.repeat(300),
      modulo: 'm'.repeat(300),
      descripcion: 'd'.repeat(900),
    });
    const { datos } = modelo.llamadas[0];
    assert.equal(datos.accion.length, 100);
    assert.equal(datos.modulo.length, 50);
    assert.equal(datos.descripcion.length, 500);
  });

  it('rechaza descripciones con datos sensibles (descriptor, contraseña, token)', async () => {
    const servicio = crearAuditoriaService({ modelo: crearModeloSimulado() });
    for (const texto of ['guardó el descriptor facial', 'cambió la contraseña', 'token abc', 'password nueva']) {
      await assert.rejects(servicio.registrarExito({}, { accion: 'x', modulo: 'y', descripcion: texto }), /datos sensibles/, texto);
    }
  });

  it('acepta una descripción vacía o ausente y un usuario nulo', async () => {
    const modelo = crearModeloSimulado();
    await crearAuditoriaService({ modelo }).registrarExito({}, { accion: 'crear', modulo: 'pagos' });
    assert.equal(modelo.llamadas[0].datos.descripcion, null);
    assert.equal(modelo.llamadas[0].datos.id_usuario, null);
  });

  it('expone los módulos y acciones definidos en data-model.md', () => {
    assert.deepEqual(ACCIONES[MODULOS.TIPOS_MEMBRESIA], ['crear', 'modificar', 'desactivar', 'activar']);
    assert.deepEqual(ACCIONES[MODULOS.MEMBRESIAS], ['asignar', 'renovar', 'suspender', 'reactivar', 'cancelar']);
    assert.deepEqual(ACCIONES[MODULOS.PAGOS], ['registrar']);
    assert.deepEqual(ACCIONES[MODULOS.ROSTROS], ['registrar', 'reemplazar', 'desactivar', 'reactivar']);
  });
});
