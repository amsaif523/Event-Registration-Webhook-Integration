import { cn } from '../../lib/cn.js';
import { formatNumber } from '../../lib/format.js';
import Icon from '../icons/Icon.jsx';

/**
 * Label, one large tabular number, one line of context. The rejected-webhooks
 * card turns red-tinted the moment the value goes above zero, because that is
 * the number you want someone to notice without hunting for it.
 */
export default function StatCard({ label, value, context, icon, alert = false, className = '' }) {
  return (
    <div
      className={cn(
        'card p-4 transition-colors duration-200 sm:p-5',
        alert && 'border-red-200 bg-red-50/60',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            'text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]',
            alert ? 'text-red-700' : 'text-meta',
          )}
        >
          {label}
        </p>
        {icon && (
          <Icon
            name={icon}
            size={17}
            className={cn('shrink-0', alert ? 'text-red-500' : 'text-meta')}
          />
        )}
      </div>

      <p
        className={cn(
          'tabular mt-3 font-display text-[28px] font-bold leading-none tracking-tight sm:text-[34px]',
          alert ? 'text-red-700' : 'text-ink',
        )}
      >
        {formatNumber(value)}
      </p>

      {context && (
        <p className={cn('mt-2 text-[12px] leading-snug sm:mt-2.5 sm:text-[13px]', alert ? 'text-red-600' : 'text-body')}>
          {context}
        </p>
      )}
    </div>
  );
}
