import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { commitValue } from './format';

export const ICON = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Factory default; drawn as a labelled tick */
  default: number;
  /** Decimals shown: 1 for lengths, 2 for clearance */
  decimals: 1 | 2;
  onChange: (v: number) => void;
  help?: ReactNode;
};

const clampTo = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Tick fractions (0..1): every step when there are few, otherwise ten divisions. */
function tickFractions(min: number, max: number, step: number): number[] {
  const steps = Math.round((max - min) / step);
  const n = steps <= 10 ? steps : 10;
  return Array.from({ length: n + 1 }, (_, i) => i / n);
}

export function Slider({ label, value, min, max, step, default: def, decimals, onChange, help }: SliderProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const span = max - min;
  const frac = (v: number) => (v - min) / span;
  const fmt = (v: number) => `${v.toFixed(decimals)} mm`;

  const commit = () => {
    if (draft === null) return;
    const n = commitValue(draft, { min, max, step });
    if (n !== null && n !== value) onChange(n);
    setDraft(null);
  };
  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setDraft(null);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const dir = e.key === 'ArrowUp' ? 1 : -1;
      const n = commitValue(String(value + dir * step), { min, max, step });
      if (n !== null) onChange(n);
      setDraft(null);
    }
  };

  const labelled = [min, max, ...(frac(def) > 0.1 && frac(def) < 0.9 ? [def] : [])];
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <span className="numfield">
          <input
            type="text"
            inputMode="decimal"
            className="num numinput"
            aria-label={`${label}, type a value`}
            value={draft ?? value.toFixed(decimals)}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={commit}
            onKeyDown={onInputKey}
          />
          <span className="unit num" aria-hidden="true">
            mm
          </span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampTo(value, min, max)}
        style={{ '--f': frac(clampTo(value, min, max)) } as CSSProperties}
        aria-valuetext={fmt(value)}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="ticks" aria-hidden="true">
        {tickFractions(min, max, step).map((f) => (
          <span key={f} className="tick" style={{ '--f': f } as CSSProperties} />
        ))}
        <span className="tick default" style={{ '--f': frac(def) } as CSSProperties} />
        {labelled.map((v) => (
          <span key={v} className="tick-label num" style={{ '--f': frac(v) } as CSSProperties}>
            {v.toFixed(decimals)}
          </span>
        ))}
      </div>
      {help && (
        <p className="help" id={`${id}-help`}>
          {help}
        </p>
      )}
    </div>
  );
}

type Option<T extends string> = { value: T; label: string };

type SelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  help?: ReactNode;
  /** Visually hide the label (a section heading already names the control) */
  hideLabel?: boolean;
};

export function SelectField<T extends string>({ label, value, options, onChange, help, hideLabel }: SelectProps<T>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'field-label sr' : 'field-label'}>
        {label}
      </label>
      <div className="select">
        <select
          id={id}
          value={value}
          aria-describedby={help ? `${id}-help` : undefined}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown {...ICON} />
      </div>
      {help && (
        <p className="help" id={`${id}-help`}>
          {help}
        </p>
      )}
    </div>
  );
}

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  className?: string;
};

/** Radiogroup with roving tabindex; arrow keys move and select. */
export function Segmented<T extends string>({ label, value, options, onChange, className }: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = options.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };

  return (
    <div className={`seg ${className ?? ''}`} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === idx}
          tabIndex={i === idx ? 0 : -1}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
