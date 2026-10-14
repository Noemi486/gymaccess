// Lista desplegable con el estilo común.
export default function Select({ className = '', children, ...props }) {
  return (
    <select className={`entrada ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
