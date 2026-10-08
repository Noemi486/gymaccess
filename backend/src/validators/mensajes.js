import { z } from 'zod';

// Mensajes de validación por defecto en español (FR-018: indicar qué corregir).
// Un mensaje propio en el esquema (por ejemplo { error: '...' }) tiene prioridad sobre esto.
z.config({
  customError: (problema) => {
    switch (problema.code) {
      case 'invalid_type':
        return problema.input === undefined || problema.input === null
          ? 'Este campo es obligatorio.'
          : 'El valor no tiene el tipo esperado.';
      case 'too_small':
        if (problema.origin === 'string') {
          return problema.minimum === 1
            ? 'Este campo es obligatorio.'
            : `Debe tener al menos ${problema.minimum} caracteres.`;
        }
        return `El valor mínimo es ${problema.minimum}.`;
      case 'too_big':
        return problema.origin === 'string'
          ? `No puede superar ${problema.maximum} caracteres.`
          : `El valor máximo es ${problema.maximum}.`;
      case 'invalid_format':
        return problema.format === 'email'
          ? 'El correo no tiene un formato válido.'
          : 'El formato no es válido.';
      case 'invalid_value':
        return problema.input === undefined
          ? 'Este campo es obligatorio.'
          : 'El valor no es una de las opciones permitidas.';
      case 'unrecognized_keys':
        return 'Se enviaron campos que no están permitidos.';
      default:
        return undefined;
    }
  },
});
