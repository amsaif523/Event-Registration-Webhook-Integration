/**
 * Single source of truth for how every status is worded and coloured.
 * Status is never colour-alone anywhere in the UI: each entry carries a label
 * that ships with the dot, so a colour-blind or greyscale reader loses nothing.
 */

const STATUS_MAP = {
  event: {
    draft: { label: 'Draft', tone: 'slate' },
    published: { label: 'Published', tone: 'brand' },
    closed: { label: 'Closed', tone: 'slate' },
    cancelled: { label: 'Cancelled', tone: 'slate' },
  },
  registration: {
    pending: { label: 'Pending', tone: 'amber' },
    confirmed: { label: 'Confirmed', tone: 'emerald' },
    cancelled: { label: 'Cancelled', tone: 'slate' },
  },
  webhook: {
    processed: { label: 'Processed', tone: 'emerald' },
    duplicate: { label: 'Duplicate', tone: 'slate' },
    invalid_signature: { label: 'Invalid signature', tone: 'red' },
    failed: { label: 'Failed', tone: 'orange' },
  },
};

export function statusMeta(domain, value) {
  const group = STATUS_MAP[domain] ?? {};
  return group[value] ?? { label: value ?? 'Unknown', tone: 'slate' };
}

export function statusValues(domain) {
  return Object.keys(STATUS_MAP[domain] ?? {});
}

/** Tailwind classes per tone. Kept here so badges, chips and dots never drift. */
export const TONE_CLASSES = {
  emerald: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-600',
    text: 'text-emerald-700',
    soft: 'bg-emerald-50',
  },
  amber: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-600',
    text: 'text-amber-700',
    soft: 'bg-amber-50',
  },
  red: {
    badge: 'bg-red-50 text-red-700 border-red-200',
    dot: 'bg-red-600',
    text: 'text-red-700',
    soft: 'bg-red-50',
  },
  orange: {
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    soft: 'bg-orange-50',
  },
  slate: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot: 'bg-slate-500',
    text: 'text-slate-600',
    soft: 'bg-slate-50',
  },
  brand: {
    badge: 'bg-brand-50 text-brand-700 border-brand-200',
    dot: 'bg-brand-500',
    text: 'text-brand-700',
    soft: 'bg-brand-50',
  },
};
