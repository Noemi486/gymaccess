import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import CarruselLogin, { DIAPOSITIVAS } from '../src/components/CarruselLogin.jsx';

// Carrusel del panel de marca del inicio de sesión: 3 diapositivas, cambio automático cada 5 segundos,
// pausa con el mouse, puntos clicables y modo de movimiento reducido.

const diapositivas = () => [...document.querySelectorAll('.carrusel-diapositiva')];
const activa = () => document.querySelector('.carrusel-activa');
const puntos = () => screen.getAllByRole('button', { name: /ir a la diapositiva/i });
const avanzar = (ms) => act(() => vi.advanceTimersByTime(ms));

// Simula la preferencia del sistema "reducir movimiento".
function preferirMovimientoReducido(reducir) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((consulta) => ({
      matches: reducir && consulta.includes('prefers-reduced-motion'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('CarruselLogin', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preferirMovimientoReducido(false);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('contenido', () => {
    it('tiene tres diapositivas, cada una con su frase en dos líneas', () => {
      render(<CarruselLogin />);
      expect(diapositivas()).toHaveLength(3);
      const frases = diapositivas().map((d) => [...d.querySelector('.login-frase').children].map((l) => l.textContent));
      expect(frases).toEqual([
        ['Controla quién entra,', 'sin filas.'],
        ['Membresías y pagos,', 'siempre al día.'],
        ['Consulta tu membresía', 'y tus visitas.'],
      ]);
    });

    it('la segunda línea de cada frase lleva el degradado verde', () => {
      render(<CarruselLogin />);
      for (const d of diapositivas()) {
        const lineas = d.querySelector('.login-frase').children;
        expect(lineas[1]).toHaveClass('login-frase-acento');
        expect(lineas[0]).not.toHaveClass('login-frase-acento');
      }
    });

    it('cada diapositiva tiene su propia ilustración decorativa, sin imágenes ni elementos interactivos', () => {
      render(<CarruselLogin />);
      for (const d of diapositivas()) {
        const ilustracion = d.querySelector('.ilustracion');
        expect(ilustracion).toHaveAttribute('aria-hidden', 'true');
        expect(ilustracion.querySelector('img')).not.toBeInTheDocument();
        expect(ilustracion.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
      }
    });

    it('diapositiva 1: rostro escaneado con esquinas, burbuja de acceso autorizado y "128 accesos hoy"', () => {
      render(<CarruselLogin />);
      const ilu = diapositivas()[0].querySelector('.ilustracion');
      expect(ilu.querySelector('.ilu-rostro .ilu-escaner svg')).toBeInTheDocument();
      expect(ilu.querySelectorAll('.ilu-esquina')).toHaveLength(4);
      expect(within(ilu).getByText('Min Cabrera')).toBeInTheDocument();
      expect(ilu.querySelector('.ilu-burbuja')).toHaveTextContent('Acceso autorizado');
      expect(ilu.querySelector('.ilu-burbuja svg')).toBeInTheDocument();
      expect(ilu.querySelector('.stat-card')).toHaveTextContent('128accesos hoy');
    });

    it('diapositiva 2: "Plan Mensual" con Vigente, "Pago registrado $450" y "3 membresías por vencer" en amarillo', () => {
      render(<CarruselLogin />);
      const ilu = diapositivas()[1].querySelector('.ilustracion');
      expect(ilu.querySelector('.ilu-plan')).toHaveTextContent('Plan Mensual');
      expect(within(ilu).getByText('Vigente')).toHaveClass('badge', 'badge-exito');
      expect(ilu.querySelector('.ilu-pago')).toHaveTextContent('Pago registrado');
      expect(ilu.querySelector('.ilu-pago')).toHaveTextContent('$450');
      const alerta = ilu.querySelector('.ilu-alerta');
      expect(alerta).toHaveTextContent('3membresías por vencer');
      expect(alerta).toHaveClass('stat-card');
    });

    it('diapositiva 3: perfil "MC" / "Min Cabrera", "Vence en 18 días" con barra y "Últimas visitas"', () => {
      render(<CarruselLogin />);
      const ilu = diapositivas()[2].querySelector('.ilustracion');
      const perfil = ilu.querySelector('.ilu-perfil');
      expect(within(perfil).getByText('MC')).toHaveClass('avatar');
      expect(within(perfil).getByText('Min Cabrera')).toBeInTheDocument();
      expect(ilu.querySelector('.ilu-vence')).toHaveTextContent('Vence en 18 días');
      expect(ilu.querySelector('.ilu-vence .ilu-barra .ilu-barra-relleno')).toBeInTheDocument();
      const visitas = ilu.querySelector('.ilu-visitas');
      expect(visitas).toHaveTextContent('Últimas visitas');
      expect(visitas.querySelectorAll('li').length).toBeGreaterThanOrEqual(2); // la ilustración está oculta a los lectores de pantalla
    });

    it('no hablan solo a los clientes: la primera y la segunda diapositiva son para el personal', () => {
      expect(DIAPOSITIVAS.map((d) => d.linea1)).toEqual([
        'Controla quién entra,',
        'Membresías y pagos,',
        'Consulta tu membresía',
      ]);
    });
  });

  describe('cambio automático', () => {
    it('empieza en la primera y avanza cada 5 segundos, volviendo a la primera al final', () => {
      render(<CarruselLogin />);
      expect(diapositivas().indexOf(activa())).toBe(0);

      avanzar(4999);
      expect(diapositivas().indexOf(activa())).toBe(0);
      avanzar(1);
      expect(diapositivas().indexOf(activa())).toBe(1);
      avanzar(5000);
      expect(diapositivas().indexOf(activa())).toBe(2);
      avanzar(5000);
      expect(diapositivas().indexOf(activa())).toBe(0);
    });

    it('solo la diapositiva activa es visible para lectores de pantalla', () => {
      render(<CarruselLogin />);
      avanzar(5000);
      const ocultas = diapositivas().filter((d) => d.getAttribute('aria-hidden') === 'true');
      expect(ocultas).toHaveLength(2);
      expect(activa()).not.toHaveAttribute('aria-hidden');
      expect(activa()).toBe(diapositivas()[1]);
    });

    it('se pausa al pasar el mouse y continúa al salir', () => {
      render(<CarruselLogin />);
      const region = screen.getByRole('region', { name: /qué puedes hacer/i });

      fireEvent.mouseEnter(region);
      avanzar(20000);
      expect(diapositivas().indexOf(activa())).toBe(0);

      fireEvent.mouseLeave(region);
      avanzar(5000);
      expect(diapositivas().indexOf(activa())).toBe(1);
    });

    it('se pausa mientras un punto tiene el foco del teclado', () => {
      render(<CarruselLogin />);
      const region = screen.getByRole('region', { name: /qué puedes hacer/i });
      fireEvent.focus(puntos()[0]);
      avanzar(15000);
      expect(diapositivas().indexOf(activa())).toBe(0);
      fireEvent.blur(puntos()[0]);
      avanzar(5000);
      expect(diapositivas().indexOf(activa())).toBe(1);
      expect(region).toBeInTheDocument();
    });

    it('al desmontarse no deja temporizadores pendientes', () => {
      const { unmount } = render(<CarruselLogin />);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('indicadores de puntos', () => {
    it('hay un punto por diapositiva, con nombre accesible y el actual marcado', () => {
      render(<CarruselLogin />);
      expect(puntos().map((p) => p.getAttribute('aria-label'))).toEqual([
        'Ir a la diapositiva 1 de 3',
        'Ir a la diapositiva 2 de 3',
        'Ir a la diapositiva 3 de 3',
      ]);
      expect(puntos()[0]).toHaveAttribute('aria-current', 'true');
      expect(puntos()[1]).not.toHaveAttribute('aria-current');
    });

    it('pulsar un punto lleva a esa diapositiva y reinicia la cuenta de 5 segundos', () => {
      render(<CarruselLogin />);
      avanzar(3000);
      fireEvent.click(puntos()[2]);
      expect(diapositivas().indexOf(activa())).toBe(2);
      expect(puntos()[2]).toHaveAttribute('aria-current', 'true');

      avanzar(4999);
      expect(diapositivas().indexOf(activa())).toBe(2);
      avanzar(1);
      expect(diapositivas().indexOf(activa())).toBe(0);
    });

    it('los puntos son botones reales: se alcanzan con el teclado', () => {
      render(<CarruselLogin />);
      for (const punto of puntos()) {
        expect(punto.tagName).toBe('BUTTON');
        expect(punto).toHaveAttribute('type', 'button');
        expect(punto).not.toHaveAttribute('tabindex', '-1');
      }
    });
  });

  describe('movimiento reducido (prefers-reduced-motion)', () => {
    it('muestra solo la primera diapositiva, sin puntos y sin cambiar nunca', () => {
      preferirMovimientoReducido(true);
      render(<CarruselLogin />);

      expect(diapositivas()).toHaveLength(1);
      expect(diapositivas()[0].querySelector('.login-frase')).toHaveTextContent('Controla quién entra,sin filas.');
      expect(screen.queryByRole('button', { name: /ir a la diapositiva/i })).not.toBeInTheDocument();

      avanzar(60000);
      expect(diapositivas()).toHaveLength(1);
      expect(diapositivas()[0].querySelector('.login-frase')).toHaveTextContent('Controla quién entra,sin filas.');
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
