import { cn } from '../../lib/cn.js';

/**
 * Shared bits for the detail panels.
 *
 * The desktop table is react-data-table-component (see DataTable.jsx); below
 * `sm` each admin screen renders its own card list, because a horizontally
 * scrolling table at 390px is not a mobile design, it is a desktop table
 * someone gave up on.
 */

/** Label / value pair used inside the detail panels. */
export function DetailRow({ label, children, className = '', mono = false }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-2.5', className)}>
      <dt className="shrink-0 text-[13px] text-meta">{label}</dt>
      <dd className={cn('min-w-0 text-right text-[13px] text-ink', mono && 'font-mono text-xs')}>{children}</dd>
    </div>
  );
}
