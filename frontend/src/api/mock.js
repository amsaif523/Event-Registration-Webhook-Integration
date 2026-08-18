/**
 * Design-mode data source.
 *
 * Reads /data/mock.json and answers the same action names as the real client,
 * including the failure paths, so every screen and every error state can be
 * exercised without a backend. Phase 5 swaps this module out for client.js by
 * flipping VITE_USE_MOCK; no component changes.
 */
import { ApiError } from './client.js';
import { eventFacts } from '../lib/events.js';

const MOCK_URL = '/data/mock.json';
const LATENCY_MS = 420;

const delay = (ms = LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchMockData() {
  const response = await fetch(MOCK_URL, { cache: 'no-store' });
  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: 'MOCK_DATA_UNAVAILABLE',
      message: 'Could not load data/mock.json. Make sure the file exists in public/data.',
    });
  }
  const data = await response.json();
  return normalise(data);
}

/** Tolerate a hand-edited mock.json: missing arrays become empty, not crashes. */
function normalise(data) {
  return {
    events: Array.isArray(data?.events) ? data.events : [],
    registrations: Array.isArray(data?.registrations) ? data.registrations : [],
    webhook_events: Array.isArray(data?.webhook_events) ? data.webhook_events : [],
    stats: data?.stats ?? {},
  };
}

const REFERENCE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no O/0, I/1, L
const HEX = '0123456789abcdef';

