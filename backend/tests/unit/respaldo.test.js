import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ejecutarRespaldo, leerConfigRespaldo, nombreRespaldo, PATRON_RESPALDO } from '../../src/utils/respaldo.js';

// Respaldo diario (US13, FR-059 a FR-063, SC-020, SC-021). Sin MySQL: mysqldump se simula y los archivos
// se escriben en una carpeta temporal que se borra al terminar cada prueba.

const PASSWORD = 'Cl@ve"Resp\\aldo-123';
const VALIDO = '-- MySQL dump\nCREATE TABLE clientes (id INT);\nINSERT INTO clientes VALUES (1);\n-- Dump completed on 2026-11-03 23:00:01\n';

describe('respaldo de la base local', () => {
  let dir;
  let temporal;
  let config;

  // mysqldump simulado: escribe `contenido` en el --result-file y responde `codigo`. Guarda lo recibido.
  const simulado = ({ codigo = 0, contenido = VALIDO, error = '' } = {}) => {
    const llamada = {};
    const ejecutar = async (comando, args) => {
      llamada.comando = comando;
      llamada.args = args;
      const opciones = args[0].replace('--defaults-extra-file=', '');
      llamada.opciones = await readFile(opciones, 'utf8');
      llamada.rutaOpciones = opciones;
      const destino = args.find((a) => a.startsWith('--result-file=')).replace('--result-file=', '');
      if (contenido !== null) await writeFile(destino, contenido);
      return { codigo, error };
    };
    return { ejecutar, llamada };
  };
  const archivos = async () => (await readdir(dir)).sort();
  const bitacora = async () => readFile(path.join(dir, 'respaldos.log'), 'utf8');

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'gym-respaldos-'));
    temporal = await mkdtemp(path.join(tmpdir(), 'gym-opciones-'));
    config = leerConfigRespaldo({ RESPALDO_DB_USER: 'gymaccess_respaldo', RESPALDO_DB_PASSWORD: PASSWORD, RESPALDO_DIR: dir, DB_USER: 'gymaccess_app' });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    await rm(temporal, { recursive: true, force: true });
  });

  it('nombre gymaccess_AAAA-MM-DD_HHMM.sql con la hora local', () => {
    assert.equal(nombreRespaldo(new Date(2026, 10, 3, 23, 5)), 'gymaccess_2026-11-03_2305.sql');
    assert.match(nombreRespaldo(), PATRON_RESPALDO);
  });

  it('crea el respaldo con la contraseña fuera de los argumentos y borra el archivo de opciones', async () => {
    const { ejecutar, llamada } = simulado();
    const r = await ejecutarRespaldo({ config, ahora: new Date(2026, 10, 3, 23, 0), ejecutar, dirTemporal: temporal });
    assert.equal(r.ok, true);
    assert.deepEqual(await archivos(), ['gymaccess_2026-11-03_2300.sql', 'respaldos.log']);
    assert.equal(await readFile(path.join(dir, 'gymaccess_2026-11-03_2300.sql'), 'utf8'), VALIDO);

    assert.equal(llamada.comando, 'mysqldump');
    assert.ok(llamada.args[0].startsWith('--defaults-extra-file='), 'el archivo de opciones va primero');
    assert.ok(!llamada.args.join(' ').includes(PASSWORD), 'sin contraseña en los argumentos');
    assert.ok(llamada.args.includes('--user=gymaccess_respaldo'));
    assert.ok(llamada.args.includes('--single-transaction'));
    assert.ok(!llamada.args.includes('--databases'), 'sin CREATE DATABASE: se restaura en la base que se elija');
    assert.equal(llamada.args.at(-2), 'gymaccess');
    assert.equal(llamada.opciones, '[client]\npassword="Cl@ve\\"Resp\\\\aldo-123"\n');
    await assert.rejects(stat(llamada.rutaOpciones), 'el archivo de opciones ya no existe');

    const log = await bitacora();
    assert.match(log, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \| exito \| gymaccess_2026-11-03_2300\.sql \| \d+ bytes\n$/);
    assert.ok(!log.includes(PASSWORD));
  });

  it('tras 8 respaldos quedan exactamente los 7 más recientes (SC-020)', async () => {
    await writeFile(path.join(dir, 'notas.txt'), 'no es un respaldo');
    for (let dia = 1; dia <= 8; dia += 1) {
      const r = await ejecutarRespaldo({ config, ahora: new Date(2026, 10, dia, 23, 0), ejecutar: simulado().ejecutar, dirTemporal: temporal });
      assert.equal(r.ok, true);
    }
    const sql = (await archivos()).filter((n) => n.endsWith('.sql'));
    assert.equal(sql.length, 7);
    assert.equal(sql[0], 'gymaccess_2026-11-02_2300.sql');
    assert.equal(sql.at(-1), 'gymaccess_2026-11-08_2300.sql');
    assert.ok((await archivos()).includes('notas.txt'), 'no toca archivos que no son respaldos');
    assert.match(await bitacora(), /se eliminaron 1 respaldos antiguos/);
  });

  it('si mysqldump falla: no borra respaldos, no deja el parcial y anota el error sin la contraseña', async () => {
    for (let dia = 1; dia <= 7; dia += 1) {
      await ejecutarRespaldo({ config, ahora: new Date(2026, 10, dia, 23, 0), ejecutar: simulado().ejecutar, dirTemporal: temporal });
    }
    const { ejecutar } = simulado({
      codigo: 2, contenido: '-- MySQL dump\nCREATE TAB', error: `mysqldump: Got error: 1045: Access denied for user 'gymaccess_respaldo'@'localhost' (using password: ${PASSWORD})`,
    });
    const r = await ejecutarRespaldo({ config, ahora: new Date(2026, 10, 8, 23, 0), ejecutar, dirTemporal: temporal });
    assert.equal(r.ok, false);
    const lista = await archivos();
    assert.equal(lista.filter((n) => n.endsWith('.sql')).length, 7);
    assert.ok(!lista.some((n) => n.endsWith('.parcial')));
    const log = await bitacora();
    assert.match(log, /\| error \| mysqldump: Got error: 1045: Access denied/);
    assert.ok(!log.includes(PASSWORD));
    assert.ok(!r.mensaje.includes(PASSWORD));
    assert.deepEqual(await readdir(temporal), [], 'sin archivo de opciones');
  });

  it('un archivo sin la marca final de mysqldump se descarta como incompleto', async () => {
    const r = await ejecutarRespaldo({ config, ejecutar: simulado({ contenido: '-- MySQL dump\nINSERT INTO' }).ejecutar, dirTemporal: temporal });
    assert.equal(r.ok, false);
    assert.equal(r.mensaje, 'El respaldo quedó incompleto y se descartó.');
    assert.deepEqual(await archivos(), ['respaldos.log']);
  });

  it('mysqldump no encontrado: mensaje que indica MYSQLDUMP_PATH', async () => {
    const r = await ejecutarRespaldo({ config, ejecutar: async () => ({ codigo: -1, error: 'ENOENT' }), dirTemporal: temporal });
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /MYSQLDUMP_PATH/);
  });

  it('carpeta de respaldo inexistente: error claro y no se ejecuta mysqldump', async () => {
    let ejecutado = false;
    const r = await ejecutarRespaldo({
      config: { ...config, dir: path.join(dir, 'no-existe') },
      ejecutar: async () => { ejecutado = true; return { codigo: 0 }; },
      dirTemporal: temporal,
    });
    assert.equal(r.ok, false);
    assert.match(r.mensaje, /no existe/);
    assert.equal(ejecutado, false);
  });

  it('configuración: variables faltantes y usuarios no permitidos', () => {
    assert.throws(() => leerConfigRespaldo({}), /RESPALDO_DB_USER, RESPALDO_DB_PASSWORD, RESPALDO_DIR/);
    const base = { RESPALDO_DB_PASSWORD: 'x', RESPALDO_DIR: dir, DB_USER: 'gymaccess_app' };
    assert.throws(() => leerConfigRespaldo({ ...base, RESPALDO_DB_USER: 'root' }), /usuario exclusivo/);
    assert.throws(() => leerConfigRespaldo({ ...base, RESPALDO_DB_USER: 'gymaccess_app' }), /usuario exclusivo/);
    const c = leerConfigRespaldo({ ...base, RESPALDO_DB_USER: 'gymaccess_respaldo', MYSQLDUMP_PATH: 'C:\\MySQL\\bin\\mysqldump.exe' });
    assert.equal(c.mysqldump, 'C:\\MySQL\\bin\\mysqldump.exe');
    assert.equal(c.base, 'gymaccess');
  });
});
