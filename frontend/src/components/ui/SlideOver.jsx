import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';

/**
 * Right-side panel on desktop, full-height bottom sheet with a drag handle on
 * mobile. Used for create/edit and for record detail, deliberately instead of a
 * centred modal: the list stays visible behind it, which is what you want when
 * you are working down a table.
 */
export default function SlideOver({ open, onClose, title, description, footer, children, width = 'md' }) {
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    restoreFocusTo.current = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      // Keep focus inside the panel while it is open.
      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const focusTimer = setTimeout(() => {
      panelRef.current?.querySelector('input, textarea, select, button')?.focus();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      clearTimeout(focusTimer);
      restoreFocusTo.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex sm:justify-end">
      <div
        className="absolute inset-0 animate-fade-in bg-ink/25 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 flex w-full flex-col bg-white shadow-panel',
          'mt-auto max-h-[92dvh] animate-slide-in-bottom rounded-t-2xl',
          'sm:mt-0 sm:max-h-none sm:h-full sm:animate-slide-in-right sm:rounded-none',
          widths[width],
        )}
      >
        {/* Drag handle, mobile bottom-sheet affordance only. */}
        <div className="flex justify-center pt-3 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <header className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-body">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="-mr-1 grid h-9 w-9 shrink-0 place-items-center rounded text-meta transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-hairline bg-slate-50/70 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}
