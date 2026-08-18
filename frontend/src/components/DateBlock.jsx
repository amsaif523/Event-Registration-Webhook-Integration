import { cn } from '../lib/cn.js';
import { dayNumber, monthShort } from '../lib/format.js';

/** Calendar-tile date: month above, day number large. */
export default function DateBlock({ date, muted = false, size = 'md', className = '' }) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-lg border text-center',
        size === 'lg' ? 'h-[72px] w-16' : 'h-14 w-[52px]',
        muted ? 'border-hairline bg-slate-50' : 'border-brand-100 bg-brand-50',
        className,
      )}
    >
      <span
        className={cn(
          'text-[10px] font-semibold uppercase tracking-widest',
          muted ? 'text-meta' : 'text-brand-600',
        )}
      >
        {monthShort(date)}
      </span>
      <span
        className={cn(
          'tabular font-display font-bold leading-none tracking-tight',
          size === 'lg' ? 'text-[26px]' : 'text-[21px]',
          muted ? 'text-slate-500' : 'text-ink',
        )}
      >
        {dayNumber(date)}
      </span>
    </div>
  );
}
