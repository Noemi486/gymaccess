import FormField from './ui/FormField.jsx';
import Select from './ui/Select.jsx';

export const METODOS_PAGO = [
  { valor: 'efectivo', etiqueta: 'Efectivo' },
  { valor: 'tarjeta', etiqueta: 'Tarjeta' },
  { valor: 'transferencia', etiqueta: 'Transferencia' },
];

// Selector del método de pago (efectivo, tarjeta o transferencia).
export default function SelectorMetodoPago({ id = 'metodo-pago', valor, onChange, error }) {
  return (
    <FormField id={id} etiqueta="Método de pago" error={error}>
      <Select value={valor} onChange={(e) => onChange(e.target.value)}>
        {METODOS_PAGO.map((m) => (
          <option key={m.valor} value={m.valor}>
            {m.etiqueta}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
