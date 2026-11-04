import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearTipoMembresiaDePrueba,
  crearMembresiaDePrueba,
  crearDescriptorSintetico,
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// Ningún dato biométrico sale del servidor (FR-023, SC-007, T084) sobre gymaccess_test: se recorren los
// endpoints del Sprint 2 con rostros registrados de verdad y se revisa cada respuesta, de éxito o de error,
// y todo lo que se escribe en la consola mientras tanto.

describe('Ninguna respuesta ni registro de consola contiene datos biométricos', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  let cliente;
  let otro;
  let plan;
  let idMembresia;
  let idRostro;
  const usuarios = [];
  const clientes = [];
  const tipos = [];
  const descriptor = crearDescriptorSintetico(81_001);
  const consola = [];
  const originales = {};

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  // Un número del vector con 6 decimales tal como se envió (por ejemplo, "0.123456").
  const fragmentoVector = String(descriptor[5]);

  const revisar = (r, etiqueta) => {
    sinBiometria(r.cuerpo);
    assert.ok(!JSON.stringify(r.cuerpo ?? null).includes(fragmentoVector), `${etiqueta}: no repite valores del vector`);
  };

  before(async () => {
    for (const metodo of ['log', 'error', 'warn', 'info']) {
      originales[metodo] = console[metodo];
      console[metodo] = (...args) => {
        consola.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a ?? null))).join(' '));
      };
    }
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    plan = await crearTipoMembresiaDePrueba({ precio: '450.00' });
    tipos.push(plan.id_tipo_membresia);

    cliente = await crearClienteDePrueba({ nombre: 'Bio', apellido: `SinBio${process.pid}` });
    otro = await crearClienteDePrueba({ nombre: 'Baja', apellido: `SinBio${process.pid}`, estado: 'inactivo' });
    clientes.push(cliente.id_cliente, otro.id_cliente);
    idMembresia = (await crearMembresiaDePrueba({
      idCliente: cliente.id_cliente, idTipo: plan.id_tipo_membresia, inicio: await fechaRelativa(-1), fin: await fechaRelativa(28), pagada: true,
    })).id_membresia;

    const cuenta = await api('POST', '/usuarios', admin.token, {
      nombre: 'Cuenta Bio', correo: cliente.correo, password: 'Secreta123', rol: 'cliente', id_cliente: cliente.id_cliente,
    });
    usuarios.push(cuenta.cuerpo.id_usuario);
    tokenCliente = crearToken(cuenta.cuerpo.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes, tipos });
    } finally {
      Object.assign(console, originales);
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  it('registrar, consultar, reemplazar y cambiar el estado del rostro', async () => {
    const registro = await api('POST', `/clientes/${cliente.id_cliente}/rostro`, recepcion.token, { descriptor, consentimiento: true });
    assert.equal(registro.status, 201);
    revisar(registro, 'POST rostro');
    assert.deepEqual(Object.keys(registro.cuerpo).sort(), ['estado', 'fecha_registro', 'id_rostro']);
    idRostro = registro.cuerpo.id_rostro;

    revisar(await api('GET', `/clientes/${cliente.id_cliente}/rostro`, recepcion.token), 'GET rostro');
    const reemplazo = await api('POST', `/clientes/${cliente.id_cliente}/rostro`, recepcion.token, { descriptor, consentimiento: true });
    revisar(reemplazo, 'POST rostro (reemplazo)');
    idRostro = reemplazo.cuerpo.id_rostro;
    revisar(await api('PATCH', `/rostros/${idRostro}/estado`, admin.token, { estado: 'inactivo' }), 'PATCH rostro inactivo');
    revisar(await api('PATCH', `/rostros/${idRostro}/estado`, admin.token, { estado: 'activo' }), 'PATCH rostro activo');
  });

  it('identificar en la estación: autorizado y rechazado', async () => {
    const autorizado = await api('POST', '/accesos/identificar', recepcion.token, { descriptor });
    assert.equal(autorizado.status, 200);
    revisar(autorizado, 'identificar (autorizado)');
    const desconocido = await api('POST', '/accesos/identificar', recepcion.token, { descriptor: crearDescriptorSintetico(81_999) });
    revisar(desconocido, 'identificar (rechazado)');
    const salida = await api('POST', '/accesos/identificar', recepcion.token, { descriptor, tipo: 'salida' });
    assert.equal(salida.cuerpo.tipo, 'salida');
    revisar(salida, 'identificar (salida)');
  });

  it('consultas del Sprint 2 por cada rol', async () => {
    const hoy = await fechaRelativa(0);
    const consultas = [
      ['GET', `/clientes/${cliente.id_cliente}`, admin.token],
      ['GET', `/clientes/${cliente.id_cliente}/membresias`, recepcion.token],
      ['GET', `/accesos?desde=${hoy}&hasta=${hoy}`, admin.token],
      ['GET', `/accesos?desde=${hoy}&hasta=${hoy}`, entrenador.token],
      ['GET', '/pagos', recepcion.token],
      ['GET', '/adeudos', recepcion.token],
      ['GET', '/dashboard', admin.token],
      ['GET', '/resumen', admin.token],
      ['GET', '/resumen', entrenador.token],
      ['GET', '/clientes/me/resumen', tokenCliente],
      ['GET', '/tipos-membresia', admin.token],
      ['GET', '/avisos', recepcion.token],
      ['GET', '/avisos', tokenCliente],
      // Sprint 3
      ['GET', '/entrenadores', admin.token],
      ['GET', `/clientes/${cliente.id_cliente}/entrenador`, recepcion.token],
      ['GET', `/clientes/${cliente.id_cliente}/entrenamiento`, admin.token],
      ['GET', '/clientes/me/entrenamiento', tokenCliente],
      ['GET', `/accesos?desde=${hoy}&hasta=${hoy}&tipo=salida`, admin.token],
    ];
    for (const [metodo, ruta, token] of consultas) {
      const r = await api(metodo, ruta, token);
      assert.equal(r.status, 200, `${metodo} ${ruta}`);
      revisar(r, `${metodo} ${ruta}`);
    }
  });

  it('respuestas de error: validación, conflicto, permisos y no encontrado', async () => {
    const errores = [
      // Descriptor inválido (400): el mensaje nombra el campo, pero no repite los valores.
      await api('POST', '/accesos/identificar', recepcion.token, { descriptor: [...descriptor.slice(0, 127)] }),
      await api('POST', `/clientes/${cliente.id_cliente}/rostro`, recepcion.token, { descriptor: [...descriptor, 1], consentimiento: true }),
      await api('POST', `/clientes/${cliente.id_cliente}/rostro`, recepcion.token, { descriptor, consentimiento: false }),
      // Cliente dado de baja (409).
      await api('POST', `/clientes/${otro.id_cliente}/rostro`, recepcion.token, { descriptor, consentimiento: true }),
      // Permisos (403) y no encontrado (404).
      await api('POST', '/accesos/identificar', entrenador.token, { descriptor }),
      await api('PATCH', `/rostros/${idRostro}/estado`, recepcion.token, { estado: 'inactivo' }),
      await api('GET', '/clientes/999999999/rostro', admin.token),
      // Pago repetido (409).
      await api('POST', '/pagos', recepcion.token, { id_membresia: idMembresia, metodo_pago: 'efectivo', monto: 450 }),
    ];
    // En los errores de validación el detalle puede NOMBRAR el campo ("descriptor"), pero nunca su contenido.
    for (const [i, r] of errores.entries()) {
      assert.ok(r.status >= 400, `error ${i} responde ${r.status}`);
      const texto = JSON.stringify(r.cuerpo ?? null);
      assert.ok(!/descriptor_facial/i.test(texto), `error ${i}: sin la columna`);
      assert.ok(!texto.includes(fragmentoVector), `error ${i}: no repite valores del vector`);
      assert.ok(!/\[\s*-?\d+\.\d+\s*,/.test(texto), `error ${i}: sin arreglos de números`);
    }
  });

  it('la consola no recibió el descriptor ni sus valores', () => {
    const texto = consola.join('\n');
    assert.ok(!/descriptor_facial/i.test(texto), 'sin el nombre de la columna');
    assert.ok(!texto.includes(fragmentoVector), 'sin valores del vector');
  });
});
