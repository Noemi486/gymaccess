import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Badge from '../src/components/ui/Badge.jsx';
import Button from '../src/components/ui/Button.jsx';
import ConfirmDialog from '../src/components/ui/ConfirmDialog.jsx';
import FormField from '../src/components/ui/FormField.jsx';
import Input from '../src/components/ui/Input.jsx';
import Pagination from '../src/components/ui/Pagination.jsx';
import Table from '../src/components/ui/Table.jsx';
import { ToastProvider, useToast } from '../src/components/ui/Toast.jsx';

describe('Badge', () => {
  it('siempre muestra texto además del color', () => {
    const estados = ['activo', 'inactivo', 'vigente', 'vencida', 'suspendida', 'cancelada', 'autorizado', 'rechazado'];
    for (const estado of estados) {
      const { unmount } = render(<Badge estado={estado} />);
      expect(screen.getByText(new RegExp(`^${estado}$`, 'i'))).toBeInTheDocument();
      unmount();
    }
  });

  it('muestra los estados de membresía con su texto y su variante (color + texto)', () => {
    const esperado = {
      vigente: ['Vigente', 'badge-exito'],
      por_vencer: ['Por vencer', 'badge-advertencia'],
      pendiente_de_pago: ['Pendiente de pago', 'badge-advertencia'],
      proxima: ['Próxima', 'badge-info'],
      vencida: ['Vencida', 'badge-error'],
      suspendida: ['Suspendida', 'badge-advertencia'],
      cancelada: ['Cancelada', 'badge-error'],
      autorizado: ['Autorizado', 'badge-exito'],
      rechazado: ['Rechazado', 'badge-error'],
    };
    for (const [estado, [texto, clase]] of Object.entries(esperado)) {
      const { unmount } = render(<Badge estado={estado} />);
      expect(screen.getByText(texto)).toHaveClass('badge', clase);
      unmount();
    }
  });

  it('usa una variante distinta para activo e inactivo', () => {
    render(
      <>
        <Badge estado="activo" />
        <Badge estado="inactivo" />
      </>,
    );
    expect(screen.getByText('Activo')).toHaveClass('badge-exito');
    expect(screen.getByText('Inactivo')).toHaveClass('badge-neutral');
  });
});

describe('FormField', () => {
  it('asocia etiqueta, ayuda y error con el campo', () => {
    render(
      <FormField id="nombre" etiqueta="Nombre" ayuda="Como aparece en el documento" error="Este campo es obligatorio.">
        <Input />
      </FormField>,
    );
    const campo = screen.getByLabelText('Nombre');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAccessibleDescription(/documento.*obligatorio/i);
    expect(screen.getByRole('alert')).toHaveTextContent('Este campo es obligatorio.');
  });

  it('no marca el campo como inválido sin error', () => {
    render(
      <FormField id="correo" etiqueta="Correo">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Correo')).not.toHaveAttribute('aria-invalid');
  });
});

describe('Table', () => {
  const columnas = [
    { clave: 'nombre', etiqueta: 'Nombre' },
    { clave: 'estado', etiqueta: 'Estado', render: (fila) => <Badge estado={fila.estado} /> },
  ];

  it('muestra encabezados y filas', () => {
    render(<Table columnas={columnas} filas={[{ id: 1, nombre: 'Ana', estado: 'activo' }]} />);
    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay filas', () => {
    render(<Table columnas={columnas} filas={[]} />);
    expect(screen.getByText('Sin resultados')).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('con cargando queda deshabilitado y avisa que está ocupado', () => {
    const alPulsar = vi.fn();
    render(
      <Button cargando onClick={alPulsar}>
        Guardar
      </Button>,
    );
    const boton = screen.getByRole('button', { name: /guardar/i });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(boton);
    expect(alPulsar).not.toHaveBeenCalled();
  });

  it('con `to` se muestra como enlace', () => {
    render(
      <MemoryRouter>
        <Button to="/clientes/nuevo">Nuevo cliente</Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Nuevo cliente' })).toHaveAttribute('href', '/clientes/nuevo');
  });
});

describe('Pagination', () => {
  it('muestra "Página N de M" y navega', () => {
    const alCambiar = vi.fn();
    render(<Pagination page={2} limit={20} total={50} onCambiar={alCambiar} />);
    expect(screen.getByText(/página 2 de 3/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    expect(alCambiar).toHaveBeenCalledWith(3);
  });
});

describe('ConfirmDialog', () => {
  function abrir(props = {}) {
    const alConfirmar = vi.fn();
    const alCancelar = vi.fn();
    render(
      <ConfirmDialog abierto titulo="Inactivar cliente" textoConfirmar="Inactivar" onConfirmar={alConfirmar} onCancelar={alCancelar} {...props} />,
    );
    return { alConfirmar, alCancelar };
  }

  it('confirma y cancela con sus botones', () => {
    const { alConfirmar, alCancelar } = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
    expect(alConfirmar).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(alCancelar).toHaveBeenCalledTimes(1);
  });

  it('pone el foco en Cancelar y Escape cancela', () => {
    const { alCancelar } = abrir();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(alCancelar).toHaveBeenCalledTimes(1);
  });

  it('no se muestra cerrado', () => {
    render(<ConfirmDialog abierto={false} onConfirmar={() => {}} onCancelar={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  function Disparador() {
    const { mostrar } = useToast();
    return <button onClick={() => mostrar({ tipo: 'error', texto: 'No se pudo guardar.' })}>Probar</button>;
  }

  it('muestra un aviso de error y se puede cerrar', () => {
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Probar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo guardar.');
    fireEvent.click(screen.getByRole('button', { name: /cerrar aviso/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('el aviso se oculta solo', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Disparador />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Probar' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
