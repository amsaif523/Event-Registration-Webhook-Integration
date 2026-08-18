import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  USE_MOCK,
  ApiError,
  client,
  fetchMockData,
  mockCreateRegistration,
  mockList,
  mockLookupRegistration,
  mockSaveEvent,
  mockSimulateWebhook,
} from '../api/index.js';
import { eventFacts } from '../lib/events.js';

/**
 * The one place application content lives.
 *
 * data/mock.json is fetched exactly once, here at the root, and handed down
 * through context. No component holds its own copy of the content and no
 * component contains literal content of its own: every list, table, badge and
 * counter in the app is a map over this state. Edit public/data/mock.json,
 * reload, and the whole UI changes. That is the acceptance test.
 */

const AppDataContext = createContext(null);

const EMPTY = { events: [], registrations: [], webhook_events: [], stats: {} };

/**
 * Counters are derived from the arrays rather than trusted from the file, so
 * they stay correct after a registration or a simulated webhook. Values in
 * mock.json act as defaults for anything not derivable.
 */
function deriveStats(data) {
  const registrations = data.registrations ?? [];
  const webhooks = data.webhook_events ?? [];
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const countBy = (list, status) => list.filter((item) => item.status === status).length;
  const recentWebhooks = webhooks.filter((w) => {
    const at = new Date(String(w.received_at ?? '').replace(' ', 'T')).getTime();
    return !Number.isNaN(at) && at >= dayAgo;
  });

  return {
    ...(data.stats ?? {}),
    total_events: (data.events ?? []).length,
    published_events: countBy(data.events ?? [], 'published'),
    total_registrations: registrations.length,
    pending_registrations: countBy(registrations, 'pending'),
    confirmed_registrations: countBy(registrations, 'confirmed'),
    webhooks_last_24h: recentWebhooks.length,
    webhooks_rejected: recentWebhooks.filter(
      (w) => w.status === 'invalid_signature' || w.status === 'failed',
    ).length,
  };
}

