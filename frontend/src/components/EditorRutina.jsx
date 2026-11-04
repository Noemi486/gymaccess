import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Button from './ui/Button.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';

const ejercicioVacio = () => ({ nombre: '', series: '', repeticiones: '', peso_kg: '', descanso_seg: '', instrucciones: '' });
const aTexto = (v) => (v === null || v === undefined ? '' : String(v));

// Convierte la rutina guardada (o nada) al estado del formulario, todo como texto.
function estadoInicial(base) {
  if (!base) return { nombre: '', indicaciones: '', dias: [{ dia: 1, ejercicios: [ejercicioVacio()] }] };
  return {
    nombre: base.nombre,
    indicaciones: base.indicaciones ?? '',
    dias: base.dias.map((d) => ({
      dia: d.dia,
      ejercicios: d.ejercicios.map((e) => ({
        nombre: e.nombre,
        series: aTexto(e.series),
        repeticiones: aTexto(e.repeticiones),
        peso_kg: aTexto(e.peso_kg),
        descanso_seg: aTexto(e.descanso_seg),
        instrucciones: aTexto(e.instrucciones),
      })),
    })),
  };
}

const numero = (texto) => (texto.trim() === '' ? null : Number(texto));
const textoONulo = (texto) => (texto.trim() === '' ? null : texto.trim());

// Mismas reglas que el servidor (FR-009, FR-010): devuelve { ruta: mensaje }.
function validar(valores) {
  const errores = {};
  if (!valores.nombre.trim()) errores.nombre = 'El nombre de la rutina es obligatorio.';
  let total = 0;
  valores.dias.forEach((d, i) =>
    d.ejercicios.forEach((e, j) => {
      total += 1;
      const ruta = `dias.${i}.ejercicios.${j}`;
      if (!e.nombre.trim()) errores[`${ruta}.nombre`] = 'El nombre del ejercicio es obligatorio.';
      if (!e.series.trim() && !e.repeticiones.trim() && !e.instrucciones.trim()) errores[`${ruta}.series`] = 'Indica series, repeticiones o instrucciones.';
    }),
  );
  if (total === 0) errores.dias = 'Agrega al menos un ejercicio.';
  return errores;
}

