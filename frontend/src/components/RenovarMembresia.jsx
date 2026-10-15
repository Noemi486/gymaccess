import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { calcularFechaFin, hoyLocal, MAX_DIAS_ADELANTO, sumarDias } from '../utils/fechas.js';
import { formatearFechaCorta, formatearMoneda } from '../utils/formato.js';
import SelectorMetodoPago from './SelectorMetodoPago.jsx';
import Button from './ui/Button.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';

// Diálogo para renovar una membresía con el mismo plan.
// Si la membresía sigue vigente, la renovación empieza el día siguiente a su fin (no se puede cambiar).
// Si ya venció, empieza hoy o en la fecha que se indique.
export default function RenovarMembresia({ membresia, onCerrar, onGuardado }) {
  const vigente = membresia.estado === 'vigente';
  const [inicio, setInicio] = useState('');
  const [precio, setPrecio] = useState(null); // precio vigente del plan (para cobrar al renovar)
  const [pagarAhora, setPagarAhora] = useState(false);
  const [metodo, setMetodo] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    solicitar(`/tipos-membresia/${membresia.tipo.id_tipo_membresia}`)
      .then((plan) => activo && setPrecio(plan.precio))
      .catch(() => {}); // sin precio no se ofrece cobrar ahora; el servidor valida todo
    return () => {
      activo = false;
    };
  }, [membresia.tipo.id_tipo_membresia]);

  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const hoy = hoyLocal();
  const inicioEfectivo = vigente ? sumarDias(membresia.fecha_fin, 1) : inicio || hoy;
  const fin = calcularFechaFin(inicioEfectivo, membresia.tipo.duracion);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    const cuerpo = !vigente && inicio ? { fecha_inicio: inicio } : {};
    if (pagarAhora && precio !== null) cuerpo.pago = { metodo_pago: metodo, monto: precio };
    setEnviando(true);
    try {
      const resultado = await solicitar(`/membresias/${membresia.id_membresia}/renovar`, { metodo: 'POST', cuerpo });
      onGuardado(resultado.membresia);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  const detalles = error?.detalles ?? [];
  const mostrarGeneral = error && (detalles.length === 0 || detalles.some((d) => !['fecha_inicio', 'pago.monto', 'pago.metodo_pago'].includes(d.field)));

  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="titulo-renovar-membresia">
        <h2 id="titulo-renovar-membresia">Renovar membresía</h2>

        <form onSubmit={enviar} noValidate>
          {mostrarGeneral && (
            <div className="mensaje mensaje-error" role="alert">
              {error.message}
            </div>
          )}

          <p>
            Plan: <strong>{membresia.tipo.nombre}</strong> ({membresia.tipo.duracion} {membresia.tipo.duracion === 1 ? 'día' : 'días'}).
          </p>

          {!vigente && (
            <FormField
              id="fecha-renovacion"
              etiqueta="Fecha de inicio (opcional)"
              ayuda={`Si la dejas vacía empieza hoy. Hasta ${MAX_DIAS_ADELANTO} días adelante.`}
              error={error?.mensajeDeCampo('fecha_inicio')}
            >
              <Input type="date" value={inicio} min={hoy} max={sumarDias(hoy, MAX_DIAS_ADELANTO)} onChange={(e) => setInicio(e.target.value)} />
            </FormField>
          )}

          <p className="resumen-membresia" aria-live="polite">
            {vigente ? 'Empieza el día siguiente al fin de la actual: ' : ''}
            Vigente del {formatearFechaCorta(inicioEfectivo)} al {formatearFechaCorta(fin)}. {pagarAhora ? 'Se cobrará' : 'Quedará pendiente de pago'} al precio vigente del plan{precio !== null && ` (${formatearMoneda(precio)})`}.
          </p>

          {precio !== null && (
            <>
              <label className="casilla">
                <input type="checkbox" checked={pagarAhora} onChange={(e) => setPagarAhora(e.target.checked)} />
                Registrar el pago ahora
              </label>
              {pagarAhora && (
                <SelectorMetodoPago
                  id="metodo-pago-ahora"
                  valor={metodo}
                  onChange={setMetodo}
                  error={error?.mensajeDeCampo('pago.metodo_pago') ?? error?.mensajeDeCampo('pago.monto')}
                />
              )}
            </>
          )}

          <div className="acciones">
            <Button variante="secundario" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" cargando={enviando}>
              Renovar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
