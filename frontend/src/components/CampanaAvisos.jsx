import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { solicitar } from '../api/cliente.js';
import Badge from './ui/Badge.jsx';
import { formatearFechaCorta, textoAviso } from '../utils/formato.js';

// Campana de avisos de membresías por vencer y vencidas (US12, FR-054 a FR-058).
// Pide GET /avisos al abrir la sesión y en cada cambio de pantalla; el número es el total de la lista.
// El personal ve los avisos de todos con enlace al detalle del cliente; el cliente, solo el suyo.
export default function CampanaAvisos({ rol }) {
  const { pathname } = useLocation();
  const [datos, setDatos] = useState({ total: 0, avisos: [] });
  const [error, setError] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef(null);
  const boton = useRef(null);
  const esPersonal = rol === 'administrador' || rol === 'recepcionista';

  const cargar = useCallback(async () => {
    try {
      const r = await solicitar('/avisos');
      const avisos = Array.isArray(r?.avisos) ? r.avisos : [];
      setDatos({ total: avisos.length, avisos });
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    cargar();
    setAbierto(false);
  }, [pathname, cargar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const alPulsar = (evento) => {
      if (contenedor.current && !contenedor.current.contains(evento.target)) setAbierto(false);
    };
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('mousedown', alPulsar);
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.removeEventListener('mousedown', alPulsar);
      document.removeEventListener('keydown', alTeclear);
    };
  }, [abierto]);

  const { total, avisos } = datos;
  const etiqueta = total > 0 ? `Avisos: ${total} ${total === 1 ? 'aviso' : 'avisos'}` : 'Avisos: sin avisos';

  return (
    <div className="campana" ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className="campana-boton"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={etiqueta}
        onClick={() => {
          if (!abierto) cargar();
          setAbierto((actual) => !actual);
        }}
      >
        <Bell size={20} aria-hidden="true" />
        {total > 0 && (
          <span className="campana-numero" aria-hidden="true">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {abierto && (
        <div className="campana-panel" role="region" aria-label="Avisos de membresías">
          <p className="campana-titulo">Avisos de membresías</p>
          {error && avisos.length === 0 ? (
            <p className="campana-vacio">No se pudieron cargar los avisos.</p>
          ) : avisos.length === 0 ? (
            <p className="campana-vacio">No hay avisos</p>
          ) : (
            <ul className="campana-lista">
              {avisos.map((aviso) => {
                const contenido = (
                  <>
                    <span className="campana-aviso-encabezado">
                      <strong>
                        {aviso.cliente.nombre} {aviso.cliente.apellido}
                      </strong>
                      <Badge variante={aviso.tipo === 'vencida' ? 'error' : 'advertencia'}>{textoAviso(aviso.dias)}</Badge>
                    </span>
                    <span className="campana-aviso-detalle">
                      {aviso.plan} · fin: {formatearFechaCorta(aviso.fecha_fin)}
                    </span>
                  </>
                );
                return (
                  <li key={aviso.id_membresia}>
                    {esPersonal ? (
                      <Link className="campana-aviso" to={`/clientes/${aviso.cliente.id_cliente}`} onClick={() => setAbierto(false)}>
                        {contenido}
                      </Link>
                    ) : (
                      <div className="campana-aviso">{contenido}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {!esPersonal && avisos.length > 0 && <p className="campana-pie">Renueva en recepción para no perder tu acceso.</p>}
        </div>
      )}
    </div>
  );
}