// Editor de rutina por días (spec 004, US3). Guardar siempre crea una versión nueva: la anterior queda en el historial.
export default function EditorRutina({ idCliente, base, onGuardada, onCancelar }) {
  const [valores, setValores] = useState(() => estadoInicial(base));
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiarRutina = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));
  const cambiarEjercicio = (i, j, campo) => (e) =>
    setValores((v) => ({
      ...v,
      dias: v.dias.map((d, di) => (di !== i ? d : { ...d, ejercicios: d.ejercicios.map((x, ej) => (ej !== j ? x : { ...x, [campo]: e.target.value })) })),
    }));
  const agregarEjercicio = (i) =>
    setValores((v) => ({ ...v, dias: v.dias.map((d, di) => (di !== i ? d : { ...d, ejercicios: [...d.ejercicios, ejercicioVacio()] })) }));
  const quitarEjercicio = (i, j) =>
    setValores((v) => ({ ...v, dias: v.dias.map((d, di) => (di !== i ? d : { ...d, ejercicios: d.ejercicios.filter((_, ej) => ej !== j) })) }));
  const diasLibres = [1, 2, 3, 4, 5, 6, 7].filter((n) => !valores.dias.some((d) => d.dia === n));
  const agregarDia = () =>
    setValores((v) => ({ ...v, dias: [...v.dias, { dia: diasLibres[0], ejercicios: [ejercicioVacio()] }].sort((a, b) => a.dia - b.dia) }));
  const quitarDia = (i) => setValores((v) => ({ ...v, dias: v.dias.filter((_, di) => di !== i) }));

  async function alEnviar(evento) {
    evento.preventDefault();
    setErrorGeneral(null);
    const locales = validar(valores);
    setErrores(locales);
    if (Object.keys(locales).length > 0) {
      setErrorGeneral(locales.dias ?? 'Revisa los campos marcados.');
      return;
    }
    const cuerpo = {
      nombre: valores.nombre.trim(),
      indicaciones: textoONulo(valores.indicaciones),
      dias: valores.dias.map((d) => ({
        dia: d.dia,
        ejercicios: d.ejercicios.map((e) => ({
          nombre: e.nombre.trim(),
          series: numero(e.series),
          repeticiones: textoONulo(e.repeticiones),
          peso_kg: numero(e.peso_kg),
          descanso_seg: numero(e.descanso_seg),
          instrucciones: textoONulo(e.instrucciones),
        })),
      })),
    };
    setEnviando(true);
    try {
      const guardada = await solicitar(`/clientes/${idCliente}/rutinas`, { metodo: 'POST', cuerpo });
      onGuardada(guardada);
    } catch (e) {
      if (e instanceof ErrorApi) {
        setErrores(Object.fromEntries(e.detalles.map((d) => [d.field, d.message])));
        setErrorGeneral(e.message);
      } else {
        setErrorGeneral('No se pudo guardar la rutina.');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="editor-rutina" onSubmit={alEnviar} noValidate aria-label="Editor de rutina">
      {errorGeneral && (
        <div className="mensaje mensaje-error" role="alert">
          {errorGeneral}
        </div>
      )}
      <FormField id="rutina-nombre" etiqueta="Nombre de la rutina" error={errores.nombre}>
        <Input value={valores.nombre} onChange={cambiarRutina('nombre')} maxLength={100} placeholder="Por ejemplo: Fuerza, tres días" />
      </FormField>
      <FormField id="rutina-indicaciones" etiqueta="Indicaciones generales (opcional)" error={errores.indicaciones}>
        <textarea id="rutina-indicaciones" className="entrada" rows={2} maxLength={500} value={valores.indicaciones} onChange={cambiarRutina('indicaciones')} />
      </FormField>

      {valores.dias.map((d, i) => (
        <fieldset key={d.dia} className="editor-dia">
          <legend>Día {d.dia}</legend>
          {d.ejercicios.map((e, j) => {
            const ruta = `dias.${i}.ejercicios.${j}`;
            const id = `d${d.dia}-e${j}`;
            const n = j + 1;
            return (
              <div key={j} className="editor-ejercicio" role="group" aria-label={`Día ${d.dia}, ejercicio ${n}`}>
                <FormField id={`${id}-nombre`} etiqueta={`Ejercicio ${n}`} error={errores[`${ruta}.nombre`]}>
                  <Input value={e.nombre} onChange={cambiarEjercicio(i, j, 'nombre')} maxLength={100} placeholder="Por ejemplo: Sentadilla" />
                </FormField>
                <FormField id={`${id}-series`} etiqueta="Series" error={errores[`${ruta}.series`]}>
                  <Input type="number" min={1} max={20} value={e.series} onChange={cambiarEjercicio(i, j, 'series')} />
                </FormField>
                <FormField id={`${id}-repeticiones`} etiqueta="Repeticiones" error={errores[`${ruta}.repeticiones`]}>
                  <Input value={e.repeticiones} onChange={cambiarEjercicio(i, j, 'repeticiones')} maxLength={30} placeholder="10-12" />
                </FormField>
                <FormField id={`${id}-peso`} etiqueta="Peso (kg)" error={errores[`${ruta}.peso_kg`]}>
                  <Input type="number" min={0} max={500} step="0.5" value={e.peso_kg} onChange={cambiarEjercicio(i, j, 'peso_kg')} />
                </FormField>
                <FormField id={`${id}-descanso`} etiqueta="Descanso (s)" error={errores[`${ruta}.descanso_seg`]}>
                  <Input type="number" min={0} max={600} value={e.descanso_seg} onChange={cambiarEjercicio(i, j, 'descanso_seg')} />
                </FormField>
                <FormField id={`${id}-instrucciones`} etiqueta="Instrucciones" error={errores[`${ruta}.instrucciones`]}>
                  <Input value={e.instrucciones} onChange={cambiarEjercicio(i, j, 'instrucciones')} maxLength={300} />
                </FormField>
                <Button variante="fantasma" onClick={() => quitarEjercicio(i, j)} aria-label={`Quitar ejercicio ${n} del día ${d.dia}`} icono={<Trash2 size={16} aria-hidden="true" />}>
                  Quitar
                </Button>
              </div>
            );
          })}
          <div className="acciones acciones-izquierda">
            {d.ejercicios.length < 20 && (
              <Button variante="secundario" onClick={() => agregarEjercicio(i)} icono={<Plus size={16} aria-hidden="true" />}>
                Agregar ejercicio al día {d.dia}
              </Button>
            )}
            {valores.dias.length > 1 && (
              <Button variante="fantasma" onClick={() => quitarDia(i)}>
                Quitar día {d.dia}
              </Button>
            )}
          </div>
        </fieldset>
      ))}

      <div className="acciones acciones-izquierda">
        {diasLibres.length > 0 && (
          <Button variante="secundario" onClick={agregarDia} icono={<Plus size={16} aria-hidden="true" />}>
            Agregar día
          </Button>
        )}
      </div>
      <div className="acciones">
        <Button variante="secundario" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" cargando={enviando}>
          Guardar rutina
        </Button>
      </div>
    </form>
  );
}
