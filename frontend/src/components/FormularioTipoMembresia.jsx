import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import Button from './ui/Button.jsx';
import ConfirmDialog from './ui/ConfirmDialog.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';
import Spinner from './ui/Spinner.jsx';
import { formatearMoneda } from '../utils/formato.js';

const VACIO = { nombre: '', descripcion: '', duracion: '', precio: '' };
const CAMPOS = ['nombre', 'descripcion', 'duracion', 'precio'];

const aValores = (tipo) => ({
  nombre: tipo.nombre,
  descripcion: tipo.descripcion ?? '',
  duracion: String(tipo.duracion),
  precio: String(tipo.precio),
});

// Diálogo para crear o editar un plan de membresía (solo administrador).
// Al editar, si el precio cambia y el plan tiene membresías pendientes de pago, avisa que esos adeudos
// pasarán al nuevo precio y pide confirmar antes de guardar (FR-007).
export default function FormularioTipoMembresia({ tipo = null, onCerrar, onGuardado }) {
  const editando = Boolean(tipo);
  const [valores, setValores] = useState(editando ? aValores(tipo) : VACIO);
  const [original, setOriginal] = useState(editando ? aValores(tipo) : null);
  const [pendientes, setPendientes] = useState(0);
  const [cargando, setCargando] = useState(editando);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmandoPrecio, setConfirmandoPrecio] = useState(false);
  const primerCampo = useRef(null);

  // Al editar se consulta el plan para conocer cuántas membresías pendientes de pago lo usan.
  useEffect(() => {
    if (!editando) return undefined;
    let activo = true;
    solicitar(`/tipos-membresia/${tipo.id_tipo_membresia}`)
      .then((detalle) => {
        if (!activo) return;
        setOriginal(aValores(detalle));
        setValores(aValores(detalle));
        setPendientes(detalle.membresias_pendientes_de_pago ?? 0);
      })
      .catch((e) => activo && setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudo cargar el plan.')))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [editando, tipo]);

  useEffect(() => {
    if (!cargando) primerCampo.current?.focus();
  }, [cargando]);

  // Escape cierra el diálogo, salvo que esté abierta la confirmación del precio.
  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key === 'Escape' && !confirmandoPrecio) onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar, confirmandoPrecio]);

  const cambiar = (campo) => (evento) => setValores((actual) => ({ ...actual, [campo]: evento.target.value }));
  const cancelarConfirmacion = useCallback(() => setConfirmandoPrecio(false), []);

  function armarCuerpo() {
    const completo = {
      nombre: valores.nombre.trim(),
      descripcion: valores.descripcion.trim() === '' ? null : valores.descripcion.trim(),
      duracion: valores.duracion.trim() === '' ? undefined : Number(valores.duracion),
      precio: valores.precio.trim(),
    };
    if (!editando) {
      if (completo.descripcion === null) delete completo.descripcion;
      return completo;
    }
    const cuerpo = {};
    if (completo.nombre !== original.nombre) cuerpo.nombre = completo.nombre;
    if ((completo.descripcion ?? '') !== original.descripcion) cuerpo.descripcion = completo.descripcion;
    if (String(completo.duracion) !== original.duracion) cuerpo.duracion = completo.duracion;
    if (Number(completo.precio) !== Number(original.precio) || completo.precio === '') cuerpo.precio = completo.precio;
    return cuerpo;
  }

  async function guardar() {
    setConfirmandoPrecio(false);
    setError(null);
    const cuerpo = armarCuerpo();
    if (editando && Object.keys(cuerpo).length === 0) {
      setError(new ErrorApi(0, 'SIN_CAMBIOS', 'No hay cambios para guardar.'));
      return;
    }
    setEnviando(true);
    try {
      const guardado = await solicitar(editando ? `/tipos-membresia/${tipo.id_tipo_membresia}` : '/tipos-membresia', {
        metodo: editando ? 'PATCH' : 'POST',
        cuerpo,
      });
      onGuardado(guardado, editando);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  function alEnviar(evento) {
    evento.preventDefault();
    const precioCambio = editando && Number(valores.precio) !== Number(original.precio);
    if (precioCambio && pendientes > 0) {
      setConfirmandoPrecio(true);
      return;
    }
    guardar();
  }

  const detalles = error?.detalles ?? [];
  const hayDetallesSinCampo = detalles.some((d) => !CAMPOS.includes(d.field));
  const mostrarGeneral = error && (detalles.length === 0 || hayDetallesSinCampo);
  const errorDe = (campo) => error?.mensajeDeCampo(campo);

  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="titulo-tipo-membresia">
        <h2 id="titulo-tipo-membresia">{editando ? 'Editar tipo de membresía' : 'Nuevo tipo de membresía'}</h2>

        {cargando ? (
          <Spinner etiqueta="Cargando plan…" />
        ) : (
          <form onSubmit={alEnviar} noValidate>
            {mostrarGeneral && (
              <div className="mensaje mensaje-error" role="alert">
                {error.message}
              </div>
            )}

            <FormField id="nombre" etiqueta="Nombre" error={errorDe('nombre')}>
              <Input ref={primerCampo} value={valores.nombre} onChange={cambiar('nombre')} maxLength={80} required />
            </FormField>

            <FormField id="descripcion" etiqueta="Descripción (opcional)" error={errorDe('descripcion')}>
              <Input value={valores.descripcion} onChange={cambiar('descripcion')} maxLength={255} />
            </FormField>

            <FormField
              id="duracion"
              etiqueta="Duración (días)"
              ayuda="De 1 a 3650 días. El día de inicio cuenta como el primero."
              error={errorDe('duracion')}
            >
              <Input type="number" inputMode="numeric" min={1} max={3650} step={1} value={valores.duracion} onChange={cambiar('duracion')} required />
            </FormField>

            <FormField id="precio" etiqueta="Precio" ayuda="Mayor a 0, con a lo más 2 decimales." error={errorDe('precio')}>
              <Input type="number" inputMode="decimal" min={0.01} step="0.01" value={valores.precio} onChange={cambiar('precio')} required />
            </FormField>

            <div className="acciones">
              <Button variante="secundario" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" cargando={enviando}>
                Guardar
              </Button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        abierto={confirmandoPrecio}
        titulo="Cambiar el precio del plan"
        texto={`Este plan tiene ${pendientes} ${pendientes === 1 ? 'membresía pendiente' : 'membresías pendientes'} de pago. Esas membresías se cobrarán al nuevo precio (${formatearMoneda(Number(valores.precio))}). Las ya pagadas conservan lo que pagaron.`}
        textoConfirmar="Cambiar precio"
        onConfirmar={guardar}
        onCancelar={cancelarConfirmacion}
      />
    </div>
  );
}
