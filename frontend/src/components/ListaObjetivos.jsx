import { useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { formatearFechaCorta } from '../utils/formato.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';

export const ESTADO_OBJETIVO = {
  en_curso: { texto: 'En curso', variante: 'info' },
  cumplido: { texto: 'Cumplido', variante: 'exito' },
  cancelado: { texto: 'Cancelado', variante: 'neutral' },
};

const VACIO = { descripcion: '', meta: '', fecha_limite: '' };

function FormularioObjetivo({ inicial = VACIO, onGuardar, onCancelar, textoBoton }) {
  const [valores, setValores] = useState(inicial);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

  async function alEnviar(evento) {
    evento.preventDefault();
    if (!valores.descripcion.trim()) {
      setError(new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos.', [{ field: 'descripcion', message: 'La descripción es obligatoria.' }]));
      return;
    }
    setEnviando(true);
    try {
      await onGuardar({ descripcion: valores.descripcion.trim(), meta: valores.meta.trim() || null, fecha_limite: valores.fecha_limite || null });
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo guardar el objetivo.'));
    } finally {
      setEnviando(false);
    }
  }

  const errorDe = (campo) => error?.mensajeDeCampo(campo);
  const general = error && !['descripcion', 'meta', 'fecha_limite'].some((c) => errorDe(c));
  return (
    <form className="formulario-en-linea" onSubmit={alEnviar} noValidate aria-label="Formulario de objetivo">
      {general && (
        <div className="mensaje mensaje-error" role="alert">
          {error.message}
        </div>
      )}
      <FormField id="objetivo-descripcion" etiqueta="Objetivo" error={errorDe('descripcion')}>
        <Input value={valores.descripcion} onChange={cambiar('descripcion')} maxLength={200} placeholder="Por ejemplo: Bajar 5 kg" />
      </FormField>
      <FormField id="objetivo-meta" etiqueta="Meta (opcional)" error={errorDe('meta')}>
        <Input value={valores.meta} onChange={cambiar('meta')} maxLength={100} placeholder="75 kg" />
      </FormField>
      <FormField id="objetivo-fecha" etiqueta="Fecha límite (opcional)" error={errorDe('fecha_limite')}>
        <Input type="date" value={valores.fecha_limite} onChange={cambiar('fecha_limite')} />
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

// Objetivos del cliente (spec 004, US4, FR-012): el entrenador asignado crea, edita en curso y cierra.
export default function ListaObjetivos({ idCliente, objetivos, puedeEditar, onCambio }) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [cerrar, setCerrar] = useState(null); // { objetivo, estado }
  const [aviso, setAviso] = useState(null);

  async function confirmarCierre() {
    const { objetivo, estado } = cerrar;
    setCerrar(null);
    setAviso(null);
    try {
      await solicitar(`/objetivos/${objetivo.id_objetivo}`, { metodo: 'PATCH', cuerpo: { estado } });
      onCambio(estado === 'cumplido' ? 'Objetivo cumplido.' : 'Objetivo cancelado.');
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : 'No se pudo cerrar el objetivo.');
    }
  }

  return (
    <div>
      {aviso && (
        <div className="mensaje mensaje-error" role="alert">
          {aviso}
        </div>
      )}
      {objetivos.length === 0 && !creando && <p className="texto-suave">Sin objetivos registrados.</p>}
      {objetivos.length > 0 && (
        <ul className="lista-objetivos" aria-label="Objetivos">
          {objetivos.map((o) => {
            const estado = ESTADO_OBJETIVO[o.estado];
            if (editando === o.id_objetivo) {
              return (
                <li key={o.id_objetivo}>
                  <FormularioObjetivo
                    inicial={{ descripcion: o.descripcion, meta: o.meta ?? '', fecha_limite: o.fecha_limite ?? '' }}
                    textoBoton="Guardar cambios"
                    onCancelar={() => setEditando(null)}
                    onGuardar={async (cuerpo) => {
                      await solicitar(`/objetivos/${o.id_objetivo}`, { metodo: 'PATCH', cuerpo });
                      setEditando(null);
                      onCambio('Objetivo actualizado.');
                    }}
                  />
                </li>
              );
            }
            return (
              <li key={o.id_objetivo} className="objetivo">
                <div className="objetivo-encabezado">
                  <strong>{o.descripcion}</strong>
                  <Badge variante={estado.variante}>{estado.texto}</Badge>
                </div>
                <span className="texto-suave">
                  {[o.meta && `Meta: ${o.meta}`, o.fecha_limite && `Fecha límite: ${formatearFechaCorta(o.fecha_limite)}`, o.fecha_cierre && `Cerrado el ${formatearFechaCorta(o.fecha_cierre)}`]
                    .filter(Boolean)
                    .join(' · ') || `Desde el ${formatearFechaCorta(o.fecha_creacion)}`}
                </span>
                {puedeEditar && o.estado === 'en_curso' && (
                  <div className="acciones acciones-izquierda">
                    <Button variante="secundario" onClick={() => setCerrar({ objetivo: o, estado: 'cumplido' })}>
                      Marcar cumplido
                    </Button>
                    <Button variante="fantasma" onClick={() => setEditando(o.id_objetivo)}>
                      Editar
                    </Button>
                    <Button variante="fantasma" onClick={() => setCerrar({ objetivo: o, estado: 'cancelado' })}>
                      Cancelar objetivo
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {puedeEditar &&
        (creando ? (
          <FormularioObjetivo
            textoBoton="Guardar objetivo"
            onCancelar={() => setCreando(false)}
            onGuardar={async (cuerpo) => {
              await solicitar(`/clientes/${idCliente}/objetivos`, { metodo: 'POST', cuerpo });
              setCreando(false);
              onCambio('Objetivo registrado.');
            }}
          />
        ) : (
          <div className="acciones acciones-izquierda">
            <Button onClick={() => setCreando(true)}>Nuevo objetivo</Button>
          </div>
        ))}
      <ConfirmDialog
        abierto={Boolean(cerrar)}
        titulo={cerrar?.estado === 'cumplido' ? 'Marcar objetivo como cumplido' : 'Cancelar objetivo'}
        texto={cerrar ? `"${cerrar.objetivo.descripcion}" quedará ${cerrar.estado === 'cumplido' ? 'cumplido' : 'cancelado'} y ya no se podrá modificar.` : ''}
        textoConfirmar={cerrar?.estado === 'cumplido' ? 'Marcar cumplido' : 'Cancelar objetivo'}
        onConfirmar={confirmarCierre}
        onCancelar={() => setCerrar(null)}
      />
    </div>
  );
}
