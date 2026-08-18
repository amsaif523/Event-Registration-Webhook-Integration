import { cn } from '../lib/cn.js';

/** Wordmark. The mark is a ticket notch cut into a square, not an emoji. */
export default function Wordmark({ className = '', showText = true, subtitle, tone = 'dark' }) {
  const light = tone === 'light';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-lg',
          light ? 'bg-white/10 ring-1 ring-inset ring-white/15' : 'bg-ink',
        )}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4 8.6V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v2.1a3.4 3.4 0 0 0 0 6.8v2.1a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-2.1a3.4 3.4 0 0 0 0-6.8Z"
            stroke="#0FB5C9"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M14 6.5v11" stroke="#0FB5C9" strokeWidth="1.6" strokeDasharray="2 2.4" strokeLinecap="round" />
        </svg>
      </span>
      {showText && (
        <span className="min-w-0">
          <span
            className={cn(
              'block font-display text-[17px] font-bold leading-none tracking-tight',
              light ? 'text-white' : 'text-ink',
            )}
          >
            Eventide
          </span>
          {subtitle && (
            <span
              className={cn(
                'mt-1 block text-[11px] font-medium uppercase tracking-wider',
                light ? 'text-slate-400' : 'text-meta',
              )}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
