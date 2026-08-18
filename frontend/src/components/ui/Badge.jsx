import { cn } from '../../lib/cn.js';
import { statusMeta, TONE_CLASSES } from '../../lib/status.js';

/**
 * Status is always a coloured dot plus its written label, never colour alone.
 */
export default function Badge({ domain, value, size = 'md', className = '', withDot = true }) {
  const meta = statusMeta(domain, value);
  const tone = TONE_CLASSES[meta.tone] ?? TONE_CLASSES.slate;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        tone.badge,
        className,
      )}
    >
      {withDot && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} />}
      {meta.label}
    </span>
  );
}

/** Neutral label chip, e.g. "Demo only". */
export function Tag({ children, tone = 'slate', className = '' }) {
  const classes = TONE_CLASSES[tone] ?? TONE_CLASSES.slate;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        classes.badge,
        className,
      )}
    >
      {children}
    </span>
  );
}
