import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { cn } from '../../lib/cn.js';

/**
 * International phone entry: country picker with dial code and per-country
 * formatting as you type. The value handed back is E.164 ("+919820041277"),
 * which is what we store and what the backend validates.
 *
 * The library loads flag images from cdnjs.cloudflare.com. They are worth
 * having, so they stay — but it does mean the flags (and only the flags) need
 * outbound internet. Everything else about the control works offline, and the
 * country name and dial code carry the meaning if an image fails to load.
 */

export default function PhoneField({
  id,
  value,
  onChange,
  onBlur,
  disabled = false,
  error,
  defaultCountry = 'in',
  className = '',
}) {
  return (
    <div
      className={cn(
        'phone-field flex rounded border bg-white transition-colors duration-150 ease-out',
        'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25',
        error ? 'border-red-400' : 'border-hairline hover:border-slate-300',
        disabled && 'cursor-not-allowed bg-slate-50',
        className,
      )}
    >
      <PhoneInput
        defaultCountry={defaultCountry}
        value={value}
        onChange={onChange}
        disabled={disabled}
        inputProps={{
          id,
          name: 'phone',
          autoComplete: 'tel',
          'aria-invalid': error ? 'true' : undefined,
          onBlur,
        }}
      />
    </div>
  );
}
