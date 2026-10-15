import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { calcularFechaFin, hoyLocal, MAX_DIAS_ADELANTO, sumarDias } from '../utils/fechas.js';
import { formatearFechaCorta, formatearMoneda } from '../utils/formato.js';
import Button from './ui/Button.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';
import SelectorMetodoPago from './SelectorMetodoPago.jsx';
import Select from './ui/Select.jsx';
import Spinner from './ui/Spinner.jsx';

// Diálogo para asignar una membresía a un cliente (administrador y recepcionista).
// La membresía queda pendiente de pago hasta que se registre el pago (historia de pagos).
export default function AsignarMembresia({ idCliente, onCerrar, onGuardado }) {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [idPlan, setIdPlan] = useState('');
  const [inicio, setInicio] = useState('');
  const [pagarAhora, setPagarAhora] = useState(false);
  const [metodo, setMetodo] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let activo = true;
    solicitar('/tipos-membresia?estado=activo&limit=100')
      .then((pagina) => activo && setPlanes(pagina.data))
      .catch((e) => activo && setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'No se pudieron cargar los planes.')))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  const plan = planes.find((p) => String(p.id_tipo_membresia) === idPlan);
  const hoy = hoyLocal();
  const inicioEfectivo = inicio || hoy;
  const fin = plan ? calcularFechaFin(inicioEfectivo, plan.duracion) : null;

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    if (!plan) {
      setError(new ErrorApi(400, 'VALIDATION_ERROR', 'Revisa los datos enviados.', [{ field: 'id_tipo_membresia', message: 'Elige un plan.' }]));
      return;
    }
    const cuerpo = { id_tipo_membresia: plan.id_tipo_membresia };
    if (inicio) cuerpo.fecha_inicio = inicio;
    if (pagarAhora) cuerpo.pago = { metodo_pago: metodo, monto: plan.precio };
    setEnviando(true);
    try {
      const resultado = await solicitar(`/clientes/${idCliente}/membresias`, { metodo: 'POST', cuerpo });
      onGuardado(resultado.membresia);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  const detalles = error?.detalles ?? [];
  const mostrarGeneral = error && (detalles.length === 0 || detalles.some((d) => !['id_tipo_membresia', 'fecha_inicio', 'pago.monto', 'pago.metodo_pago'].includes(d.field)));
  const errorDe = (campo) => error?.mensajeDeCampo(campo);

  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="titulo-asignar-membresia">
        <h2 id="titulo-asignar-membresia">Asignar membresía</h2>

        {cargando ? (
          <Spinner etiqueta="Cargando planes…" />
        ) : (
          <form onSubmit={enviar} noValidate>
            {mostrarGeneral && (
              <div className="mensaje mensaje-error" role="alert">
                {error.message}
              </div>
            )}

            {planes.length === 0 && !error ? (
              <div className="resumen-membresia">No hay planes activos. Pide a un administrador que registre uno.</div>
            ) : (
              <>
                <FormField id="plan" etiqueta="Plan" error={errorDe('id_tipo_membresia')}>
                  <Select value={idPlan} onChange={(e) => setIdPlan(e.target.value)} required>
                    <option value="">Elige un plan</option>
                    {planes.map((p) => (
                      <option key={p.id_tipo_membresia} value={p.id_tipo_membresia}>
                        {`${p.nombre} — ${p.duracion} ${p.duracion === 1 ? 'día' : 'días'} — ${formatearMoneda(p.precio)}`}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField
                  id="fecha-inicio"
                  etiqueta="Fecha de inicio (opcional)"
                  ayuda={`Si la dejas vacía empieza hoy. Hasta ${MAX_DIAS_ADELANTO} días adelante.`}
                  error={errorDe('fecha_inicio')}
                >
                  <Input type="date" value={inicio} min={hoy} max={sumarDias(hoy, MAX_DIAS_ADELANTO)} onChange={(e) => setInicio(e.target.value)} />
                </FormField>

                {plan && (
                  <p className="resumen-membresia" aria-live="polite">
                    Vigente del {formatearFechaCorta(inicioEfectivo)} al {formatearFechaCorta(fin)}. {pagarAhora ? 'Se cobrará' : 'Quedará pendiente de pago por'}{' '}
                    <strong>{formatearMoneda(plan.precio)}</strong>.
                  </p>
                )}

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
              <Button type="submit" cargando={enviando} disabled={planes.length === 0}>
                Asignar
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
