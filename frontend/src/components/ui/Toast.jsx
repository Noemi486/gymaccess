import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ToastContext = createContext(null);
const DURACION_MS = 5000;

function Aviso({ aviso, onCerrar }) {
  useEffect(() => {
    const temporizador = setTimeout(() => onCerrar(aviso.id), DURACION_MS);
    return () => clearTimeout(temporizador);
  }, [aviso.id, onCerrar]);

  return (
    <div className={`toast toast-${aviso.tipo}`} role={aviso.tipo === 'error' ? 'alert' : 'status'}>
      <span>{aviso.texto}</span>
      <button type="button" className="toast-cerrar" aria-label="Cerrar aviso" onClick={() => onCerrar(aviso.id)}>
        ×
      </button>
    </div>
  );
}

// Proveedor de avisos de éxito o error que se ocultan solos.
export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);

  const cerrar = useCallback((id) => setAvisos((actuales) => actuales.filter((a) => a.id !== id)), []);
  const mostrar = useCallback(({ tipo = 'exito', texto }) => {
    if (!texto) return;
    setAvisos((actuales) => [...actuales, { id: `${Date.now()}-${Math.random()}`, tipo, texto }]);
  }, []);

  const valor = useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toasts">
        {avisos.map((aviso) => (
          <Aviso key={aviso.id} aviso={aviso} onCerrar={cerrar} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast debe usarse dentro de ToastProvider.');
  return contexto;
}
