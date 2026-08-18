import Wordmark from './Wordmark.jsx';
import Icon from './icons/Icon.jsx';
import { useNavigation, VIEWS } from '../state/NavigationContext.jsx';

/**
 * Compact public header: wordmark left, one action right.
 *
 * That action is "Track registration", because it is the thing a visitor
 * actually returns to the site to do. Admin is not a visitor task and lives in
 * the footer instead.
 */
export default function PublicHeader() {
  const { navigate, backToEvents } = useNavigation();

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-8xl items-center justify-between gap-4 px-5 sm:px-8">
        <button
          type="button"
          onClick={backToEvents}
          className="rounded transition-opacity duration-150 hover:opacity-80"
          aria-label="Eventide, back to all events"
        >
          <Wordmark />
        </button>

        <nav className="flex items-center">
          <button
            type="button"
            onClick={() => navigate(VIEWS.status, { reference: null })}
            className="inline-flex h-10 items-center gap-1.5 rounded border border-hairline bg-white px-3 text-[13px] font-medium text-body transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-ink"
          >
            <Icon name="ticket" size={15} />
            {/* Shortened rather than hidden on mobile: it is the one thing a
                returning visitor comes back for. */}
            <span className="sm:hidden">Track</span>
            <span className="hidden sm:inline">Track registration</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
