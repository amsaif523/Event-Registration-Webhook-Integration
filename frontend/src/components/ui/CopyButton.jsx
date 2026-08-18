import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';

/** Copy to clipboard with an inline confirmation that reverts after 2s. */
export default function CopyButton({ value, label = 'Copy', onCopied, className = '', variant = 'button' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value ?? ''));
    } catch {
      // Clipboard API needs a secure context; fall back to a hidden textarea.
      const helper = document.createElement('textarea');
      helper.value = String(value ?? '');
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      document.execCommand('copy');
      document.body.removeChild(helper);
    }
    setCopied(true);
    onCopied?.();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : `${label} ${value}`}
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded text-meta transition-colors duration-150',
          'hover:bg-slate-100 hover:text-ink',
          copied && 'text-emerald-600',
          className,
        )}
      >
        <Icon name={copied ? 'check' : 'copy'} size={14} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded border border-hairline bg-white px-3 text-[13px] font-medium',
        'text-body transition-colors duration-150 ease-out hover:border-slate-300 hover:bg-slate-50 hover:text-ink',
        copied && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
        className,
      )}
    >
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      {copied ? 'Copied' : label}
    </button>
  );
}
