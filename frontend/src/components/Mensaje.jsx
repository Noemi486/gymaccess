// Mensaje de éxito o error visible tras cada operación.
// tipo: 'exito' | 'error'. Si no hay texto no se muestra nada.
export default function Mensaje({ tipo = 'error', texto }) {
  if (!texto) return null;
  return (
    <div className={`mensaje mensaje-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {texto}
    </div>
  );
}
