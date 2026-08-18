import { cn } from '../../lib/cn.js';
import Icon from '../icons/Icon.jsx';
import Wordmark from '../Wordmark.jsx';
import Avatar from '../ui/Avatar.jsx';
import { useNavigation, VIEWS } from '../../state/NavigationContext.jsx';
import { useAuth } from '../../state/AuthContext.jsx';

const NAV_ITEMS = [
  // shortLabel keeps the mobile tab bar readable at 390px, where four full
  // labels would either wrap or truncate.
  { view: VIEWS.adminDashboard, label: 'Dashboard', shortLabel: 'Home', icon: 'dashboard' },
  { view: VIEWS.adminEvents, label: 'Events', shortLabel: 'Events', icon: 'calendar' },
  { view: VIEWS.adminRegistrations, label: 'Registrations', shortLabel: 'Registrations', icon: 'list' },
  { view: VIEWS.adminWebhooks, label: 'Webhook logs', shortLabel: 'Webhooks', icon: 'activity' },
];

const SIDEBAR_WIDTH = 'lg:w-64';

/**
 * Fixed chrome, scrolling content.
 *
 * The sidebar, the top bar and the footer are all position-fixed, so only the
 * page content scrolls. That keeps navigation and the signed-in identity
 * reachable from anywhere in a long table without scrolling back up.
 *
 * On mobile the sidebar is replaced by a bottom tab bar rather than a drawer
 * behind a hamburger. Sections are one thumb-tap away and always visible, which
 * is how a phone app behaves; a drawer hides navigation behind a gesture nobody
 * is prompted to make.
 *
 * The main column is padded to clear each fixed edge rather than nested inside
 * an inner scroll container: the page keeps the native scrollbar, Cmd+F still
 * works, and anchor scrolling is not swallowed by an overflow context.
 */

/** Avatar, name and sign out. Shown in the sidebar and again in the top bar. */
function UserBlock({ tone = 'light', compact = false }) {
  const { name, initials, signOut } = useAuth();
  const { navigate } = useNavigation();

  const leave = () => {
    signOut();
    navigate(VIEWS.events);
  };

  return (
    <div className={cn('flex items-center gap-3', compact ? 'gap-2' : 'gap-3')}>
      <Avatar initials={initials} tone={tone} size={compact ? 'sm' : 'md'} />

      {!compact && (
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-[13px] font-semibold',
              tone === 'dark' ? 'text-white' : 'text-ink',
            )}
            title={name}
          >
            {name}
          </p>
          <p className={cn('truncate text-[11px]', tone === 'dark' ? 'text-slate-400' : 'text-meta')}>
            Signed in
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={leave}
        title="Sign out"
        className={cn(
          'grid h-8 w-8 shrink-0 place-items-center rounded transition-colors duration-150',
          tone === 'dark'
            ? 'text-slate-400 hover:bg-white/10 hover:text-white'
            : 'text-meta hover:bg-slate-100 hover:text-ink',
        )}
      >
        <Icon name="logOut" size={16} />
        <span className="sr-only">Sign out</span>
      </button>
    </div>
  );
}

export default function AdminShell({ children }) {
  const { view, navigate } = useNavigation();

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-hairline px-5">
        <Wordmark subtitle="Admin" />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Admin sections">
        {NAV_ITEMS.map((item) => {
          const active = view === item.view;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => navigate(item.view, { eventId: null })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex w-full items-center gap-3 rounded py-2.5 pl-4 pr-3 text-sm font-medium',
                'transition-colors duration-150 ease-out',
                active ? 'bg-brand-50 text-brand-700' : 'text-body hover:bg-slate-100 hover:text-ink',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1.5 h-[calc(100%-0.75rem)] w-[3px] rounded-full bg-brand-500" />
              )}
              <Icon name={item.icon} size={18} className={active ? 'text-brand-600' : 'text-meta'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Signed-in identity pinned to the bottom of the sidebar. */}
      <div className="shrink-0 border-t border-hairline p-3">
        <UserBlock />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface">
      {/* ------------------------------------------------- fixed desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden border-r border-hairline bg-white lg:block',
          SIDEBAR_WIDTH,
        )}
      >
        {sidebar}
      </aside>

      {/* ------------------------------------------------------- fixed top bar */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline bg-white/90 px-4 backdrop-blur-md sm:px-8',
          'lg:left-64',
        )}
      >
        <div className="lg:hidden">
          <Wordmark subtitle="Admin" />
        </div>

        <button
          type="button"
          onClick={() => navigate(VIEWS.events)}
          className="ml-auto hidden h-9 items-center gap-1.5 rounded px-3 text-[13px] font-medium text-body transition-colors hover:bg-slate-100 hover:text-ink lg:inline-flex"
        >
          <Icon name="arrowLeft" size={15} />
          Public site
        </button>

        <div className="ml-auto border-l border-hairline pl-3 lg:ml-0">
          <UserBlock />
        </div>
      </header>

      {/* --------------------------------------------------------------- content */}
      {/* Padded to clear the fixed sidebar, top bar and footer. */}
      <main className="min-w-0 pb-20 pt-16 lg:pb-20 lg:pl-64">{children}</main>

      {/* --------------------------------------------------------- fixed footer */}
      {/* --------------------------------------------- mobile bottom tab bar */}
      <nav
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {NAV_ITEMS.map((item) => {
            const active = view === item.view;
            return (
              <li key={item.view}>
                <button
                  type="button"
                  onClick={() => navigate(item.view, { eventId: null })}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-16 w-full flex-col items-center justify-center gap-1 px-1',
                    'transition-colors duration-150 ease-out',
                    active ? 'text-brand-700' : 'text-meta active:bg-slate-100',
                  )}
                >
                  {active && (
                    <span className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-brand-500" />
                  )}
                  <Icon name={item.icon} size={21} className={active ? 'text-brand-600' : undefined} />
                  <span className="text-[10px] font-medium leading-none">{item.shortLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ------------------------------------------- fixed footer, desktop only */}
      <footer className="fixed inset-x-0 bottom-0 z-30 hidden h-16 items-center border-t border-hairline bg-white/90 px-4 backdrop-blur-md sm:px-8 lg:left-64 lg:flex">
        <div className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[13px] text-meta">
          <p>&copy; {new Date().getFullYear()} Eventide. All rights reserved.</p>
          <p>Event registration and ticketing</p>
        </div>
      </footer>
    </div>
  );
}

/** Consistent page header for every admin screen. */
export function AdminPageHeader({ title, description, actions, className = '' }) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-display-sm font-bold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-body">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
