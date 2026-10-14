import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Button from './ui/Button.jsx';

// Buscador grande del inicio: lleva a la lista de clientes con el texto ya aplicado (/clientes?q=…).
export default function BuscadorClientes({ placeholder = 'Nombre o apellido' }) {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');

  function buscar(evento) {
    evento.preventDefault();
    const q = texto.trim();
    navegar(q ? `/clientes?q=${encodeURIComponent(q)}` : '/clientes');
  }

  return (
    <form role="search" aria-label="Buscar clientes" className="buscador" onSubmit={buscar}>
      <label htmlFor="buscador-inicio" className="solo-lectores">
        Buscar clientes
      </label>
      <Search size={20} className="buscador-icono" aria-hidden="true" />
      <input
        id="buscador-inicio"
        type="search"
        className="buscador-campo"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={placeholder}
        maxLength={150}
        autoComplete="off"
      />
      <Button type="submit">Buscar</Button>
    </form>
  );
}
