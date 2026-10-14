import { forwardRef } from 'react';

// Campo de texto con el estilo común.
const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`entrada ${className}`.trim()} {...props} />;
});

export default Input;
