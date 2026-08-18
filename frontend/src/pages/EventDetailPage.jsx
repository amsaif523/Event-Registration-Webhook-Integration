import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn.js';
import { useAppData } from '../state/AppDataContext.jsx';
import { useNavigation } from '../state/NavigationContext.jsx';
import { useToast } from '../state/ToastContext.jsx';
import { eventFacts } from '../lib/events.js';
import { formatDate, formatTime, formatWeekday, formatNumber } from '../lib/format.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import CapacityBar from '../components/ui/CapacityBar.jsx';
import DateBlock from '../components/DateBlock.jsx';
import Icon from '../components/icons/Icon.jsx';
import RegistrationForm from '../components/RegistrationForm.jsx';
import { Banner, EmptyState, Skeleton } from '../components/ui/States.jsx';

export default function EventDetailPage() {
  const { getEvent, refreshEvent, createRegistration, isLoading } = useAppData();
  const { eventId, backToEvents, openSuccess } = useNavigation();
  const { toast } = useToast();
  const formRef = useRef(null);
  const [mobileBarVisible, setMobileBarVisible] = useState(true);

  const event = getEvent(eventId);
  const facts = event ? eventFacts(event) : null;

  /**
   * Re-read this event on open.
   *
   * The cached copy from the events list renders immediately, so there is no
   * loading flash; this quietly replaces it with current figures. Seat counts
   * go stale fast, and this is the screen where that matters — the one right
   * before someone fills in the form.
   */
  useEffect(() => {
    if (!eventId) return;
    refreshEvent(eventId).catch(() => {
      // The cached copy is already on screen and the server is the authority
      // on capacity regardless, so a failed refresh is not worth an error state.
    });
  }, [eventId, refreshEvent]);

  // Hide the sticky mobile CTA once the form itself is on screen.
  useEffect(() => {
    const node = formRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setMobileBarVisible(!entry.isIntersecting), {
      rootMargin: '-120px 0px -40% 0px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [event]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-8xl px-5 py-10 sm:px-8">
        <Skeleton className="h-4 w-32" />
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
          <Skeleton className="h-96 w-full rounded-card" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="card">
          <EmptyState
            icon="compass"
            title="That event is no longer available"
            description="It may have been removed or unpublished since you opened this page."
            action="Back to all events"
            actionIcon="arrowLeft"
            onAction={backToEvents}
          />
        </div>
      </div>
    );
  }

  const register = async (values) => {
    const registration = await createRegistration(values);
    toast.success('Registration received', `Reference ${registration.reference} is held for you.`);
    openSuccess(registration.reference);
    return registration;
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div
      className={cn(
        'mx-auto max-w-8xl px-5 pt-6 sm:px-8 sm:pb-16 sm:pt-10',
        // Only reserve room for the sticky CTA while it is actually showing,
        // otherwise the page ends in a block of empty space.
        facts.registerable && mobileBarVisible ? 'pb-32' : 'pb-10',
      )}
    >
      <button
        type="button"
        onClick={backToEvents}
        className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-body transition-colors duration-150 hover:text-ink"
      >
        <Icon name="arrowLeft" size={15} />
        All events
      </button>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-16">
        {/* ------------------------------------------------- event information */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge domain="event" value={event.status} />
            {facts.almostFull && facts.registerable && (
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                Almost full
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-display-sm font-bold leading-tight text-ink sm:text-display-md">
            {event.name}
          </h1>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-4 border-y border-hairline py-5">
            <div className="flex items-center gap-3">
              <DateBlock date={event.event_date} size="lg" muted={!facts.registerable} />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-meta">Date and time</p>
                <p className="mt-1 text-sm font-medium text-ink">
                  {formatWeekday(event.event_date)}, {formatDate(event.event_date)}
                </p>
                <p className="tabular text-[13px] text-body">Doors {formatTime(event.event_date)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-white text-meta">
                <Icon name="pin" size={17} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-meta">Venue</p>
                <p className="mt-1 max-w-[16rem] text-sm font-medium text-ink">{event.venue}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-white text-meta">
                <Icon name="users" size={17} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-meta">Capacity</p>
                <p className="tabular mt-1 text-sm font-medium text-ink">
                  {formatNumber(facts.taken)} of {formatNumber(facts.capacity)} taken
                </p>
              </div>
            </div>
          </div>

          <div className="mt-7 max-w-2xl">
            <h2 className="font-display text-lg font-semibold text-ink">About this event</h2>
            <p className="mt-2.5 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {event.description}
            </p>
          </div>

          <div className="mt-7 max-w-md">
            <CapacityBar taken={facts.taken} capacity={facts.capacity} left={facts.left} />
          </div>
        </div>

        {/* ------------------------------------------------- registration form */}
        <div ref={formRef} className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5 shadow-soft sm:p-6">
            <h2 className="font-display text-lg font-semibold text-ink">
              {facts.registerable ? 'Register for this event' : 'Registration unavailable'}
            </h2>
            <p className="mt-1 text-[13px] text-body">
              {facts.registerable
                ? `${formatNumber(facts.left)} ${facts.left === 1 ? 'seat' : 'seats'} still available.`
                : facts.blockedReason}
            </p>

            <div className="mt-5">
              {facts.registerable ? (
                <RegistrationForm event={event} onRegistered={register} />
              ) : (
                <Banner
                  tone={event.status === 'cancelled' ? 'error' : 'warning'}
                  title={
                    event.status === 'cancelled'
                      ? 'This event has been cancelled'
                      : facts.full
                        ? 'This event is now full'
                        : 'Registration is closed'
                  }
                >
                  {event.status === 'cancelled'
                    ? 'Anyone already registered has been notified separately.'
                    : facts.full
                      ? 'Every seat has been taken. Keep an eye on the events list for extra dates.'
                      : 'This event is not open for public registration right now.'}
                </Banner>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile action bar, hidden once the form is in view. */}
      {facts.registerable && mobileBarVisible && (
        <div className="fixed inset-x-0 bottom-14 z-40 border-t border-hairline bg-white/95 p-4 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-8xl items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{event.name}</p>
              <p className="tabular text-xs text-meta">{formatNumber(facts.left)} seats left</p>
            </div>
            <Button size="lg" onClick={scrollToForm} className="shrink-0">
              Register
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
