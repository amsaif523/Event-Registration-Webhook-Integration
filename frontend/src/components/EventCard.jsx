import { cn } from '../lib/cn.js';
import { eventFacts, ctaLabel } from '../lib/events.js';
import { formatTime, formatWeekday, formatDate } from '../lib/format.js';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import CapacityBar from './ui/CapacityBar.jsx';
import DateBlock from './DateBlock.jsx';
import Icon from './icons/Icon.jsx';

/**
 * Events that cannot be registered for are muted and disabled, never hidden:
 * a sold-out event still tells you the event exists, which is information.
 */
export default function EventCard({ event, onOpen }) {
  const facts = eventFacts(event);
  const dimmed = !facts.registerable;

  return (
    <article
      className={cn(
        'group card flex flex-col p-5 transition-all duration-200 ease-out',
        dimmed
          ? 'bg-slate-50/60'
          : 'hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft',
      )}
    >
      <div className="flex items-start gap-4">
        <DateBlock date={event.event_date} muted={dimmed} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <Badge domain="event" value={event.status} size="sm" />
            {facts.almostFull && event.status === 'published' && !facts.past && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                Almost full
              </span>
            )}
          </div>
          <h3
            className={cn(
              'font-display text-[17px] font-semibold leading-snug tracking-tight',
              dimmed ? 'text-slate-600' : 'text-ink',
            )}
          >
            {event.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-body">{event.description}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 text-[13px] text-body">
        <div className="flex items-center gap-2">
          <dt className="sr-only">Date and time</dt>
          <Icon name="clock" size={15} className="shrink-0 text-meta" />
          <dd className="truncate">
            {formatWeekday(event.event_date)}, {formatDate(event.event_date)} · {formatTime(event.event_date)}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">Venue</dt>
          <Icon name="pin" size={15} className="shrink-0 text-meta" />
          <dd className="truncate">{event.venue}</dd>
        </div>
      </dl>

      <CapacityBar
        className="mt-4"
        taken={facts.taken}
        capacity={facts.capacity}
        left={facts.left}
      />

      <div className="mt-5 flex-1" />

      <Button
        fullWidth
        variant={facts.registerable ? 'primary' : 'secondary'}
        disabled={!facts.registerable}
        onClick={() => onOpen(event.id)}
        iconAfter={facts.registerable ? 'arrowRight' : undefined}
      >
        {facts.registerable ? 'View details' : ctaLabel(event)}
      </Button>
    </article>
  );
}
