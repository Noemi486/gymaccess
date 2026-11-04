import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

// "Mi entrenamiento" del cliente (spec 004, US5).

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const COMPLETO = {
  entrenador: { nombre: 'Luis Ramos', desde: '2026-10-01T10:00:00.000Z' },
  rutina_activa: {
    id_rutina: 30, nombre: 'Fuerza A', indicaciones: null, estado: 'activa', fecha_creacion: '2026-11-03T10:00:00.000Z', fecha_archivo: null,
    entrenador: { nombre: 'Luis Ramos' },
    dias: [{ dia: 1, ejercicios: [{ nombre: 'Sentadilla', series: 4, repeticiones: '10', peso_kg: null, descanso_seg: null, instrucciones: null }] }],
  },
  objetivos: [{ id_objetivo: 5, descripcion: 'Bajar 3 kg', meta: null, fecha_limite: null, estado: 'en_curso', fecha_creacion: '2026-11-01T10:00:00.000Z', fecha_cierre: null, entrenador: 'Luis Ramos' }],
  progresos: [
    { id_progreso: 2, fecha: '2026-11-04', peso_kg: 79, grasa_pct: null, cintura_cm: null, comentario: null, entrenador: 'Luis Ramos', corregido: false, puede_corregir: false, diferencias: { peso_kg: -1, grasa_pct: null, cintura_cm: null } },
    { id_progreso: 1, fecha: '2026-10-25', peso_kg: 80, grasa_pct: null, cintura_cm: null, comentario: null, entrenador: 'Luis Ramos', corregido: false, puede_corregir: false, diferencias: { peso_kg: null, grasa_pct: null, cintura_cm: null } },
  ],
};
const VACIO = { entrenador: null, rutina_activa: null, objetivos: [], progresos: [] };

function abrir(rol, datos = COMPLETO) {
  const cuenta = { id_usuario: 20, nombre: 'Ana Ruiz', correo: 'ana@example.com', rol, estado: 'activo', id_cliente: rol === 'cliente' ? 7 : null };
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const urls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => {
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url === '/api/avisos') return respuesta(200, { total: 0, avisos: [] });
      urls.push(url);
      if (url === '/api/clientes/me/entrenamiento') return respuesta(200, datos);
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/mi-entrenamiento']}>
      <App />
    </MemoryRouter>,
  );
  return urls;
}

describe('Mi entrenamiento', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('muestra entrenador, rutina por día, objetivos y progreso, sin ningún botón', async () => {
    const urls = abrir('cliente');
    expect(await screen.findByText(/Tu entrenador: Luis Ramos/)).toBeInTheDocument();
    const rutina = within(screen.getByRole('heading', { name: 'Mi rutina' }).closest('section'));
    expect(within(rutina.getByRole('region', { name: 'Día 1' })).getByText('Sentadilla')).toBeInTheDocument();
    expect(screen.getByText('Bajar 3 kg')).toBeInTheDocument();
    expect(screen.getByText('79 kg (−1)')).toBeInTheDocument();
    const principal = screen.getByRole('main');
    expect(within(principal).queryByRole('button')).not.toBeInTheDocument();
    expect(urls).toEqual(['/api/clientes/me/entrenamiento']);
  });

  it('sin entrenador ni registros: estados vacíos claros', async () => {
    abrir('cliente', VACIO);
    expect(await screen.findByText('Aún no tienes entrenador asignado. Pregunta en recepción.')).toBeInTheDocument();
    expect(screen.getByText('Aún no tienes rutina')).toBeInTheDocument();
    expect(screen.getByText('Sin objetivos registrados.')).toBeInTheDocument();
    expect(screen.getByText('Sin avances registrados.')).toBeInTheDocument();
  });

  it('aparece en el menú del cliente', async () => {
    abrir('cliente');
    const menu = await screen.findByRole('navigation', { name: /menú principal/i });
    expect(within(menu).getByRole('link', { name: 'Mi entrenamiento' })).toHaveAttribute('href', '/mi-entrenamiento');
  });

  for (const rol of ['administrador', 'recepcionista', 'entrenador']) {
    it(`${rol}: "Sin permiso" y no se pide nada`, async () => {
      const urls = abrir(rol);
      expect(await screen.findByText('Sin permiso')).toBeInTheDocument();
      expect(urls.filter((u) => u.includes('/me/entrenamiento'))).toEqual([]);
    });
  }
});