export function AppDataProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  // Bumped whenever the underlying data changes — the initial load included —
  // so any open list re-runs its query against it.
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      let loaded;

      if (USE_MOCK) {
        loaded = await fetchMockData();
      } else {
        // The public site only needs the published events. Registrations and
        // deliveries are admin data and are fetched by the screens that show
        // them, through their own paginated queries.
        const events = await client.eventsList({ per_page: 'all' });
        loaded = {
          events: events.items ?? [],
          registrations: [],
          webhook_events: [],
          stats: {},
        };
      }
      setData(loaded);
      // Mock mode only. There, list queries read this in-memory data, so one
      // that ran against the empty initial state has to re-run now that the
      // data exists. Against the real API they query the server directly and
      // do not care about this at all — bumping would just fire every admin
      // list a second time for nothing.
      if (USE_MOCK) setVersion((current) => current + 1);
      setStatus('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError({ status: 0, message: err.message }));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ---------------------------------------------------------------- reads */

  const getEvent = useCallback(
    (id) => data.events.find((event) => event.id === id) ?? null,
    [data.events],
  );

  /**
   * Re-read one event from the server and merge it in.
   *
   * The events list is fetched once at startup, so a detail page opened later
   * is rendering figures that may be minutes old. That matters here more than
   * anywhere else in the app: this is the screen immediately before someone
   * commits, and "3 seats left" that were taken ten minutes ago sends them
   * through a form to a 409 they could not have predicted. Capacity is still
   * safe — the server enforces it under a row lock — but the UI should not
   * mislead.
   *
   * Nothing waits on this. The cached copy renders instantly and is quietly
   * replaced when the fresh one lands.
   */
  const refreshEvent = useCallback(async (id) => {
    if (USE_MOCK || !id) return null;

    const { event } = await client.eventsView(id);

    setData((current) => ({
      ...current,
      events: current.events.some((e) => e.id === event.id)
        ? current.events.map((e) => (e.id === event.id ? event : e))
        : [...current.events, event],
    }));

    return event;
  }, []);

  const getRegistration = useCallback(
    (reference) => data.registrations.find((r) => r.reference === reference) ?? null,
    [data.registrations],
  );

  const webhooksForReference = useCallback(
    (reference) =>
      data.webhook_events
        .filter((w) => w.registration_reference === reference)
        .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at))),
    [data.webhook_events],
  );

  /* ------------------------------------------------------------- mutations */

  const createRegistration = useCallback(
    async (input) => {
      const registration = USE_MOCK
        ? await mockCreateRegistration(data, input)
        : (await client.registrationsCreate(input)).registration;

      setData((current) => ({
        ...current,
        registrations: [registration, ...current.registrations],
        events: current.events.map((event) => {
          if (event.id !== registration.event_id) return event;
          const taken = Number(event.seats_taken ?? 0) + 1;
          return {
            ...event,
            seats_taken: taken,
            seats_left: Math.max(Number(event.capacity ?? 0) - taken, 0),
          };
        }),
      }));

      setVersion((current) => current + 1);
      return registration;
    },
    [data],
  );

  const lookupRegistration = useCallback(
    async (reference) => {
      if (USE_MOCK) return mockLookupRegistration(data, reference);

      const { registration } = await client.registrationsStatus(reference);

      // Keep any open view of this registration in step with the server; this
      // is what makes the status page flip to confirmed on its own.
      setData((current) => ({
        ...current,
        registrations: current.registrations.some((r) => r.reference === registration.reference)
          ? current.registrations.map((r) =>
              r.reference === registration.reference ? registration : r,
            )
          : [registration, ...current.registrations],
      }));

      return registration;
    },
    [data],
  );

  const simulateWebhook = useCallback(
    async ({ reference, mode }) => {
      const result = USE_MOCK
        ? await mockSimulateWebhook(data, { reference, mode })
        : await (async () => {
            const response = await client.simulateWebhook(reference, mode);

            // The API answers with the outcome and the updated record; the UI
            // wants a log-shaped row, so build one from what came back.
            return {
              log: {
                id: response.delivery_id,
                delivery_id: response.delivery_id,
                event_type: mode === 'cancel' ? 'ticket.cancelled' : 'ticket.confirmed',
                registration_reference: reference,
                status:
                  response.outcome === 'stale' ? 'failed' : response.outcome,
                error_message: response.status >= 400 ? response.message : null,
                received_at: new Date().toISOString().slice(0, 19),
                payload: null,
              },
              registration: response.registration ?? null,
            };
          })();

      setData((current) => ({
        ...current,
        webhook_events: [result.log, ...current.webhook_events],
        registrations: result.registration
          ? current.registrations.map((r) =>
              r.reference === result.registration.reference ? result.registration : r,
            )
          : current.registrations,
      }));

      setVersion((current) => current + 1);
      return result;
    },
    [data],
  );

  const saveEvent = useCallback(
    async (input) => {
      const saved = USE_MOCK
        ? await mockSaveEvent(data, input)
        : (input.id ? await client.eventsUpdate(input) : await client.eventsCreate(input)).event;

      setData((current) => ({
        ...current,
        events: current.events.some((e) => e.id === saved.id)
          ? current.events.map((e) => (e.id === saved.id ? saved : e))
          : [saved, ...current.events],
      }));

      setVersion((current) => current + 1);
      return saved;
    },
    [data],
  );

  /**
   * Server-shaped list queries. Search, filter, sort and pagination all travel
   * together and are applied across the whole collection before a page is cut
   * out of it — the same operation the API performs. Components never filter a
   * page they were handed, which is what breaks once the server does the
   * paginating.
   */
  const listEvents = useCallback(
    // Admin screens need every status; the public grid renders from `events`.
    (query) => (USE_MOCK ? mockList(data, 'events', query) : client.eventsAdminList(query)),
    [data],
  );

  const listRegistrations = useCallback(
    (query) => (USE_MOCK ? mockList(data, 'registrations', query) : client.registrationsList(query)),
    [data],
  );

  const listWebhookEvents = useCallback(
    (query) =>
      USE_MOCK ? mockList(data, 'webhook_events', query) : client.webhookEventsList(query),
    [data],
  );

  const value = useMemo(
    () => ({
      ...data,
      stats: deriveStats(data),
      version,
      status,
      error,
      isLoading: status === 'loading',
      reload: load,
      getEvent,
      refreshEvent,
      getRegistration,
      webhooksForReference,
      eventFacts,
      createRegistration,
      lookupRegistration,
      simulateWebhook,
      saveEvent,
      listEvents,
      listRegistrations,
      listWebhookEvents,
    }),
    [
      data,
      version,
      status,
      error,
      load,
      getEvent,
      refreshEvent,
      getRegistration,
      webhooksForReference,
      createRegistration,
      lookupRegistration,
      simulateWebhook,
      saveEvent,
      listEvents,
      listRegistrations,
      listWebhookEvents,
    ],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData must be used inside an AppDataProvider');
  return context;
}
