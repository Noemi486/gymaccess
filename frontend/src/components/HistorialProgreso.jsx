import { useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { formatearFechaCorta } from '../utils/formato.js';
import Button from './ui/Button.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';
import Table from './ui/Table.jsx';
import EmptyState from './ui/EmptyState.jsx';

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const aTexto = (v) => (v === null || v === undefined ? '' : String(v));
const numero = (t) => (t.trim() === '' ? null : Number(t));

// Valor con su diferencia contra el avance anterior que tenga esa medida: "78.4 kg (−1.6)".
export function conDiferencia(valor, diferencia, unidad) {
  if (valor === null || valor === undefined) return '—';
  if (diferencia === null || diferencia === undefined) return `${valor} ${unidad}`;
  const signo = diferencia > 0 ? '+' : diferencia < 0 ? '−' : '±';
  return `${valor} ${unidad} (${signo}${Math.abs(diferencia)})`;
}

function FormularioAvance({ inicial, onGuardar, onCancelar, textoBoton }) {
  const [valores, setValores] = useState(
    inicial
      ? { fecha: inicial.fecha, peso_kg: aTexto(inicial.peso_kg), grasa_pct: aTexto(inicial.grasa_pct), cintura_cm: aTexto(inicial.cintura_cm), comentario: aTexto(inicial.comentario) }
      : { fecha: hoyLocal(), peso_kg: '', grasa_pct: '', cintura_cm: '', comentario: '' },
  );
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

  async function alEnviar(evento) {
    evento.preventDefault();
    const cuerpo = {
      fecha: valores.fecha,
      peso_kg: numero(valores.peso_kg),
      grasa_pct: numero(valores.grasa_pct),
      cintura_cm: numero(valores.cintura_cm),
      comentario: valores.comentario.trim() || null,
    };
    if (cuerpo.peso_kg === null && cuerpo.grasa_pct === null && cuerpo.cintura_cm === null && cuerpo.comentario === null) {
      setError(new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos.', [{ field: 'peso_kg', message: 'Registra al menos el peso, el porcentaje de grasa, la cintura o un comentario.' }]));
      return;
    }
    setEnviando(true);
    try {
      await onGuardar(cuerpo);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo guardar el avance.'));
    } finally {
      setEnviando(false);
    }
  }

  const errorDe = (campo) => error?.mensajeDeCampo(campo);
  const general = error && !['fecha', 'peso_kg', 'grasa_pct', 'cintura_cm', 'comentario'].some((c) => errorDe(c));
  return (
    <form className="formulario-en-linea formulario-avance" onSubmit={alEnviar} noValidate aria-label="Avance">
      {general && (
        <div className="mensaje mensaje-error" role="alert">
          {error.message}
        </div>
      )}
      <FormField id="avance-fecha" etiqueta="Fecha" error={errorDe('fecha')}>
        <Input type="date" value={valores.fecha} max={hoyLocal()} onChange={cambiar('fecha')} />
      </FormField>
      <FormField id="avance-peso" etiqueta="Peso (kg)" error={errorDe('peso_kg')}>
        <Input type="number" step="0.1" min={20} max={400} value={valores.peso_kg} onChange={cambiar('peso_kg')} />
      </FormField>
      <FormField id="avance-grasa" etiqueta="Grasa (%)" error={errorDe('grasa_pct')}>
        <Input type="number" step="0.1" min={2} max={70} value={valores.grasa_pct} onChange={cambiar('grasa_pct')} />
      </FormField>
      <FormField id="avance-cintura" etiqueta="Cintura (cm)" error={errorDe('cintura_cm')}>
        <Input type="number" step="0.1" min={30} max={250} value={valores.cintura_cm} onChange={cambiar('cintura_cm')} />
      </FormField>
      <FormField id="avance-comentario" etiqueta="Comentario" error={errorDe('comentario')}>
        <Input value={valores.comentario} onChange={cambiar('comentario')} maxLength={500} />
      </FormField>
      <div className="acciones acciones-izquierda">
        <Button type="submit" cargando={enviando}>
          {textoBoton}
        </Button>
        <Button variante="secundario" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// Historial de avances (spec 004, US4, FR-013 a FR-015). `progresos` ya viene ordenado y con diferencias.
export default function HistorialProgreso({ idCliente, progresos, puedeEditar, onCambio }) {
  const [registrando, setRegistrando] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState(null);

  const columnas = [
    { clave: 'fecha', etiqueta: 'Fecha', render: (p) => formatearFechaCorta(p.fecha) },
    { clave: 'peso_kg', etiqueta: 'Peso', render: (p) => conDiferencia(p.peso_kg, p.diferencias?.peso_kg, 'kg') },
    { clave: 'grasa_pct', etiqueta: 'Grasa', render: (p) => conDiferencia(p.grasa_pct, p.diferencias?.grasa_pct, '%') },
    { clave: 'cintura_cm', etiqueta: 'Cintura', render: (p) => conDiferencia(p.cintura_cm, p.diferencias?.cintura_cm, 'cm') },
    { clave: 'comentario', etiqueta: 'Comentario', render: (p) => p.comentario ?? '—' },
  ];
  if (puedeEditar) {
    columnas.push({
      clave: 'acciones',
      etiqueta: 'Acciones',
      render: (p) =>
        p.puede_corregir ? (
          <Button variante="fantasma" onClick={() => setCorrigiendo(p)}>
            Corregir
          </Button>
        ) : null,
    });
  }

  return (
    <div>
      {puedeEditar && !registrando && !corrigiendo && (
        <div className="acciones acciones-izquierda">
          <Button onClick={() => setRegistrando(true)}>Registrar avance</Button>
        </div>
      )}
      {registrando && (
        <FormularioAvance
          textoBoton="Guardar avance"
          onCancelar={() => setRegistrando(false)}
          onGuardar={async (cuerpo) => {
            await solicitar(`/clientes/${idCliente}/progresos`, { metodo: 'POST', cuerpo });
            setRegistrando(false);
            onCambio('Avance registrado.');
          }}
        />
      )}
      {corrigiendo && (
        <FormularioAvance
          inicial={corrigiendo}
          textoBoton="Guardar corrección"
          onCancelar={() => setCorrigiendo(null)}
          onGuardar={async (cuerpo) => {
            await solicitar(`/progresos/${corrigiendo.id_progreso}`, { metodo: 'PATCH', cuerpo });
            setCorrigiendo(null);
            onCambio('Avance corregido.');
          }}
        />
      )}
      <Table
        etiquetaTabla="Historial de avances"
        columnas={columnas}
        filas={progresos.map((p) => ({ ...p, id: p.id_progreso }))}
        vacio={<EmptyState titulo="Sin avances registrados." texto={puedeEditar ? 'Registra el primero con "Registrar avance".' : 'Aún no hay avances.'} />}
      />
      {progresos.length > 0 && <p className="texto-suave">Entre paréntesis, la diferencia con el avance anterior que tiene esa medida. Un avance solo se corrige el mismo día en que se registró.</p>}
    </div>
  );
}
