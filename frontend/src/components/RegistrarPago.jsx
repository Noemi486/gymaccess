import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { formatearMoneda } from '../utils/formato.js';
import SelectorMetodoPago from './SelectorMetodoPago.jsx';
import Button from './ui/Button.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';

// Diálogo para registrar el pago de una membresía pendiente. No hay pagos parciales:
// el monto es el adeudo completo y no se puede editar.
export default function RegistrarPago({ membresia, onCerrar, onGuardado }) {
  const [metodo, setMetodo] = useState('efectivo');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const resultado = await solicitar('/pagos', {
        metodo: 'POST',
        cuerpo: { id_membresia: membresia.id_membresia, metodo_pago: metodo, monto: membresia.adeudo },
      });
      onGuardado(resultado);
    } catch (e) {
      setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Ocurrió un error inesperado. Inténtalo de nuevo.'));
    } finally {
      setEnviando(false);
    }
  }

  const detalles = error?.detalles ?? [];
  const mostrarGeneral = error && (detalles.length === 0 || detalles.some((d) => !['monto', 'metodo_pago'].includes(d.field)));

  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="titulo-registrar-pago">
        <h2 id="titulo-registrar-pago">Registrar pago</h2>
        <form onSubmit={enviar} noValidate>
          {mostrarGeneral && (
            <div className="mensaje mensaje-error" role="alert">
              {error.message}
            </div>
          )}
          <p>
            Membresía: <strong>{membresia.tipo.nombre}</strong>. El pago es por el monto completo.
          </p>
          <FormField id="monto-pago" etiqueta="Monto" error={error?.mensajeDeCampo('monto')}>
            <Input value={formatearMoneda(membresia.adeudo)} readOnly />
          </FormField>
          <SelectorMetodoPago valor={metodo} onChange={setMetodo} error={error?.mensajeDeCampo('metodo_pago')} />
          <div className="acciones">
            <Button variante="secundario" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" cargando={enviando}>
              Registrar pago
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
