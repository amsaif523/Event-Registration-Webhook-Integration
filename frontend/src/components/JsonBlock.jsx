import { cn } from '../lib/cn.js';
import { prettyJson } from '../lib/format.js';

/**
 * Minimal JSON syntax colouring, done by tokenising the pretty-printed string
 * rather than pulling in a highlighter. Wraps rather than scrolls sideways so
 * it stays readable at 390px.
 */
const TOKEN_RE = /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b-?\d+(?:\.\d+)?\b)|(\btrue\b|\bfalse\b)|(\bnull\b)/g;

function tokenise(text) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const [value, propertyKey, string, number, boolean, nullish] = match;
    const className = propertyKey
      ? 'text-sky-300'
      : string
        ? 'text-emerald-300'
        : number
          ? 'text-amber-300'
          : boolean
            ? 'text-violet-300'
            : nullish
              ? 'text-slate-500'
              : '';
    nodes.push(
      <span key={`t${key++}`} className={className}>
        {value}
      </span>,
    );
    lastIndex = match.index + value.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default function JsonBlock({ payload, className = '', label = 'Raw payload' }) {
  const text = prettyJson(payload);
  if (!text) return null;

  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-700 bg-[#0B1220]', className)}>
      <div className="flex items-center justify-between border-b border-slate-700/70 px-3.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="tabular text-[11px] text-slate-500">{text.split('\n').length} lines</span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3.5 font-mono text-xs leading-relaxed text-slate-200">
        <code>{tokenise(text)}</code>
      </pre>
    </div>
  );
}
