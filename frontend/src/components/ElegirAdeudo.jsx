import { useEffect, useState } from 'react';
import { ErrorApi, solicitar } from '../api/cliente.js';
import { formatearFechaCorta, formatearMoneda } from '../utils/formato.js';
import Button from './ui/Button.jsx';
import FormField from './ui/FormField.jsx';
import Input from './ui/Input.jsx';
import Spinner from './ui/Spinner.jsx';

// Diálogo para elegir la membresía pendiente de pago que se va a cobrar desde la pantalla Pagos.
// Busca por cliente en /adeudos (las mismas reglas que la pantalla Adeudos) y devuelve la elegida.
export default function ElegirAdeudo({ onCerrar, onElegir }) {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [adeudos, setAdeudos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    const parametros = new URLSearchParams({ limit: '10' });
    if (busqueda) parametros.set('q', busqueda);
    solicitar(`/adeudos?${parametros}`)
      .then((r) => vigente && (setAdeudos(r.data), setError(null)))
      .catch((e) => vigente && setError(e instanceof ErrorApi ? e.message : 'No se pudieron cargar los adeudos.'))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [busqueda]);

  function buscar(evento) {
    evento.preventDefault();
    setBusqueda(texto.trim());
  }

  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal modal-ancho" role="dialog" aria-modal="true" aria-labelledby="titulo-elegir-adeudo">
        <h2 id="titulo-elegir-adeudo">Registrar pago</h2>
        <p>Busca al cliente y elige la membresía pendiente de pago.</p>
        <form onSubmit={buscar} className="filtros">
          <FormField id="buscar-adeudo" etiqueta="Cliente">
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o apellido" maxLength={150} />
          </FormField>
          <div className="filtros-acciones">
            <Button type="submit">Buscar</Button>
          </div>
        </form>
        {error && (
          <div className="mensaje mensaje-error" role="alert">
            {error}
          </div>
        )}
        {cargando ? (
          <Spinner etiqueta="Buscando adeudos…" />
        ) : adeudos.length === 0 ? (
          <p className="texto-tenue">{busqueda ? 'Ese cliente no tiene membresías pendientes de pago.' : 'No hay membresías pendientes de pago.'}</p>
        ) : (
          <ul className="lista-seleccion" aria-label="Membresías pendientes de pago">
            {adeudos.map((a) => (
              <li key={a.id_membresia}>
                <button type="button" className="opcion-seleccion" onClick={() => onElegir(a)}>
                  <strong>
                    {a.cliente.nombre} {a.cliente.apellido}
                  </strong>
                  <span>
                    {a.plan} · desde {formatearFechaCorta(a.fecha_inicio)} · {formatearMoneda(a.adeudo)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="acciones">
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
