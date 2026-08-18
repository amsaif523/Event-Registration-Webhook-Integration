/**
 * POST-only API client.
 *
 * Every backend endpoint is a POST to a fixed, literal path and every
 * identifier travels in the JSON body. No ids in URLs, no query strings.
 * See CLAUDE.md section 6 for why.
 *
 * Auth is cookie-based. The access and refresh tokens are HttpOnly, so there is
 * nothing here to read, store or attach — the browser sends them and this file
 * never sees them. That is the point: a script that gets injected into the page
 * cannot steal what it cannot read.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor({ status, code, message, fields }) {
    super(message || 'Request failed');
    this.name = 'ApiError';
    this.status = status;
    this.code = code || 'UNKNOWN_ERROR';
    this.fields = fields || {};
  }
}

/**
 * One refresh at a time.
 *
 * Several requests can hit an expired access token together — a table, a stat
 * card and a poll all firing at once. Without this they would each start their
 * own refresh, and because refresh tokens rotate, the second one to arrive
 * would present an already-rotated token. The server would read that as replay,
 * revoke the whole family, and sign the user out for doing nothing wrong.
 *
 * So the first caller starts the refresh and the rest await the same promise.
 */
let refreshInFlight = null;

function refreshSession() {
  refreshInFlight ??= rawPost('/api/auth/refresh', {})
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

async function rawPost(path, body = {}) {
  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Same-origin in dev (through the Vite proxy) and in production, so the
      // auth cookies ride along. SameSite=Strict means they are never sent
      // from another site, which is also the CSRF defence.
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    });
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code,
      message: payload?.error?.message ?? `Request failed with status ${response.status}`,
      fields: payload?.error?.fields,
    });
  }

  return payload.data;
}

/**
 * A request that transparently survives an expired access token.
 *
 * Only TOKEN_EXPIRED is retried. A revoked session, a bad signature or a
 * missing cookie are all real refusals — retrying them would loop, and would
 * hide the fact that the user needs to sign in again.
 */
async function post(path, body = {}, { allowRefresh = true } = {}) {
  try {
    return await rawPost(path, body);
  } catch (error) {
    const expired = error instanceof ApiError && error.code === 'TOKEN_EXPIRED';
    if (!expired || !allowRefresh) throw error;

    await refreshSession();

    return rawPost(path, body);
  }
}

export const client = {
  health: () => fetch(`${BASE_URL}/api/health`).then((r) => r.json()),

  /* ---------------------------------------------------------------- auth */
  login: (username, password) =>
    post('/api/auth/login', { username, password }, { allowRefresh: false }),
  logout: () => post('/api/auth/logout', {}, { allowRefresh: false }),
  logoutEverywhere: () => post('/api/auth/logout-everywhere'),
  // No refresh retry: this IS the call that establishes whether a session
  // exists, so a 401 here is the answer, not a problem to work around.
  me: () => post('/api/auth/me', {}, { allowRefresh: false }),
  refresh: () => refreshSession(),

  /* -------------------------------------------------------------- events */
  eventsList: (query = {}) => post('/api/events/list', query),
  eventsAdminList: (query = {}) => post('/api/events/admin-list', query),
  eventsView: (id) => post('/api/events/view', { id }),
  eventsCreate: (event) => post('/api/events/create', event),
  eventsUpdate: (event) => post('/api/events/update', event),

  /* ------------------------------------------------------- registrations */
  registrationsCreate: (registration) => post('/api/registrations/create', registration),
  registrationsStatus: (reference) => post('/api/registrations/status', { reference }),
  registrationsList: (query = {}) => post('/api/registrations/list', query),

  /* ----------------------------------------------------------- dashboard */
  dashboardSummary: () => post('/api/dashboard/summary'),

  /* ------------------------------------------------------------ webhooks */
  webhookEventsList: (query = {}) => post('/api/webhooks/list', query),
  simulateWebhook: (reference, mode) => post('/api/dev/simulate-webhook', { reference, mode }),
};

export default client;
