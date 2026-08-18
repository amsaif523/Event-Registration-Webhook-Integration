import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Works out which rows in a list have appeared since the last time it changed.
 *
 * Shared by the dashboard feeds and the registrations table so "new" means the
 * same thing everywhere: seen now, not seen before. It compares ids rather than
 * timestamps, because a row is new to *this screen* the moment it shows up —
 * which is not the same as being recently created. A registration made an hour
 * ago is still news to someone who has just cleared a filter that was hiding it.
 *
 * The first list it is given marks nothing. Flashing every row the instant a
 * page opens is noise, and the point is to catch what arrives while somebody is
 * actually watching.
 *
 * `shouldHighlight` decides what is worth drawing attention to at all. A
 * registration only deserves it while it is still pending: that is the state
 * that might need someone to act. Once it is confirmed or cancelled the outcome
 * is settled, and flashing a row nobody has to do anything about is just noise
 * competing with the rows that do.
 */
export default function useNewArrivals(
  items,
  { key = 'id', durationMs = 8000, shouldHighlight = null } = {},
) {
  const [newIds, setNewIds] = useState(() => new Set());
  const seen = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    if (!Array.isArray(items)) return;

    const ids = new Set(items.map((item) => item[key]));

    // First pass: record what is here, flag none of it.
    if (seen.current === null) {
      seen.current = ids;

      return;
    }

    const arrived = items.filter(
      (item) => !seen.current.has(item[key]) && (!shouldHighlight || shouldHighlight(item)),
    );
    seen.current = ids;

    /**
     * Drop the highlight from anything that has since settled — a row that was
     * pending when it arrived and has since been confirmed by a webhook. The
     * flash was asking for attention it no longer needs.
     */
    const settled = shouldHighlight
      ? items.filter((item) => !shouldHighlight(item)).map((item) => item[key])
      : [];

    if (arrived.length === 0 && settled.length === 0) return;

    setNewIds((current) => {
      const next = new Set(current);
      settled.forEach((id) => next.delete(id));
      arrived.forEach((item) => next.add(item[key]));

      // Returning the same set when nothing moved keeps the identity stable,
      // so nothing downstream re-renders and no animation restarts.
      if (next.size === current.size && [...next].every((id) => current.has(id))) return current;

      return next;
    });

    if (arrived.length === 0) return;

    const arrivedIds = arrived.map((item) => item[key]);
    const timer = setTimeout(() => {
      setNewIds((current) => {
        const next = new Set(current);
        arrivedIds.forEach((id) => next.delete(id));

        return next;
      });
    }, durationMs);
    timers.current.push(timer);
  }, [items, key, durationMs, shouldHighlight]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  /**
   * Memoised on the set itself.
   *
   * Without this the hook hands back a fresh object every render, which makes
   * every memo downstream rebuild, which makes the datatable re-create its rows
   * — and a re-created row restarts its CSS animation. The symptom is a
   * highlight that never stops flashing.
   */
  return useMemo(
    () => ({
      newIds,
      isNew: (id) => newIds.has(id),
      count: newIds.size,
      clear: () => setNewIds(new Set()),
    }),
    [newIds],
  );
}
