import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';
import { useToast } from '../../state/ToastContext.jsx';

const TONES = {
  success: { icon: 'checkCircle', accent: 'text-emerald-600', rule: 'bg-emerald-500' },
  error: { icon: 'alertCircle', accent: 'text-red-600', rule: 'bg-red-500' },
  info: { icon: 'alertCircle', accent: 'text-brand-600', rule: 'bg-brand-500' },
};

/**
 * Bottom-right on desktop, top on mobile so a sticky action bar never covers it.
 */
export default function Toaster() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'pointer-events-none fixed z-[60] flex flex-col gap-2',
        'inset-x-4 top-4 items-center',
        'sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:items-end',
      )}
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.variant] ?? TONES.info;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto relative flex w-full max-w-sm animate-slide-up items-start gap-3 overflow-hidden rounded-card border border-hairline bg-white p-3.5 pl-4 shadow-lift"
          >
            <span className={cn('absolute left-0 top-0 h-full w-1', tone.rule)} />
            <Icon name={tone.icon} size={18} className={cn('mt-0.5 shrink-0', tone.accent)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-[13px] text-body">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded p-1 text-meta transition-colors hover:bg-slate-100 hover:text-ink"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
