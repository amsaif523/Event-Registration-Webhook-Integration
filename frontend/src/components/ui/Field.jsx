import { useId } from 'react';
import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';

/**
 * Shared shell for every form control: label, required marker, helper text and
 * the error message, wired together with aria-describedby so screen readers
 * announce the error with the field rather than separately.
 */
export function Field({ label, required, helper, error, htmlFor, children, className = '', counter }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-brand-600" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        {counter && <span className="text-xs tabular text-meta">{counter}</span>}
      </div>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-[13px] text-red-600">
          <Icon name="alertCircle" size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : (
        helper && <p className="text-[13px] text-meta">{helper}</p>
      )}
    </div>
  );
}

const controlBase =
  'w-full rounded border bg-white px-3 text-ink placeholder:text-meta transition-colors duration-150 ease-out ' +
  'hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-meta';

export function TextInput({ error, className = '', ...rest }) {
  return (
    <input
      className={cn(
        controlBase,
        'h-11',
        error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25' : 'border-hairline',
        className,
      )}
      aria-invalid={error ? 'true' : undefined}
      {...rest}
    />
  );
}

export function TextArea({ error, className = '', rows = 4, ...rest }) {
  return (
    <textarea
      rows={rows}
      className={cn(
        controlBase,
        'resize-y py-2.5 leading-relaxed',
        error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/25' : 'border-hairline',
        className,
      )}
      aria-invalid={error ? 'true' : undefined}
      {...rest}
    />
  );
}

/** Number input with explicit steppers: easier than a spinner on touch. */
export function NumberStepper({ value, onChange, min = 0, max = 100000, error, id, ...rest }) {
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const numeric = Number(value);
  const step = (delta) => {
    const next = Math.min(Math.max((Number.isFinite(numeric) ? numeric : 0) + delta, min), max);
    onChange(String(next));
  };

  return (
    <div
      className={cn(
        'flex h-11 items-stretch overflow-hidden rounded border bg-white transition-colors duration-150',
        'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25',
        error ? 'border-red-400' : 'border-hairline',
      )}
    >
      <button
        type="button"
        onClick={() => step(-1)}
        aria-label="Decrease capacity"
        className="grid w-11 shrink-0 place-items-center border-r border-hairline text-body transition-colors hover:bg-slate-50 active:bg-slate-100"
      >
        <Icon name="x" size={13} className="rotate-45" />
      </button>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className="tabular w-full min-w-0 border-0 bg-transparent px-3 text-center text-ink focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-invalid={error ? 'true' : undefined}
        {...rest}
      />
      <button
        type="button"
        onClick={() => step(1)}
        aria-label="Increase capacity"
        className="grid w-11 shrink-0 place-items-center border-l border-hairline text-body transition-colors hover:bg-slate-50 active:bg-slate-100"
      >
        <Icon name="plus" size={14} />
      </button>
    </div>
  );
}
