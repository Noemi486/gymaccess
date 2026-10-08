// Diálogo de confirmación para acciones delicadas (bajas, desactivaciones).
export default function Confirmacion({
  abierto,
  titulo = 'Confirmar acción',
  texto,
  textoConfirmar = 'Confirmar',
  onConfirmar,
  onCancelar,
}) {
  if (!abierto) return null;
  return (
    <div className="fondo-modal" role="presentation">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-confirmacion">
        <h2 id="titulo-confirmacion">{titulo}</h2>
        {texto && <p>{texto}</p>}
        <div className="acciones">
          <button type="button" className="boton boton-secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="boton boton-peligro" onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
