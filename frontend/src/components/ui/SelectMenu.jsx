import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';

/**
 * Searchable select, themed to match every other control.
 *
 * Replaces the native <select>, which cannot be styled consistently across
 * browsers and gives no way to filter a long list — the event filter alone can
 * run to hundreds of entries once this is talking to a real database.
 *
 * The panel is rendered through a portal with fixed positioning rather than
 * absolutely inside the trigger's parent. Some of these live inside the
 * slide-over, whose body is `overflow-y-auto`, and an absolutely positioned
 * panel would be clipped by it.
 */

const PANEL_MAX_HEIGHT = 288;

// Positioning has to happen before paint or the panel flashes in the wrong
// place, but useLayoutEffect warns under server rendering. The app is
// client-only today; this keeps it quiet if that ever changes.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function SelectMenu({
  options,
  value,
  onChange,
  id,
  label,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search…',
  disabled = false,
  error,
  className = '',
  align = 'start',
}) {
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;
  const listboxId = `${triggerId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState(null);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);

  const selected = options.find((option) => String(option.value) === String(value)) ?? null;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ''}`.toLowerCase().includes(needle),
    );
  }, [options, query]);

  /** Anchor the panel to the trigger, flipping above it when space is short. */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const flip = below < Math.min(PANEL_MAX_HEIGHT, 240) && rect.top > below;

    setPosition({
      left: align === 'end' ? undefined : rect.left,
      right: align === 'end' ? window.innerWidth - rect.right : undefined,
      top: flip ? undefined : rect.bottom + 6,
      bottom: flip ? window.innerHeight - rect.top + 6 : undefined,
      width: rect.width,
      maxHeight: Math.max(160, Math.min(PANEL_MAX_HEIGHT, (flip ? rect.top : below) - 16)),
    });
  }, [align]);

  useIsomorphicLayoutEffect(() => {
    if (!open) return undefined;
    place();
    // Recompute rather than close: the page behind can still scroll.
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const index = filtered.findIndex((option) => String(option.value) === String(value));
    setHighlight(index >= 0 ? index : 0);
    const timer = setTimeout(() => searchRef.current?.focus(), 20);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    panelRef.current
      ?.querySelector(`[data-index="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const commit = (option) => {
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((current) => (filtered.length ? (current + 1) % filtered.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((current) => (filtered.length ? (current - 1 + filtered.length) % filtered.length : 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlight(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlight(Math.max(filtered.length - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[highlight]) commit(filtered[highlight]);
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      {label && (
        <label htmlFor={triggerId} className="sr-only">
          {label}
        </label>
      )}

      <button
        type="button"
        id={triggerId}
        ref={triggerRef}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        aria-invalid={error ? 'true' : undefined}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded border bg-white px-3 text-left',
          'transition-colors duration-150 ease-out',
          'hover:border-slate-300 focus:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/25',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-meta',
          error ? 'border-red-400' : 'border-hairline',
          open && 'border-brand-500 ring-2 ring-brand-500/25',
          className,
        )}
      >
        <span className={cn('min-w-0 flex-1 truncate text-[15px]', selected ? 'text-ink' : 'text-meta')}>
          {selected?.label ?? placeholder}
        </span>
        <Icon
          name="chevronDown"
          size={16}
          className={cn('shrink-0 text-meta transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: 'fixed',
              left: position.left,
              right: position.right,
              top: position.top,
              bottom: position.bottom,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            className="z-[70] flex animate-slide-up flex-col overflow-hidden rounded-card border border-hairline bg-white shadow-lift"
          >
            <div className="relative shrink-0 border-b border-hairline">
              <Icon
                name="search"
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-meta"
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlight(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={searchPlaceholder}
                aria-label={`Search ${label ?? 'options'}`}
                aria-controls={listboxId}
                autoComplete="off"
                spellCheck="false"
                className="h-10 w-full border-0 bg-transparent pl-9 pr-3 text-[15px] text-ink placeholder:text-meta focus:outline-none focus:ring-0"
              />
            </div>

            <ul id={listboxId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-6 text-center text-[13px] text-meta">
                  Nothing matches &ldquo;{query.trim()}&rdquo;
                </li>
              ) : (
                filtered.map((option, index) => {
                  const isSelected = String(option.value) === String(value);
                  return (
                    <li key={option.value} role="option" aria-selected={isSelected} data-index={index}>
                      <button
                        type="button"
                        onClick={() => commit(option)}
                        onMouseEnter={() => setHighlight(index)}
                        className={cn(
                          'flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm',
                          'transition-colors duration-100',
                          index === highlight ? 'bg-brand-50' : 'bg-transparent',
                          isSelected ? 'font-medium text-ink' : 'text-body',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{option.label}</span>
                          {option.description && (
                            <span className="mt-0.5 block truncate text-[12px] text-meta">
                              {option.description}
                            </span>
                          )}
                        </span>
                        {isSelected && <Icon name="check" size={15} className="shrink-0 text-brand-600" />}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>,
          document.body,
        )}
    </>
  );
}
