import { cn } from '../../lib/cn.js';

/** Toggle chip with an optional count, used on the events grid and webhook log. */
export default function FilterChip({ active, count, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium',
        'transition-colors duration-150 ease-out',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-hairline bg-white text-body hover:border-slate-300 hover:text-ink',
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            'tabular rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
            active ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
