import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

function respuesta(status, cuerpo) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

const plan = (id, nombre, extra = {}) => ({
  id_tipo_membresia: id,
  nombre,
  descripcion: id === 1 ? 'Acceso libre' : null,
  duracion: 30,
  precio: 450,
  estado: 'activo',
  ...extra,
});

function cuentaDe(rol) {
  return { id_usuario: 9, nombre: 'Persona', correo: 'p@example.com', rol, estado: 'activo', id_cliente: null };
}

// Abre /tipos-membresia con la API simulada. `reglas` permite responder según método y ruta.
function abrir(rol, { planes = [plan(1, 'Plan Mensual'), plan(2, 'Plan Anual', { duracion: 365, precio: 4200, estado: 'inactivo' })], detalle, alGuardar } = {}) {
  const cuenta = cuentaDe(rol);
  sessionStorage.setItem('gym_token', 'token-de-prueba');
  sessionStorage.setItem('gym_usuario', JSON.stringify(cuenta));
  const llamadas = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, opciones = {}) => {
      const metodo = opciones.method ?? 'GET';
      llamadas.push({ url, metodo, cuerpo: opciones.body ? JSON.parse(opciones.body) : undefined });
      if (url === '/api/auth/me') return respuesta(200, cuenta);
      if (url.startsWith('/api/tipos-membresia?')) {
        const visibles = rol === 'recepcionista' ? planes.filter((p) => p.estado === 'activo') : planes;
        return respuesta(200, { data: visibles, page: 1, limit: 20, total: visibles.length });
      }
      const coincide = url.match(/^\/api\/tipos-membresia\/(\d+)(\/estado)?$/);
      if (coincide && metodo === 'GET') {
        const encontrado = planes.find((p) => p.id_tipo_membresia === Number(coincide[1]));
        return respuesta(200, { ...encontrado, membresias_pendientes_de_pago: detalle?.pendientes ?? 0 });
      }
      if (alGuardar) {
        const resultado = alGuardar(url, metodo, opciones.body ? JSON.parse(opciones.body) : undefined);
        if (resultado) return resultado;
      }
      return respuesta(404, { error: { code: 'NOT_FOUND', message: 'No existe.' } });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/tipos-membresia']}>
      <App />
    </MemoryRouter>,
  );
  return llamadas;
}

