import { useCallback, useEffect, useRef, useState } from 'react';
import { USE_MOCK, client } from '../api/index.js';

/**
 * Dashboard data, refreshed on a timer, with new arrivals identified.
 *
 * "New" means: seen in this poll, not in the previous one. It is worked out by
 * comparing ids rather than timestamps, because a row is new to *this screen*
 * the moment it appears here — which is not the same as being recently created.
 * A registration made an hour ago is still news to an admin who just opened the
 * page after it was filtered out of view.
 *
 * The very first load marks nothing as new. Flashing eight rows at someone the
 * instant the page opens is noise, not a signal; the point is to catch what
 * arrives while they are watching.
 */

const POLL_INTERVAL_MS = 15000;

/** How long a row keeps its "new" treatment before settling down. */
const HIGHLIGHT_MS = 8000;

export default function useDashboard() {
  const [data, setData] = useState({
    stats: {},
    recent_registrations: [],
    recent_webhooks: [],
  });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [newRegistrationIds, setNewRegistrationIds] = useState(() => new Set());
  const [newWebhookIds, setNewWebhookIds] = useState(() => new Set());

  const seenRegistrations = useRef(null);
  const seenWebhooks = useRef(null);
  const timers = useRef([]);

  // A tab left open in the background should not keep polling; nobody is
  // reading it and the flash will have finished long before they return.
  const [documentVisible, setDocumentVisible] = useState(
    typeof document === 'undefined' ? true : !document.hidden,
  );

  useEffect(() => {
    const onVisibility = () => setDocumentVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const clearHighlightLater = useCallback((setter, ids) => {
    if (ids.size === 0) return;
    const timer = setTimeout(() => {
      setter((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));

        return next;
      });
    }, HIGHLIGHT_MS);
    timers.current.push(timer);
  }, []);

  const load = useCallback(async () => {
    if (USE_MOCK) {
      setStatus('ready');

      return;
    }

    try {
      const summary = await client.dashboardSummary();

      const registrationIds = new Set((summary.recent_registrations ?? []).map((r) => r.id));
      const webhookIds = new Set((summary.recent_webhooks ?? []).map((w) => w.id));

      // Nothing is "new" on the first load — there is no previous state to be
      // new relative to.
      if (seenRegistrations.current !== null) {
        const arrivedRegistrations = new Set(
          [...registrationIds].filter((id) => !seenRegistrations.current.has(id)),
        );
        const arrivedWebhooks = new Set(
          [...webhookIds].filter((id) => !seenWebhooks.current.has(id)),
        );

        if (arrivedRegistrations.size > 0) {
          setNewRegistrationIds((current) => new Set([...current, ...arrivedRegistrations]));
          clearHighlightLater(setNewRegistrationIds, arrivedRegistrations);
        }
        if (arrivedWebhooks.size > 0) {
          setNewWebhookIds((current) => new Set([...current, ...arrivedWebhooks]));
          clearHighlightLater(setNewWebhookIds, arrivedWebhooks);
        }
      }

      seenRegistrations.current = registrationIds;
      seenWebhooks.current = webhookIds;

      setData(summary);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err);
      // A failed poll must not blank a dashboard that is already showing good
      // data — keep what is on screen and try again next tick.
      setStatus((current) => (current === 'ready' ? 'ready' : 'error'));
    }
  }, [clearHighlightLater]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (USE_MOCK || !documentVisible) return undefined;

    const timer = setInterval(load, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [load, documentVisible]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  return {
    ...data,
    status,
    error,
    isLoading: status === 'loading',
    reload: load,
    newRegistrationIds,
    newWebhookIds,
    isPolling: documentVisible && !USE_MOCK,
  };
}
