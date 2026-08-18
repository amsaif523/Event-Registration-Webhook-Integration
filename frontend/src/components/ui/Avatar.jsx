import { cn } from '../../lib/cn.js';

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-[13px]',
};

/**
 * Initials avatar. No image upload exists, and a generated illustration would
 * imply an identity the shared token does not have, so initials it is.
 */
export default function Avatar({ initials, size = 'md', tone = 'light', className = '' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid shrink-0 select-none place-items-center rounded-full font-semibold ring-1 ring-inset',
        SIZES[size],
        tone === 'dark'
          ? 'bg-white/10 text-white ring-white/15'
          : 'bg-brand-50 text-brand-700 ring-brand-100',
        className,
      )}
    >
      {initials}
    </span>
  );
}
