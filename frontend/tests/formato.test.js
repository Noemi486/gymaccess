import { describe, it, expect } from 'vitest';
import { formatearNumeroCliente, formatearTelefono } from '../src/utils/formato.js';

describe('formatearTelefono', () => {
  it('agrupa de 3 en 3 y el último grupo absorbe un dígito sobrante', () => {
    expect(formatearTelefono('5551002000')).toBe('555 100 2000'); // 10 dígitos
    expect(formatearTelefono('555100200')).toBe('555 100 200'); // 9
    expect(formatearTelefono('55510020')).toBe('555 100 20'); // 8
    expect(formatearTelefono('5551002')).toBe('555 1002'); // 7
    expect(formatearTelefono('555100200030')).toBe('555 100 200 030'); // 12
    expect(formatearTelefono('55510020003')).toBe('555 100 200 03'); // 11
  });

  it('ignora guiones, espacios y paréntesis', () => {
    expect(formatearTelefono('555-100-2000')).toBe('555 100 2000');
    expect(formatearTelefono('(555) 100 2000')).toBe('555 100 2000');
    expect(formatearTelefono('  555.100.2000 ')).toBe('555 100 2000');
  });

  it('conserva el + inicial', () => {
    expect(formatearTelefono('+525551002000')).toBe('+525 551 002 000');
  });

  it('con menos de 4 dígitos o sin dígitos devuelve el texto tal cual', () => {
    expect(formatearTelefono('123')).toBe('123');
    expect(formatearTelefono('ext.')).toBe('ext.');
    expect(formatearTelefono('')).toBe('');
  });

  it('no falla con valores que no son texto', () => {
    expect(formatearTelefono(null)).toBeNull();
    expect(formatearTelefono(undefined)).toBeUndefined();
  });
});

describe('formatearNumeroCliente', () => {
  it('rellena con ceros a la izquierda hasta 4 dígitos', () => {
    expect(formatearNumeroCliente(12)).toBe('Cliente #0012');
    expect(formatearNumeroCliente(7)).toBe('Cliente #0007');
    expect(formatearNumeroCliente(1234)).toBe('Cliente #1234');
  });

  it('no recorta números más largos', () => {
    expect(formatearNumeroCliente(123456)).toBe('Cliente #123456');
  });
});
