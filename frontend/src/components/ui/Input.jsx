// Campo de texto con el estilo común.
export default function Input({ className = '', ...props }) {
  return <input className={`entrada ${className}`.trim()} {...props} />;
}
