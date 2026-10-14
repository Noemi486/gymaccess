import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from './Input.jsx';

// Campo de contraseña con un botón para mostrar u ocultar lo escrito. El botón es un <button> real:
// se alcanza con Tab, se activa con Enter o Espacio y anuncia su estado (aria-pressed).
// Recibe las mismas props que Input (id, aria-*, value, onChange…), así que funciona dentro de FormField.
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="campo-password">
      <Input {...props} type={visible ? 'text' : 'password'} className={`campo-password-entrada ${className}`.trim()} />
      <button
        type="button"
        className="campo-password-boton"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((actual) => !actual)}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}