function randomFrom(alphabet, length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export const newReference = () => `EVT-${randomFrom(REFERENCE_ALPHABET, 8)}`;
export const newDeliveryId = () => `whd_${randomFrom(HEX, 20)}`;
export const newTicketId = () =>
  `TKT-${randomFrom('0123456789', 4)}-${randomFrom('0123456789ABCDEF', 4)}`;

/** MySQL DATETIME shape, local time, matching everything already in mock.json. */
export function nowStamp(offsetSeconds = 0) {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}

/**
 * Registration create. Reproduces the three backend rejections:
 * 422 validation is handled client-side, 409 full, 409 duplicate email.
 */
export async function mockCreateRegistration(data, input) {
  await delay();
  const event = data.events.find((e) => e.id === input.event_id);
  if (!event) {
    throw new ApiError({ status: 404, code: 'EVENT_NOT_FOUND', message: 'That event no longer exists.' });
  }

  const facts = eventFacts(event);
  if (!facts.registerable) {
    throw new ApiError({
      status: 409,
      code: facts.full ? 'EVENT_FULL' : 'EVENT_NOT_OPEN',
      message: facts.full
        ? 'This event is now full.'
        : 'Registration for this event is closed.',
    });
  }

  const email = input.email.trim().toLowerCase();
  const clash = data.registrations.some(
    (r) => r.event_id === event.id && r.email.toLowerCase() === email,
  );
  if (clash) {
    throw new ApiError({
      status: 409,
      code: 'ALREADY_REGISTERED',
      message: 'This email is already registered for this event.',
    });
  }

  const registration = {
    id: Math.max(0, ...data.registrations.map((r) => r.id)) + 1,
    event_id: event.id,
    reference: newReference(),
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    status: 'pending',
    ticket_id: null,
    created_at: nowStamp(),
    confirmed_at: null,
  };

  return registration;
}

/**
 * Webhook simulation. `mode` picks which path the ticketing system takes, so
 * the reviewer can watch a rejection as easily as a success.
 */
export async function mockSimulateWebhook(data, { reference, mode }) {
  await delay(650);
  const registration = data.registrations.find((r) => r.reference === reference);
  const receivedAt = nowStamp();

  const base = {
    id: Math.max(0, ...data.webhook_events.map((w) => w.id)) + 1,
    event_type: 'ticket.confirmed',
    registration_reference: reference,
    received_at: receivedAt,
    error_message: null,
  };

  if (mode === 'bad_signature') {
    return {
      log: {
        ...base,
        delivery_id: newDeliveryId(),
        status: 'invalid_signature',
        error_message: 'Computed HMAC-SHA256 does not match the X-Signature header.',
        payload: JSON.stringify({
          event: 'ticket.confirmed',
          reference,
          ticket_id: newTicketId(),
          confirmed_at: receivedAt,
        }),
      },
      registration: null,
    };
  }

  if (mode === 'duplicate') {
    const previous = data.webhook_events.find(
      (w) => w.registration_reference === reference && w.status === 'processed',
    );
    return {
      log: {
        ...base,
        // Same delivery id as the original: that unique index is what catches it.
        delivery_id: previous?.delivery_id ?? newDeliveryId(),
        status: 'duplicate',
        payload: previous?.payload ?? JSON.stringify({ event: 'ticket.confirmed', reference }),
      },
      registration: null,
    };
  }

  if (!registration) {
    return {
      log: {
        ...base,
        delivery_id: newDeliveryId(),
        status: 'failed',
        error_message: `No registration found for reference ${reference}.`,
        payload: JSON.stringify({ event: 'ticket.confirmed', reference }),
      },
      registration: null,
    };
  }

  if (registration.status !== 'pending') {
    return {
      log: {
        ...base,
        delivery_id: newDeliveryId(),
        status: 'failed',
        error_message: `Registration is not pending, refusing transition from ${registration.status} to confirmed.`,
        payload: JSON.stringify({ event: 'ticket.confirmed', reference }),
      },
      registration: null,
    };
  }

  const ticketId = newTicketId();
  return {
    log: {
      ...base,
      delivery_id: newDeliveryId(),
      status: 'processed',
      payload: JSON.stringify({
        event: 'ticket.confirmed',
        reference,
        ticket_id: ticketId,
        confirmed_at: receivedAt,
      }),
    },
    registration: {
      ...registration,
      status: 'confirmed',
      ticket_id: ticketId,
      confirmed_at: receivedAt,
    },
  };
}

export async function mockLookupRegistration(data, reference) {
  await delay(260);
  const registration = data.registrations.find(
    (r) => r.reference.toLowerCase() === String(reference ?? '').trim().toLowerCase(),
  );
  if (!registration) {
    throw new ApiError({
      status: 404,
      code: 'REGISTRATION_NOT_FOUND',
      message: 'We could not find a registration with that reference.',
    });
  }
  return registration;
}

export async function mockSaveEvent(data, input) {
  await delay(520);
  if (input.id) {
    const existing = data.events.find((e) => e.id === input.id);
    if (!existing) {
      throw new ApiError({ status: 404, code: 'EVENT_NOT_FOUND', message: 'That event no longer exists.' });
    }
    const capacity = Number(input.capacity);
    return {
      ...existing,
      ...input,
      capacity,
      seats_left: Math.max(capacity - Number(existing.seats_taken ?? 0), 0),
    };
  }

  const capacity = Number(input.capacity);
  return {
    ...input,
    id: Math.max(0, ...data.events.map((e) => e.id)) + 1,
    capacity,
    seats_taken: 0,
    seats_left: capacity,
  };
}

/* ------------------------------------------------------------------ listing */

/**
 * The list-query engine.
 *
 * Search, filtering, sorting and pagination are one operation and they belong
 * on the server. Paginating first and filtering afterwards would only ever
 * search the page you happen to be looking at, which is the bug this shape
 * exists to prevent: filters always run across the whole set, and only then is
 * a page sliced out of the result.
 *
 * This mirrors exactly what the PHP endpoints must do, so switching
 * VITE_USE_MOCK to false is a transport change and nothing else. The contract
 * is documented in README.md under "Backend contract".
 */
export function applyListQuery(rows, params = {}, config = {}) {
  const { searchFields = [], filters = {}, defaultSort } = config;
  const {
    search = '',
    page = 1,
    per_page: perPage = 10,
    sort_by: sortBy = defaultSort?.field,
    sort_dir: sortDir = defaultSort?.direction ?? 'desc',
  } = params;

  let items = [...rows];

  // Filters. A value of 'all', null or undefined means "do not narrow".
  for (const [key, resolve] of Object.entries(filters)) {
    const value = params[key];
    if (value === undefined || value === null || value === 'all' || value === '') continue;
    items = items.filter((row) => resolve(row, value));
  }

  // Search, across the whole filtered set rather than the current page.
  const needle = String(search).trim().toLowerCase();
  if (needle && searchFields.length > 0) {
    items = items.filter((row) =>
      searchFields.some((field) => {
        const value = typeof field === 'function' ? field(row) : row[field];
        return value !== null && value !== undefined && String(value).toLowerCase().includes(needle);
      }),
    );
  }

  if (sortBy) {
    const direction = sortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const left = a[sortBy];
      const right = b[sortBy];
      if (left === right) return 0;
      if (left === null || left === undefined) return 1;
      if (right === null || right === undefined) return -1;
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });
  }

  const total = items.length;
  // per_page of 0 (or 'all') means no pagination, matching the "Show all" option.
  const size = perPage === 'all' || Number(perPage) === 0 ? total || 1 : Number(perPage);
  const totalPages = Math.max(Math.ceil(total / size), 1);
  const safePage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const paged = perPage === 'all' || Number(perPage) === 0
    ? items
    : items.slice((safePage - 1) * size, safePage * size);

  return { items: paged, total, page: safePage, per_page: perPage, total_pages: totalPages };
}

const LIST_CONFIG = {
  events: {
    searchFields: ['name', 'venue', 'description'],
    filters: { status: (row, value) => row.status === value },
    defaultSort: { field: 'event_date', direction: 'desc' },
  },
  registrations: {
    searchFields: ['reference', 'email', 'phone', (row) => `${row.first_name} ${row.last_name}`],
    filters: {
      status: (row, value) => row.status === value,
      event_id: (row, value) => String(row.event_id) === String(value),
    },
    defaultSort: { field: 'created_at', direction: 'desc' },
  },
  webhook_events: {
    searchFields: ['delivery_id', 'registration_reference', 'event_type', 'error_message'],
    filters: { status: (row, value) => row.status === value },
    defaultSort: { field: 'received_at', direction: 'desc' },
  },
};

export async function mockList(data, resource, params) {
  await delay(220);
  return applyListQuery(data[resource] ?? [], params, LIST_CONFIG[resource]);
}
