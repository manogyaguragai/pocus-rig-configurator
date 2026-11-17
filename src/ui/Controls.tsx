import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export const ICON = { size: 16, strokeWidth: 1.5, 'aria-hidden': true } as const;

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  help?: ReactNode;
};

export function Slider({ label, value, min, max, step, format, onChange, help }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="field">
      <div className="field-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="num">
          {format(value)}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--p': `${pct}%` } as React.CSSProperties}
        aria-valuetext={format(value)}
        aria-describedby={help ? `${id}-help` : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
      />
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
