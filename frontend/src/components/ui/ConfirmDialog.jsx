import { useEffect, useRef } from 'react';
import Button from './Button.jsx';

// Diálogo de confirmación para bajas e inactivaciones.
// El foco inicial queda en "Cancelar" (la opción segura) y Escape cancela.
export default function ConfirmDialog({
  abierto,
  titulo = 'Confirmar acción',
  texto,
  textoConfirmar = 'Confirmar',
  onConfirmar,
  onCancelar,
}) {
  const botonCancelar = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    botonCancelar.current?.focus();
    const alTeclear = (evento) => {
      if (evento.key === 'Escape') onCancelar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, onCancelar]);

  if (!abierto) return null;
  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion">
        <h2 id="titulo-confirmacion">{titulo}</h2>
        {texto && <p>{texto}</p>}
        <div className="acciones">
          <Button ref={botonCancelar} variante="secundario" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button variante="peligro" onClick={onConfirmar}>
            {textoConfirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
