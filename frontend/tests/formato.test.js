import { describe, it, expect } from 'vitest';
import { formatearFechaCorta, formatearMoneda, formatearNumeroCliente, formatearTelefono } from '../src/utils/formato.js';

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

describe('formatearMoneda', () => {
  it('muestra dos decimales y separador de miles', () => {
    expect(formatearMoneda(450)).toBe('$450.00');
    expect(formatearMoneda(450.5)).toBe('$450.50');
    expect(formatearMoneda(1250)).toBe('$1,250.00');
    expect(formatearMoneda(1234567.891)).toBe('$1,234,567.89');
    expect(formatearMoneda(0)).toBe('$0.00');
    expect(formatearMoneda('450')).toBe('$450.00');
  });

  it('muestra un guion si no hay valor numérico', () => {
    for (const valor of [null, undefined, '', 'abc', NaN, Infinity]) expect(formatearMoneda(valor)).toBe('—');
  });

  it('respeta el signo negativo', () => {
    expect(formatearMoneda(-5)).toBe('-$5.00');
  });
});

describe('formatearFechaCorta', () => {
  it('formatea una fecha YYYY-MM-DD sin desfase de zona horaria', () => {
    expect(formatearFechaCorta('2026-10-14')).toBe('14 oct 2026');
    expect(formatearFechaCorta('2026-01-01')).toBe('1 ene 2026');
    expect(formatearFechaCorta('2026-12-31')).toBe('31 dic 2026');
  });

  it('formatea una fecha con hora', () => {
    expect(formatearFechaCorta('2026-10-14T12:00:00')).toBe('14 oct 2026');
  });

  it('devuelve vacío si no hay fecha o no es válida', () => {
    for (const valor of [null, undefined, '', 'no-es-fecha']) expect(formatearFechaCorta(valor)).toBe('');
  });
});
