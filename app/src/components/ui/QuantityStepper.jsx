'use client';
// QuantityStepper — v4.9 atom (oct-new-ui "Quantity stepper"): a whole-number field with − / + buttons, clamped to min/max.
// FROZEN API: <QuantityStepper value onChange={(n) => …} min? max? step?={1} disabled? aria-label? id? />
import { Minus, Plus } from 'lucide-react';

export default function QuantityStepper({ value, onChange, min, max, step = 1, disabled, id, ...rest }) {
  const n = Number(value ?? 0) || 0;
  const clamp = (v) => Math.min(typeof max === 'number' ? max : Infinity, Math.max(typeof min === 'number' ? min : -Infinity, v));
  const set = (v) => onChange?.(clamp(v));
  return (
    <div className="qty-stepper" data-disabled={disabled ? 'true' : undefined}>
      <button type="button" aria-label="Decrease" disabled={disabled || (typeof min === 'number' && n <= min)} onClick={() => set(n - step)}><Minus size={14} /></button>
      <input id={id} inputMode="numeric" value={value ?? ''} disabled={disabled} aria-label={rest['aria-label']}
        onChange={(e) => { const d = e.target.value.replace(/[^\d-]/g, ''); onChange?.(d === '' || d === '-' ? d : clamp(Number(d))); }} />
      <button type="button" aria-label="Increase" disabled={disabled || (typeof max === 'number' && n >= max)} onClick={() => set(n + step)}><Plus size={14} /></button>
    </div>
  );
}
