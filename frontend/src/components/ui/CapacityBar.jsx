import { cn } from '../../lib/cn.js';
import { formatNumber } from '../../lib/format.js';

/**
 * Capacity meter. Colour tracks how full the event is, but the numbers beside
 * it carry the same information in text.
 */
export default function CapacityBar({ taken, capacity, left, showLabel = true, size = 'md', className = '' }) {
  const safeCapacity = Math.max(Number(capacity ?? 0), 0);
  const safeTaken = Math.min(Math.max(Number(taken ?? 0), 0), safeCapacity || Infinity);
  const percent = safeCapacity > 0 ? Math.min((safeTaken / safeCapacity) * 100, 100) : 0;
  const remaining = left ?? Math.max(safeCapacity - safeTaken, 0);

  const tone =
    remaining <= 0 ? 'bg-slate-400' : percent >= 80 ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <div className={className}>
      {showLabel && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
          <span className="tabular font-medium text-ink">
            {remaining <= 0 ? 'No seats left' : `${formatNumber(remaining)} of ${formatNumber(safeCapacity)} seats left`}
          </span>
          <span className="tabular text-meta">{Math.round(percent)}% full</span>
        </div>
      )}
      <div
        className={cn('w-full overflow-hidden rounded-full bg-slate-200', size === 'sm' ? 'h-1' : 'h-1.5')}
        role="progressbar"
        aria-valuenow={safeTaken}
        aria-valuemin={0}
        aria-valuemax={safeCapacity}
        aria-label={`${formatNumber(safeTaken)} of ${formatNumber(safeCapacity)} seats taken`}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tone)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** Compact "96 / 120" variant for the admin events table. */
export function CapacityMini({ taken, capacity }) {
  const safeCapacity = Math.max(Number(capacity ?? 0), 0);
  const safeTaken = Math.max(Number(taken ?? 0), 0);
  const percent = safeCapacity > 0 ? Math.min((safeTaken / safeCapacity) * 100, 100) : 0;
  const tone = percent >= 100 ? 'bg-slate-400' : percent >= 80 ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${percent}%` }} />
      </div>
      <span className="tabular whitespace-nowrap text-[13px] text-body">
        {formatNumber(safeTaken)} / {formatNumber(safeCapacity)}
      </span>
    </div>
  );
}
