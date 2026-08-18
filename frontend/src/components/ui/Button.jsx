import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';

const VARIANTS = {
  primary:
    'bg-brand-500 text-white border-brand-500 hover:bg-brand-600 hover:border-brand-600 active:bg-brand-700 shadow-sm',
  secondary:
    'bg-white text-ink border-hairline hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100',
  ghost: 'bg-transparent text-body border-transparent hover:bg-slate-100 hover:text-ink active:bg-slate-200',
  danger:
    'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 active:bg-red-100',
  subtle: 'bg-slate-100 text-ink border-transparent hover:bg-slate-200 active:bg-slate-300',
};

const SIZES = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  icon,
  iconAfter,
  fullWidth = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center rounded border font-medium',
        'transition-colors duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Icon name="loader" size={16} className="animate-spin" />
      ) : (
        icon && <Icon name={icon} size={16} />
      )}
      <span>{loading ? (loadingText ?? children) : children}</span>
      {!loading && iconAfter && <Icon name={iconAfter} size={16} />}
    </button>
  );
}