describe('Tipos de membresía', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  describe('lista', () => {
    it('muestra nombre, duración, precio con formato de moneda y estado con texto', async () => {
      abrir('administrador');
      const tabla = await screen.findByRole('table', { name: /tipos de membresía/i });
      expect(within(tabla).getByText('Plan Mensual')).toBeInTheDocument();
      expect(within(tabla).getByText('Acceso libre')).toBeInTheDocument();
      expect(within(tabla).getByText('30 días')).toBeInTheDocument();
      expect(within(tabla).getByText('$450.00')).toBeInTheDocument();
      expect(within(tabla).getByText('$4,200.00')).toBeInTheDocument();
      expect(within(tabla.querySelectorAll('tbody tr')[0]).getByText('Activo')).toBeInTheDocument();
      expect(within(tabla.querySelectorAll('tbody tr')[1]).getByText('Inactivo')).toBeInTheDocument();
    });

    it('sin planes muestra un estado vacío', async () => {
      abrir('administrador', { planes: [] });
      expect(await screen.findByText('No hay tipos de membresía.')).toBeInTheDocument();
      expect(screen.getByText(/nuevo tipo/i, { selector: 'p' })).toBeInTheDocument();
    });

    it('la búsqueda y el filtro de estado se envían al servidor (administrador)', async () => {
      const llamadas = abrir('administrador');
      await screen.findByText('Plan Mensual');
      fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: ' Mensual ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
      await waitFor(() => expect(llamadas.some((l) => l.url.includes('q=Mensual'))).toBe(true));
      fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'inactivo' } });
      await waitFor(() => expect(llamadas.some((l) => l.url.includes('estado=inactivo'))).toBe(true));
    });
  });

  describe('permisos en la interfaz', () => {
    it('el administrador ve "Nuevo tipo", editar y activar o desactivar', async () => {
      abrir('administrador');
      await screen.findByText('Plan Mensual');
      expect(screen.getByRole('button', { name: /nuevo tipo/i })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: 'Editar' })).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Desactivar' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Activar' })).toBeInTheDocument();
    });

    it('el recepcionista solo consulta: sin botones de gestión, sin filtro de estado y solo planes activos', async () => {
      const llamadas = abrir('recepcionista');
      await screen.findByText('Plan Mensual');
      expect(screen.queryByText('Plan Anual')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /nuevo tipo/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /editar|desactivar|activar/i })).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Estado')).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument();
      expect(llamadas.every((l) => !l.url.includes('estado='))).toBe(true);
    });

    it('el entrenador y el cliente ven "Sin permiso" y no se consulta ningún plan', async () => {
      for (const rol of ['entrenador', 'cliente']) {
        sessionStorage.clear();
        const llamadas = abrir(rol);
        expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
        expect(llamadas.some((l) => l.url.startsWith('/api/tipos-membresia'))).toBe(false);
        document.body.innerHTML = '';
        vi.unstubAllGlobals();
      }
    });
  });

  describe('alta', () => {
    it('registra un plan, avisa con un mensaje de éxito y recarga la lista', async () => {
      const llamadas = abrir('administrador', {
        alGuardar: (url, metodo) => (url === '/api/tipos-membresia' && metodo === 'POST' ? respuesta(201, plan(3, 'Plan Trimestral', { duracion: 90, precio: 1200 })) : null),
      });
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getByRole('button', { name: /nuevo tipo/i }));

      const dialogo = await screen.findByRole('dialog', { name: /nuevo tipo de membresía/i });
      fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: ' Plan Trimestral ' } });
      fireEvent.change(within(dialogo).getByLabelText('Duración (días)'), { target: { value: '90' } });
      fireEvent.change(within(dialogo).getByLabelText('Precio'), { target: { value: '1200' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('Plan registrado.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      const envio = llamadas.find((l) => l.metodo === 'POST');
      expect(envio.cuerpo).toEqual({ nombre: 'Plan Trimestral', duracion: 90, precio: '1200' });
    });

    it('muestra los errores del servidor junto a cada campo (nombre repetido, precio 0)', async () => {
      abrir('administrador', {
        alGuardar: (url, metodo) =>
          url === '/api/tipos-membresia' && metodo === 'POST'
            ? respuesta(400, {
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Revisa los datos enviados.',
                  details: [
                    { field: 'nombre', message: 'Ese nombre ya está en uso.' },
                    { field: 'precio', message: 'El precio debe ser mayor a 0, con a lo más 2 decimales.' },
                  ],
                },
              })
            : null,
      });
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getByRole('button', { name: /nuevo tipo/i }));
      const dialogo = await screen.findByRole('dialog');
      fireEvent.change(within(dialogo).getByLabelText('Nombre'), { target: { value: 'Plan Mensual' } });
      fireEvent.change(within(dialogo).getByLabelText('Duración (días)'), { target: { value: '30' } });
      fireEvent.change(within(dialogo).getByLabelText('Precio'), { target: { value: '0' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

      expect(await within(dialogo).findByText('Ese nombre ya está en uso.')).toBeInTheDocument();
      expect(within(dialogo).getByText('El precio debe ser mayor a 0, con a lo más 2 decimales.')).toBeInTheDocument();
      expect(within(dialogo).getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
      expect(within(dialogo).getByLabelText('Precio')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('dialog')).toBeInTheDocument(); // el diálogo sigue abierto
    });

    it('Cancelar y Escape cierran el diálogo sin enviar nada', async () => {
      const llamadas = abrir('administrador');
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getByRole('button', { name: /nuevo tipo/i }));
      await screen.findByRole('dialog');
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /nuevo tipo/i }));
      await screen.findByRole('dialog');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(llamadas.some((l) => l.metodo === 'POST')).toBe(false);
    });
  });

  describe('edición', () => {
    it('envía solo los campos que cambiaron', async () => {
      const llamadas = abrir('administrador', {
        alGuardar: (url, metodo) => (metodo === 'PATCH' && url === '/api/tipos-membresia/1' ? respuesta(200, plan(1, 'Plan Mensual', { descripcion: 'Acceso libre', duracion: 30, precio: 480 })) : null),
      });
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);

      const dialogo = await screen.findByRole('dialog', { name: /editar tipo de membresía/i });
      await waitFor(() => expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('Plan Mensual'));
      fireEvent.change(within(dialogo).getByLabelText('Precio'), { target: { value: '480' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('Plan actualizado.')).toBeInTheDocument();
      expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo).toEqual({ precio: '480' });
    });

    it('si no hay cambios avisa y no envía nada', async () => {
      const llamadas = abrir('administrador');
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
      const dialogo = await screen.findByRole('dialog');
      await waitFor(() => expect(within(dialogo).getByLabelText('Nombre')).toHaveValue('Plan Mensual'));
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
      expect(await within(dialogo).findByText('No hay cambios para guardar.')).toBeInTheDocument();
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
    });

    it('al cambiar el precio de un plan con membresías pendientes de pago advierte y pide confirmar', async () => {
      const llamadas = abrir('administrador', {
        detalle: { pendientes: 2 },
        alGuardar: (url, metodo) => (metodo === 'PATCH' ? respuesta(200, plan(1, 'Plan Mensual', { precio: 600 })) : null),
      });
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
      const dialogo = await screen.findByRole('dialog', { name: /editar tipo de membresía/i });
      await waitFor(() => expect(within(dialogo).getByLabelText('Precio')).toHaveValue(450));
      fireEvent.change(within(dialogo).getByLabelText('Precio'), { target: { value: '600' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

      const aviso = await screen.findByRole('dialog', { name: /cambiar el precio del plan/i });
      expect(aviso).toHaveTextContent('2 membresías pendientes de pago');
      expect(aviso).toHaveTextContent('$600.00');
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);

      fireEvent.click(within(aviso).getByRole('button', { name: 'Cambiar precio' }));
      expect(await screen.findByText('Plan actualizado.')).toBeInTheDocument();
      expect(llamadas.filter((l) => l.metodo === 'PATCH')).toHaveLength(1);
    });

    it('cancelar la advertencia no guarda nada y conserva el diálogo de edición', async () => {
      const llamadas = abrir('administrador', { detalle: { pendientes: 1 } });
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
      const dialogo = await screen.findByRole('dialog', { name: /editar tipo de membresía/i });
      await waitFor(() => expect(within(dialogo).getByLabelText('Precio')).toHaveValue(450));
      fireEvent.change(within(dialogo).getByLabelText('Precio'), { target: { value: '500' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));

      const aviso = await screen.findByRole('dialog', { name: /cambiar el precio del plan/i });
      expect(aviso).toHaveTextContent('1 membresía pendiente de pago');
      fireEvent.click(within(aviso).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog', { name: /cambiar el precio del plan/i })).not.toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /editar tipo de membresía/i })).toBeInTheDocument();
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);
    });

    it('un cambio de precio sin membresías pendientes se guarda sin advertencia', async () => {
      abrir('administrador', {
        detalle: { pendientes: 0 },
        alGuardar: (url, metodo) => (metodo === 'PATCH' ? respuesta(200, plan(1, 'Plan Mensual', { precio: 600 })) : null),
      });
      await screen.findByText('Plan Mensual');
      fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
      const dialogo = await screen.findByRole('dialog', { name: /editar tipo de membresía/i });
      await waitFor(() => expect(within(dialogo).getByLabelText('Precio')).toHaveValue(450));
      fireEvent.change(within(dialogo).getByLabelText('Precio'), { target: { value: '600' } });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Guardar' }));
      expect(await screen.findByText('Plan actualizado.')).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /cambiar el precio del plan/i })).not.toBeInTheDocument();
    });
  });

  describe('activar y desactivar', () => {
    it('desactivar pide confirmación: cancelar no cambia nada y confirmar envía el estado', async () => {
      const llamadas = abrir('administrador', {
        alGuardar: (url, metodo) => (metodo === 'PATCH' && url === '/api/tipos-membresia/1/estado' ? respuesta(200, plan(1, 'Plan Mensual', { estado: 'inactivo' })) : null),
      });
      await screen.findByText('Plan Mensual');

      fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
      let dialogo = await screen.findByRole('dialog', { name: /desactivar plan/i });
      expect(dialogo).toHaveTextContent('Plan Mensual');
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(llamadas.some((l) => l.metodo === 'PATCH')).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
      dialogo = await screen.findByRole('dialog', { name: /desactivar plan/i });
      fireEvent.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));

      expect(await screen.findByText('Plan desactivado.')).toBeInTheDocument();
      expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo).toEqual({ estado: 'inactivo' });
    });

    it('activar un plan inactivo no pide confirmación', async () => {
      const llamadas = abrir('administrador', {
        alGuardar: (url, metodo) => (metodo === 'PATCH' && url === '/api/tipos-membresia/2/estado' ? respuesta(200, plan(2, 'Plan Anual', { estado: 'activo' })) : null),
      });
      await screen.findByText('Plan Anual');
      fireEvent.click(screen.getByRole('button', { name: 'Activar' }));
      expect(await screen.findByText('Plan activado.')).toBeInTheDocument();
      expect(llamadas.find((l) => l.metodo === 'PATCH').cuerpo).toEqual({ estado: 'activo' });
    });

    it('si falla el servidor muestra el error', async () => {
      abrir('administrador', {
        alGuardar: (url, metodo) => (metodo === 'PATCH' ? respuesta(500, { error: { code: 'INTERNAL_ERROR', message: 'Algo salió mal.' } }) : null),
      });
      await screen.findByText('Plan Anual');
      fireEvent.click(screen.getByRole('button', { name: 'Activar' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal.');
    });
  });
});
