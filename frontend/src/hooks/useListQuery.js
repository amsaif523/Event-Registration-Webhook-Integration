import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Drives a server-shaped list: query params in, one page of rows out.
 *
 * Every admin table goes through this rather than filtering an array it already
 * holds. That matters because the moment the API paginates, a component that
 * filters its own rows is only ever searching the page it was handed — the rest
 * of the matches are on the server and it will never see them. Keeping search,
 * filters, sort and pagination in one object that is sent to the data layer
 * means the switch from mock to API changes nothing here.
 *
 * Two things async lists need and synchronous filtering did not:
 *  - typing is debounced, so a search does not fire a request per keystroke;
 *  - responses are sequence-checked, so a slow early reply cannot overwrite a
 *    fast later one and show results for a query that is no longer on screen.
 */

const SEARCH_DEBOUNCE_MS = 250;

export default function useListQuery({
  fetcher,
  initialFilters = {},
  perPage = '10',
  sortBy,
  sortDir = 'desc',
  dependencies = [],
  /**
   * Re-run the query on a timer so rows that arrive while somebody is looking
   * at the screen actually show up. Off by default: most lists do not change
   * under you, and a poll nobody needs is just traffic.
   */
  pollMs = 0,
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(perPage);
  const [sort, setSort] = useState({ by: sortBy, dir: sortDir });

  const [result, setResult] = useState({ items: [], total: 0, total_pages: 1 });
  // Bumped by the poll timer to force a re-fetch without changing the query.
  const [refreshTick, setRefreshTick] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);

  const sequence = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Any change to what is being asked for resets to the first page; otherwise
  // you can be left looking at page 4 of a two-page result.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, size]);

  const query = useMemo(
    () => ({
      search: debouncedSearch,
      ...filters,
      page,
      per_page: size,
      sort_by: sort.by,
      sort_dir: sort.dir,
    }),
    [debouncedSearch, filters, page, size, sort],
  );

  useEffect(() => {
    const ticket = ++sequence.current;
    let cancelled = false;

    setStatus((current) => (current === 'ready' ? 'ready' : 'loading'));

    Promise.resolve(fetcher(query))
      .then((response) => {
        // Ignore anything that is not the most recent request.
        if (cancelled || ticket !== sequence.current) return;
        setResult(response);
        setStatus('ready');
        setError(null);
      })
      .catch((err) => {
        if (cancelled || ticket !== sequence.current) return;
        setError(err);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, refreshTick, ...dependencies]);

  /**
   * Polling. Paused while the tab is hidden — nobody is reading it, and the
   * highlight would have faded long before they came back.
   */
  useEffect(() => {
    if (!pollMs) return undefined;

    let timer = null;

    const start = () => {
      stop();
      timer = setInterval(() => setRefreshTick((n) => n + 1), pollMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [pollMs]);

  const setFilter = useCallback((name, value) => {
    setFilters((current) => ({ ...current, [name]: value }));
  }, []);

  const applySort = useCallback((by, dir) => {
    setSort({ by, dir });
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setSearch('');
    setFilters(initialFilters);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = result.total_pages ?? 1;
  const numericSize = size === 'all' ? result.total || 1 : Number(size);
  const from = result.total === 0 ? 0 : (page - 1) * numericSize + 1;
  const to = size === 'all' ? result.total : Math.min(page * numericSize, result.total);

  return {
    items: result.items,
    total: result.total,
    // Extras an endpoint may send alongside the page, e.g. the webhook log's
    // per-status counts. One page of rows cannot be counted client-side.
    statusCounts: result.status_counts ?? null,
    status,
    error,
    isLoading: status === 'loading',
    search,
    setSearch,
    filters,
    setFilter,
    setFilters,
    reset,
    sort,
    setSort: applySort,
    // Pagination, shaped for the <Pagination /> component.
    page,
    setPage,
    perPage: size,
    setPerPage: setSize,
    totalPages,
    from,
    to,
  };
}
