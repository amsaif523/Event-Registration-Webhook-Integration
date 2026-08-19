import { useEffect } from 'react';
import { AppDataProvider } from './state/AppDataContext.jsx';
import { AuthProvider, useAuth } from './state/AuthContext.jsx';
import { NavigationProvider, useNavigation, VIEWS } from './state/NavigationContext.jsx';
import { ToastProvider } from './state/ToastContext.jsx';
import Icon from './components/icons/Icon.jsx';
import Toaster from './components/ui/Toaster.jsx';
import PublicHeader from './components/PublicHeader.jsx';
import AdminShell from './components/admin/AdminShell.jsx';
import EventsPage from './pages/EventsPage.jsx';
import EventDetailPage from './pages/EventDetailPage.jsx';
import RegistrationSuccessPage from './pages/RegistrationSuccessPage.jsx';
import RegistrationStatusPage from './pages/RegistrationStatusPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import AdminLoginPage from './pages/admin/AdminLoginPage.jsx';
import DashboardPage from './pages/admin/DashboardPage.jsx';
import AdminEventsPage from './pages/admin/AdminEventsPage.jsx';
import AdminRegistrationsPage from './pages/admin/AdminRegistrationsPage.jsx';
import AdminApprovalsPage from './pages/admin/AdminApprovalsPage.jsx';
import WebhookLogsPage from './pages/admin/WebhookLogsPage.jsx';
import ApiExplorerPage from './pages/admin/ApiExplorerPage.jsx';

const PUBLIC_PAGES = {
  [VIEWS.events]: EventsPage,
  [VIEWS.eventDetail]: EventDetailPage,
  [VIEWS.success]: RegistrationSuccessPage,
  [VIEWS.status]: RegistrationStatusPage,
};

const ADMIN_PAGES = {
  [VIEWS.adminDashboard]: DashboardPage,
  [VIEWS.adminEvents]: AdminEventsPage,
  [VIEWS.adminRegistrations]: AdminRegistrationsPage,
  [VIEWS.adminApprovals]: AdminApprovalsPage,
  [VIEWS.adminWebhooks]: WebhookLogsPage,
  [VIEWS.adminApiExplorer]: ApiExplorerPage,
};

const TITLES = {
  [VIEWS.events]: 'Events',
  [VIEWS.eventDetail]: 'Event details',
  [VIEWS.success]: 'Registration confirmed',
  [VIEWS.status]: 'Track registration',
  [VIEWS.adminLogin]: 'Admin access',
  [VIEWS.adminDashboard]: 'Dashboard',
  [VIEWS.adminEvents]: 'Events · Admin',
  [VIEWS.adminRegistrations]: 'Registrations · Admin',
  [VIEWS.adminApprovals]: 'Approvals · Admin',
  [VIEWS.adminWebhooks]: 'Webhook logs · Admin',
  [VIEWS.adminApiExplorer]: 'API Explorer · Admin',
  [VIEWS.notFound]: 'Page not found',
};

/**
 * Renders whichever screen the navigation state points at.
 *
 * There is no router and no URL to match: the whole app lives at "/" so that no
 * event id or registration reference ever reaches the address bar, browser
 * history, or a Referer header. See NavigationContext for the reasoning.
 */
function Screen() {
  const { view, isAdminView, navigate } = useNavigation();
  const { isAuthenticated, isChecking, ensureSession } = useAuth();
  const needsSession = isAdminView || view === VIEWS.adminLogin;
  const year = new Date().getFullYear();

  useEffect(() => {
    document.title = TITLES[view] ? `${TITLES[view]} · Eventide` : 'Eventide';
  }, [view]);

  // Ask the server who we are only once an admin screen is involved. A visitor
  // browsing events never triggers it.
  useEffect(() => {
    if (needsSession) ensureSession();
  }, [needsSession, ensureSession]);

  // Admin screens require a session; an already-signed-in admin skips the login
  // card. Both decisions wait for the server's answer — acting while the check
  // is still in flight would bounce a signed-in admin to the login screen.
  useEffect(() => {
    if (!needsSession || isChecking) return;
    if (isAdminView && !isAuthenticated) navigate(VIEWS.adminLogin);
    else if (view === VIEWS.adminLogin && isAuthenticated) navigate(VIEWS.adminDashboard);
  }, [view, isAdminView, isAuthenticated, isChecking, needsSession, navigate]);

  if (needsSession && isChecking) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface">
        <div className="flex items-center gap-3 text-[13px] text-meta">
          <Icon name="loader" size={16} className="animate-spin" />
          Checking your session…
        </div>
      </div>
    );
  }

  if (view === VIEWS.adminLogin) return <AdminLoginPage />;

  if (isAdminView) {
    if (!isAuthenticated) return <AdminLoginPage />;
    const AdminPage = ADMIN_PAGES[view];
    return (
      <AdminShell>
        <AdminPage />
      </AdminShell>
    );
  }

  const PublicPage = PUBLIC_PAGES[view] ?? NotFoundPage;

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      {/* Padded to clear the fixed footer, same approach as the admin shell. */}
      <main className="pb-14">
        <PublicPage />
      </main>
      <footer className="fixed inset-x-0 bottom-0 z-30 h-14 border-t border-hairline bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-8xl items-center justify-between gap-4 px-5 text-[13px] text-meta sm:px-8">
          <p className="truncate">&copy; {year} Eventide. All rights reserved.</p>

          {/* Admin lives here rather than in the header: it is a staff entry
              point, not something a visitor to the site is looking for. */}
          <button
            type="button"
            onClick={() => navigate(isAuthenticated ? VIEWS.adminDashboard : VIEWS.adminLogin)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium text-body transition-colors duration-150 hover:bg-slate-100 hover:text-ink"
          >
            <Icon name="shield" size={15} />
            Admin
          </button>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <NavigationProvider>
          <AppDataProvider>
            <Screen />
            <Toaster />
          </AppDataProvider>
        </NavigationProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
