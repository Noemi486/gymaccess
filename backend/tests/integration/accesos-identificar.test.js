import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../src/config/db.js';
import {
  iniciarServidor,
  solicitar,
  crearToken,
  crearUsuarioConRol,
  crearClienteDePrueba,
  crearTipoMembresiaDePrueba,
  crearMembresiaDePrueba,
  crearDescriptorSintetico,
  descriptorCercano,
  fechaRelativa,
  limpiarDatosDePrueba,
  cerrarPool,
  sinBiometria,
} from '../helpers.js';

// Identificación facial y control de acceso con descriptores sintéticos (gymaccess_test).

describe('POST /accesos/identificar', () => {
  let servidor;
  let admin;
  let recepcion;
  let entrenador;
  let tokenCliente;
  let tipo;
  const usuarios = [];
  const clientes = [];
  let semilla = 5_000_000 + (process.pid % 1000) * 100;

  const api = (metodo, ruta, token, cuerpo) => solicitar(servidor.url, metodo, ruta, { token, cuerpo });
  const identificar = (descriptor, token = recepcion.token) => api('POST', '/accesos/identificar', token, { descriptor });
  const filaDe = async (idAcceso) => {
    const [[fila]] = await pool.execute('SELECT * FROM accesos WHERE id_acceso = ?', [idAcceso]);
    return fila;
  };
  const totalAccesos = async () => {
    const [[f]] = await pool.execute('SELECT COUNT(*) AS n FROM accesos');
    return Number(f.n);
  };

  // Cliente con rostro registrado (por la API) y, si se pide, una membresía con fechas relativas a hoy.
  async function crearCliente({ membresia = null, estado = 'activo', descriptor = crearDescriptorSintetico((semilla += 1)) } = {}) {
    const cliente = await crearClienteDePrueba({ estado: 'activo' });
    clientes.push(cliente.id_cliente);
    const registro = await api('POST', `/clientes/${cliente.id_cliente}/rostro`, recepcion.token, { descriptor, consentimiento: true });
    assert.equal(registro.status, 201);
    for (const m of [membresia].flat().filter(Boolean)) {
      await crearMembresiaDePrueba({
        idCliente: cliente.id_cliente,
        idTipo: tipo.id_tipo_membresia,
        inicio: await fechaRelativa(m.inicio),
        fin: await fechaRelativa(m.fin),
        estado: m.estado ?? 'activa',
        pagada: m.pagada ?? false,
      });
    }
    if (estado !== 'activo') await pool.execute('UPDATE clientes SET estado = ? WHERE id_cliente = ?', [estado, cliente.id_cliente]);
    return { ...cliente, descriptor };
  }

  // Presenta al cliente y comprueba el rechazo con su motivo exacto y la fila registrada.
  async function esperarRechazo(cliente, motivo) {
    const r = await identificar(cliente.descriptor);
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.resultado, 'rechazado');
    assert.equal(r.cuerpo.motivo, motivo);
    assert.equal(r.cuerpo.cliente.id_cliente, cliente.id_cliente);
    sinBiometria(r.cuerpo);
    const fila = await filaDe(r.cuerpo.id_acceso);
    assert.equal(fila.id_cliente, cliente.id_cliente);
    assert.equal(fila.resultado, 'rechazado');
    assert.equal(fila.motivo_rechazo, motivo);
    assert.equal(fila.tipo, 'entrada');
    return r;
  }

  before(async () => {
    servidor = await iniciarServidor();
    admin = await crearUsuarioConRol('administrador');
    recepcion = await crearUsuarioConRol('recepcionista');
    entrenador = await crearUsuarioConRol('entrenador');
    usuarios.push(admin.id_usuario, recepcion.id_usuario, entrenador.id_usuario);
    tipo = await crearTipoMembresiaDePrueba({ precio: '450.00', duracion: 30 });
    const dueno = await crearClienteDePrueba();
    clientes.push(dueno.id_cliente);
    const cuenta = await api('POST', '/usuarios', admin.token, {
      nombre: 'Cliente accesos',
      correo: dueno.correo,
      password: 'Secreta123',
      rol: 'cliente',
      id_cliente: dueno.id_cliente,
    });
    usuarios.push(cuenta.cuerpo.id_usuario);
    tokenCliente = crearToken(cuenta.cuerpo.id_usuario);
  });

  after(async () => {
    try {
      await limpiarDatosDePrueba({ usuarios, clientes, tipos: [tipo?.id_tipo_membresia].filter(Boolean) });
    } finally {
      await servidor.cerrar();
      await cerrarPool();
    }
  });

  describe('autorizado', () => {
    it('cliente al corriente: 200 autorizado con nombre, plan, fecha_fin y días restantes, y UNA fila nueva', async () => {
      const c = await crearCliente({ membresia: { inicio: -5, fin: 24, pagada: true } });
      const antes = await totalAccesos();
      const r = await identificar(c.descriptor);
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.resultado, 'autorizado');
      assert.deepEqual(r.cuerpo.cliente, { id_cliente: c.id_cliente, nombre: c.nombre, apellido: c.apellido });
      assert.equal(r.cuerpo.membresia.plan, tipo.nombre);
      assert.equal(r.cuerpo.membresia.fecha_fin, await fechaRelativa(24));
      assert.equal(r.cuerpo.membresia.dias_restantes, 24);
      sinBiometria(r.cuerpo);

      const fila = await filaDe(r.cuerpo.id_acceso);
      assert.equal(fila.id_cliente, c.id_cliente);
      assert.equal(fila.tipo, 'entrada');
      assert.equal(fila.resultado, 'autorizado');
      assert.equal(fila.motivo_rechazo, null);
      assert.ok(fila.fecha && fila.hora);
      assert.equal((await totalAccesos()) - antes >= 1, true);
      const [[mias]] = await pool.execute('SELECT COUNT(*) AS n FROM accesos WHERE id_cliente = ?', [c.id_cliente]);
      assert.equal(Number(mias.n), 1);
    });

    it('el último día de la membresía todavía entra (0 días restantes)', async () => {
      const c = await crearCliente({ membresia: { inicio: -29, fin: 0, pagada: true } });
      const r = await identificar(c.descriptor);
      assert.equal(r.cuerpo.resultado, 'autorizado');
      assert.equal(r.cuerpo.membresia.dias_restantes, 0);
    });

    it('vigente pagada con una renovación futura impaga: autorizado', async () => {
      const c = await crearCliente({
        membresia: [
          { inicio: -5, fin: 24, pagada: true },
          { inicio: 25, fin: 54, pagada: false },
        ],
      });
      const r = await identificar(c.descriptor);
      assert.equal(r.cuerpo.resultado, 'autorizado');
      assert.equal(r.cuerpo.membresia.dias_restantes, 24);
    });

    it('el administrador también puede identificar', async () => {
      const c = await crearCliente({ membresia: { inicio: -1, fin: 28, pagada: true } });
      const r = await identificar(c.descriptor, admin.token);
      assert.equal(r.cuerpo.resultado, 'autorizado');
    });
  });

  describe('rechazos con cliente identificado (motivo exacto)', () => {
    it('Pago pendiente: la membresía cubre hoy pero no tiene pago', async () => {
      const c = await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: false } });
      await esperarRechazo(c, 'Pago pendiente');
    });

    it('Membresía vencida', async () => {
      const c = await crearCliente({ membresia: { inicio: -31, fin: -1, pagada: true } });
      await esperarRechazo(c, 'Membresía vencida');
    });

    it('Membresía suspendida', async () => {
      const c = await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true, estado: 'suspendida' } });
      await esperarRechazo(c, 'Membresía suspendida');
    });

    it('Membresía cancelada', async () => {
      const c = await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true, estado: 'cancelada' } });
      await esperarRechazo(c, 'Membresía cancelada');
    });

    it('Sin membresía: nunca tuvo una', async () => {
      const c = await crearCliente();
      await esperarRechazo(c, 'Sin membresía');
    });

    it('Sin membresía: solo tiene una que todavía no empieza', async () => {
      const c = await crearCliente({ membresia: { inicio: 3, fin: 32, pagada: true } });
      await esperarRechazo(c, 'Sin membresía');
    });

    it('Cliente dado de baja (aunque su membresía esté vigente)', async () => {
      const c = await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true }, estado: 'inactivo' });
      await esperarRechazo(c, 'Cliente dado de baja');
    });

    it('con una vencida y una vigente pagada, decide la que cubre hoy', async () => {
      const c = await crearCliente({
        membresia: [
          { inicio: -70, fin: -41, pagada: true },
          { inicio: -5, fin: 24, pagada: true },
        ],
      });
      const r = await identificar(c.descriptor);
      assert.equal(r.cuerpo.resultado, 'autorizado');
    });
  });

  describe('Rostro no reconocido (sin cliente asociado)', () => {
    async function esperarNoReconocido(descriptor) {
      const r = await identificar(descriptor);
      assert.equal(r.status, 200);
      assert.equal(r.cuerpo.resultado, 'rechazado');
      assert.equal(r.cuerpo.motivo, 'Rostro no reconocido');
      assert.ok(!('cliente' in r.cuerpo), 'no debe incluir cliente');
      sinBiometria(r.cuerpo);
      const fila = await filaDe(r.cuerpo.id_acceso);
      assert.equal(fila.id_cliente, null);
      assert.equal(fila.resultado, 'rechazado');
      assert.equal(fila.motivo_rechazo, 'Rostro no reconocido');
    }

    it('un rostro que no coincide con nadie', async () => {
      await esperarNoReconocido(crearDescriptorSintetico((semilla += 1)));
    });

    it('un rostro a distancia mayor que 0,5 no coincide', async () => {
      const c = await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true } });
      await esperarNoReconocido(descriptorCercano(c.descriptor, 0.51));
    });

    it('un rostro justo dentro del umbral (distancia 0,499) sí coincide', async () => {
      const c = await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true } });
      const r = await identificar(descriptorCercano(c.descriptor, 0.499));
      assert.equal(r.cuerpo.resultado, 'autorizado');
      assert.equal(r.cuerpo.cliente.id_cliente, c.id_cliente);
    });

    it('una coincidencia ambigua con dos clientes se trata como no reconocido', async () => {
      const base = crearDescriptorSintetico((semilla += 1));
      await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true }, descriptor: base });
      await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true }, descriptor: descriptorCercano(base, 0.3) });
      await esperarNoReconocido(descriptorCercano(base, 0.15));
    });

    it('un rostro inactivo no coincide', async () => {
      const c = await crearCliente({ membresia: { inicio: -2, fin: 27, pagada: true } });
      const consulta = await api('GET', `/clientes/${c.id_cliente}/rostro`, admin.token);
      const desactivado = await api('PATCH', `/rostros/${consulta.cuerpo.activo.id_rostro}/estado`, admin.token, { estado: 'inactivo' });
      assert.equal(desactivado.status, 200);
      await esperarNoReconocido(c.descriptor);
    });
  });

  describe('peticiones inválidas, permisos y límite', () => {
    it('un descriptor inválido responde 400 y no registra ningún acceso', async () => {
      const antes = await totalAccesos();
      for (const cuerpo of [{}, { descriptor: [1, 2, 3] }, { descriptor: 'x' }, { descriptor: new Array(128).fill(0) }, { descriptor: crearDescriptorSintetico(1), imagen: 'data:...' }]) {
        const r = await api('POST', '/accesos/identificar', recepcion.token, cuerpo);
        assert.equal(r.status, 400); // el mensaje de error nombra el campo, pero nunca repite valores
        assert.ok(!JSON.stringify(r.cuerpo).includes('0.123456'));
      }
      assert.equal(await totalAccesos(), antes);
    });

    it('sin sesión 401; entrenador y cliente 403', async () => {
      const descriptor = crearDescriptorSintetico((semilla += 1));
      assert.equal((await identificar(descriptor, null)).status, 401);
      assert.equal((await identificar(descriptor, entrenador.token)).status, 403);
      assert.equal((await identificar(descriptor, tokenCliente)).status, 403);
    });

    it('más de 30 peticiones por minuto de un mismo usuario responden 429', async () => {
      const operador = await crearUsuarioConRol('recepcionista');
      usuarios.push(operador.id_usuario);
      for (let i = 1; i <= 30; i += 1) {
        const r = await api('POST', '/accesos/identificar', operador.token, {}); // 400, pero cuenta para el límite
        assert.equal(r.status, 400, `petición ${i}`);
      }
      const r = await api('POST', '/accesos/identificar', operador.token, {});
      assert.equal(r.status, 429);
      // Otro usuario no se ve afectado.
      assert.equal((await identificar(crearDescriptorSintetico((semilla += 1)))).status, 200);
    });
  });
});
