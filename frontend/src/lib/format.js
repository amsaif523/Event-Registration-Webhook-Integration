/**
 * Formatting helpers. Every date in the data set is a naive local-time string
 * ("2026-09-14T18:30:00"), which is what MySQL DATETIME gives us, so we parse
 * it as local time rather than letting the browser guess UTC.
 */

export function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return d
    .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })
    .toUpperCase();
}

export function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${formatDate(value)}, ${formatTime(value)}`;
}

export function formatWeekday(value) {
  const d = parseDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'long' });
}

export function dayNumber(value) {
  const d = parseDate(value);
  return d ? String(d.getDate()).padStart(2, '0') : '--';
}

export function monthShort(value) {
  const d = parseDate(value);
  return d ? MONTHS[d.getMonth()] : '';
}

export function isPast(value) {
  const d = parseDate(value);
  return d ? d.getTime() < Date.now() : false;
}

/** "3 minutes ago", used in the webhook log and activity feed. */
export function relativeTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 0) return formatDateTime(value);
  if (seconds < 60) return 'just now';
  const units = [
    ['minute', 60],
    ['hour', 60],
    ['day', 24],
    ['week', 7],
  ];
  let amount = seconds;
  let label = 'second';
  for (const [name, divisor] of units) {
    if (amount < divisor) break;
    amount = Math.floor(amount / divisor);
    label = name;
  }
  if (label === 'second' || amount > 6) return formatDate(value);
  return `${amount} ${label}${amount === 1 ? '' : 's'} ago`;
}

export function formatNumber(value) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function initials(first = '', last = '') {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
}

export function truncateMiddle(value, head = 10, tail = 4) {
  if (!value || value.length <= head + tail + 1) return value ?? '';
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/** Pretty-print the payload string stored verbatim on a webhook row. */
export function prettyJson(raw) {
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
