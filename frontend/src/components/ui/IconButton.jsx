import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';

const TONES = {
  default: 'text-meta hover:bg-slate-100 hover:text-ink',
  brand: 'text-brand-600 hover:bg-brand-50 hover:text-brand-700',
  danger: 'text-red-500 hover:bg-red-50 hover:text-red-600',
};

/**
 * A single visible action. Every instance carries a real label — an aria-label
 * for assistive tech and a native title tooltip on hover — because an icon on
 * its own is a guess, and a row action nobody can guess is a row action nobody
 * uses.
 */
export default function IconButton({
  icon,
  label,
  onClick,
  tone = 'default',
  size = 18,
  className = '',
  ...rest
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded transition-colors duration-150 ease-out',
        TONES[tone] ?? TONES.default,
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/**
 * Icon plus visible text. Used on the mobile cards, where there is room for
 * words and no hover state to reveal a tooltip.
 */
export function ActionButton({ icon, children, onClick, tone = 'default', className = '', ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded border text-[13px] font-medium',
        'transition-colors duration-150 ease-out',
        tone === 'brand'
          ? 'border-brand-200 bg-brand-50 text-brand-700 active:bg-brand-100'
          : 'border-hairline bg-white text-body active:bg-slate-100',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={15} />
      {children}
    </button>
  );
}
