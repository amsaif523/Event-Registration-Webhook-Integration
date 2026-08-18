import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * State-driven navigation. Deliberately not react-router.
 *
 * CLAUDE.md forbids identifiers in URLs anywhere, frontend included, so there
 * are no /events/12 or /status/EVT-... routes to leak a reference into browser
 * history, bookmarks or a Referer header. The selected event id lives in React
 * state; the reference is mirrored into sessionStorage so that a refresh on the
 * status screen recovers instead of dead-ending.
 */

const NavigationContext = createContext(null);

const STORAGE_KEY = 'eventide.nav';

export const VIEWS = {
  events: 'events',
  eventDetail: 'event-detail',
  success: 'success',
  status: 'status',
  adminLogin: 'admin-login',
  adminDashboard: 'admin-dashboard',
  adminEvents: 'admin-events',
  adminRegistrations: 'admin-registrations',
  adminWebhooks: 'admin-webhooks',
  notFound: 'not-found',
};

const ADMIN_VIEWS = new Set([
  VIEWS.adminDashboard,
  VIEWS.adminEvents,
  VIEWS.adminRegistrations,
  VIEWS.adminWebhooks,
]);

const INITIAL = { view: VIEWS.events, eventId: null, reference: null };

function readStored() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw);
    if (!Object.values(VIEWS).includes(parsed.view)) return INITIAL;
    return { ...INITIAL, ...parsed };
  } catch {
    return INITIAL;
  }
}

export function NavigationProvider({ children }) {
  const [route, setRoute] = useState(readStored);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(route));
    } catch {
      /* private browsing, navigation just stops surviving refresh */
    }
  }, [route]);

  const navigate = useCallback((view, params = {}) => {
    setRoute((current) => ({ ...current, ...params, view }));
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, []);

  const value = useMemo(
    () => ({
      route,
      view: route.view,
      eventId: route.eventId,
      reference: route.reference,
      navigate,
      isAdminView: ADMIN_VIEWS.has(route.view),
      openEvent: (eventId) => navigate(VIEWS.eventDetail, { eventId }),
      openStatus: (reference) => navigate(VIEWS.status, { reference }),
      openSuccess: (reference) => navigate(VIEWS.success, { reference }),
      // Carries the event through so the registrations filter arrives already
      // narrowed to it. Pass nothing to land on the unfiltered list.
      openRegistrationsFor: (eventId = null) => navigate(VIEWS.adminRegistrations, { eventId }),
      backToEvents: () => navigate(VIEWS.events, { eventId: null }),
    }),
    [route, navigate],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigation must be used inside a NavigationProvider');
  return context;
}
