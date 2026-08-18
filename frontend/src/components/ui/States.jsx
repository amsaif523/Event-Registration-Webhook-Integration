import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';
import Button from './Button.jsx';

/* ------------------------------------------------------------------ loading */

/**
 * Skeletons mirror the shape of the real layout rather than replacing it with a
 * centred spinner, so the page does not jump when data arrives.
 */
export function Skeleton({ className = '' }) {
  return <div className={cn('skeleton', className)} />;
}

export function EventCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex gap-4">
        <Skeleton className="h-16 w-14 rounded-lg" />
        <div className="flex-1 space-y-2.5 pt-1">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
      <Skeleton className="mt-5 h-3 w-1/2" />
      <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
      <Skeleton className="mt-5 h-11 w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="divide-y divide-hairline">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-5 py-4">
          {Array.from({ length: columns }).map((_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn('h-3.5', columnIndex === 0 ? 'w-1/4' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card p-4 sm:p-5">
      <Skeleton className="h-3 w-20 sm:w-24" />
      <Skeleton className="mt-4 h-7 w-14 sm:h-8 sm:w-16" />
      <Skeleton className="mt-3 h-3 w-24 sm:w-32" />
    </div>
  );
}

/* -------------------------------------------------------------------- empty */

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  onAction,
  actionIcon,
  className = '',
  compact = false,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 text-center',
        compact ? 'py-10' : 'py-16',
        className,
      )}
    >
      <div className="relative mb-5 grid h-14 w-14 place-items-center rounded-full border border-hairline bg-white">
        <span className="absolute inset-0 -z-10 rounded-full bg-brand-50/70 blur-md" />
        <Icon name={icon} size={24} className="text-brand-500" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-body">{description}</p>}
      {action && (
        <Button className="mt-5" variant="secondary" icon={actionIcon} onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- error */

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this right now. It is usually temporary.',
  onRetry,
  className = '',
}) {
  return (
    <div className={cn('card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center', className)}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
        <Icon name="alertTriangle" size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-sm text-body">{description}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" icon="refresh" onClick={onRetry} className="shrink-0">
          Try again
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ banners */

const BANNER_TONES = {
  error: { wrap: 'border-red-200 bg-red-50', icon: 'text-red-600', title: 'text-red-800', body: 'text-red-700' },
  warning: {
    wrap: 'border-amber-200 bg-amber-50',
    icon: 'text-amber-600',
    title: 'text-amber-800',
    body: 'text-amber-700',
  },
  success: {
    wrap: 'border-emerald-200 bg-emerald-50',
    icon: 'text-emerald-600',
    title: 'text-emerald-800',
    body: 'text-emerald-700',
  },
  info: { wrap: 'border-brand-200 bg-brand-50', icon: 'text-brand-600', title: 'text-brand-800', body: 'text-brand-700' },
};

const BANNER_ICONS = {
  error: 'alertCircle',
  warning: 'alertTriangle',
  success: 'checkCircle',
  info: 'alertCircle',
};

export function Banner({ tone = 'info', title, children, onDismiss, className = '', icon }) {
  const styles = BANNER_TONES[tone] ?? BANNER_TONES.info;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-card border p-4 animate-slide-up', styles.wrap, className)}
    >
      <Icon name={icon ?? BANNER_ICONS[tone]} size={18} className={cn('mt-0.5 shrink-0', styles.icon)} />
      <div className="min-w-0 flex-1">
        {title && <p className={cn('text-sm font-semibold', styles.title)}>{title}</p>}
        {children && <div className={cn('text-[13px] leading-relaxed', styles.body, title && 'mt-0.5')}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn('shrink-0 rounded p-1 transition-colors hover:bg-black/5', styles.icon)}
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
}
