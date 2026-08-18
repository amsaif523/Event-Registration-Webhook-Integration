import { isPast } from './format.js';

/**
 * Derived event facts used by both the public grid and the admin table.
 * seats_taken / seats_left come from the API, but everything is recomputed
 * defensively so an event object missing a field still renders.
 */
export function eventFacts(event) {
  const capacity = Number(event?.capacity ?? 0);
  const taken = Number(event?.seats_taken ?? 0);
  const left = event?.seats_left ?? Math.max(capacity - taken, 0);
  const past = isPast(event?.event_date);
  const full = left <= 0;
  const registerable = event?.status === 'published' && !full && !past;

  let blockedReason = null;
  if (event?.status === 'cancelled') blockedReason = 'Cancelled';
  else if (event?.status === 'draft') blockedReason = 'Not yet open';
  else if (event?.status === 'closed') blockedReason = 'Registration closed';
  else if (past) blockedReason = 'Event has passed';
  else if (full) blockedReason = 'Sold out';

  return {
    capacity,
    taken,
    left,
    past,
    full,
    registerable,
    blockedReason,
    fillPercent: capacity > 0 ? Math.min(Math.round((taken / capacity) * 100), 100) : 0,
    almostFull: capacity > 0 && left > 0 && left / capacity <= 0.2,
  };
}

/** Label for the disabled CTA on a card or detail page. */
export function ctaLabel(event) {
  const { registerable, blockedReason } = eventFacts(event);
  if (registerable) return 'Register';
  if (blockedReason === 'Sold out') return 'Sold out';
  if (blockedReason === 'Cancelled') return 'Cancelled';
  return 'Registration closed';
}
