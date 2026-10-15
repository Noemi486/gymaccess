import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearLimitador, limitarPorUsuario } from '../../src/utils/limitador.js';

function relojManual(inicio = 1_000_000) {
  let actual = inicio;
  return { ahora: () => actual, avanzar: (ms) => (actual += ms) };
}

describe('crearLimitador', () => {
  it('permite hasta el máximo y rechaza la siguiente', () => {
    const reloj = relojManual();
    const limitador = crearLimitador({ maximo: 30, ventanaMs: 60_000, ahora: reloj.ahora });
    for (let i = 0; i < 30; i += 1) assert.equal(limitador.intentar('a').permitido, true, `intento ${i + 1}`);
    const rechazo = limitador.intentar('a');
    assert.equal(rechazo.permitido, false);
    assert.ok(rechazo.reintentarEnMs > 0 && rechazo.reintentarEnMs <= 60_000);
  });

  it('vuelve a permitir cuando pasa la ventana', () => {
    const reloj = relojManual();
    const limitador = crearLimitador({ maximo: 2, ventanaMs: 1000, ahora: reloj.ahora });
    limitador.intentar('a');
    limitador.intentar('a');
    assert.equal(limitador.intentar('a').permitido, false);
    reloj.avanzar(1000);
    assert.equal(limitador.intentar('a').permitido, true);
  });

  it('la ventana se desliza: solo cuentan las peticiones recientes', () => {
    const reloj = relojManual();
    const limitador = crearLimitador({ maximo: 2, ventanaMs: 1000, ahora: reloj.ahora });
    limitador.intentar('a'); // t=0
    reloj.avanzar(600);
    limitador.intentar('a'); // t=600
    reloj.avanzar(500); // t=1100: la primera ya salió de la ventana
    assert.equal(limitador.intentar('a').permitido, true);
    assert.equal(limitador.intentar('a').permitido, false);
  });

  it('las claves son independientes', () => {
    const limitador = crearLimitador({ maximo: 1, ventanaMs: 1000, ahora: relojManual().ahora });
    assert.equal(limitador.intentar('a').permitido, true);
    assert.equal(limitador.intentar('a').permitido, false);
    assert.equal(limitador.intentar('b').permitido, true);
  });
});

describe('limitarPorUsuario (middleware)', () => {
  const ejecutar = (middleware, req) => {
    let resultado = 'no-llamado';
    middleware(req, {}, (error) => {
      resultado = error ?? 'continuar';
    });
    return resultado;
  };

  it('deja pasar hasta el máximo y responde 429 con el error estándar después', () => {
    const middleware = limitarPorUsuario(crearLimitador({ maximo: 2, ventanaMs: 60_000, ahora: relojManual().ahora }));
    const req = { usuario: { id_usuario: 5 } };
    assert.equal(ejecutar(middleware, req), 'continuar');
    assert.equal(ejecutar(middleware, req), 'continuar');
    const error = ejecutar(middleware, req);
    assert.equal(error.status, 429);
    assert.equal(error.code, 'TOO_MANY_REQUESTS');
    assert.equal(error.message, 'Demasiados intentos. Espera un momento.');
  });

  it('cada usuario tiene su propio contador', () => {
    const middleware = limitarPorUsuario(crearLimitador({ maximo: 1, ventanaMs: 60_000, ahora: relojManual().ahora }));
    assert.equal(ejecutar(middleware, { usuario: { id_usuario: 1 } }), 'continuar');
    assert.equal(ejecutar(middleware, { usuario: { id_usuario: 2 } }), 'continuar');
    assert.equal(ejecutar(middleware, { usuario: { id_usuario: 1 } }).status, 429);
  });

  it('sin usuario autenticado responde 401', () => {
    const middleware = limitarPorUsuario(crearLimitador({ maximo: 1, ventanaMs: 1000, ahora: relojManual().ahora }));
    assert.equal(ejecutar(middleware, {}).status, 401);
  });
});
