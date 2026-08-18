import Icon from '../icons/Icon.jsx';

export default function SearchInput({ value, onChange, placeholder = 'Search', label, className = '', id }) {
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label ?? placeholder}
      </label>
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-meta"
      />
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded border border-hairline bg-white pl-9 pr-3 text-ink placeholder:text-meta transition-colors duration-150 hover:border-slate-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25"
      />
    </div>
  );
}
