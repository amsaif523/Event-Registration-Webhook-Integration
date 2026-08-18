import { useEffect, useRef, useState } from 'react';
import { useAppData } from '../state/AppDataContext.jsx';
import { useNavigation, VIEWS } from '../state/NavigationContext.jsx';
import { useToast } from '../state/ToastContext.jsx';
import { formatDate, formatDateTime, formatTime } from '../lib/format.js';
import Badge from '../components/ui/Badge.jsx';
import Button from '../components/ui/Button.jsx';
import CopyButton from '../components/ui/CopyButton.jsx';
import Icon from '../components/icons/Icon.jsx';
import StatusTimeline from '../components/StatusTimeline.jsx';
import { Field, TextInput } from '../components/ui/Field.jsx';
import { Banner, Skeleton } from '../components/ui/States.jsx';

const POLL_INTERVAL_MS = 4000;

export default function RegistrationStatusPage() {
  const {
    getRegistration,
    getEvent,
    lookupRegistration,
    isLoading,
  } = useAppData();
  const { reference, openStatus, backToEvents, navigate } = useNavigation();
  const { toast } = useToast();

  const [lookupValue, setLookupValue] = useState('');
  const [lookupError, setLookupError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const previousStatus = useRef(null);

  const registration = reference ? getRegistration(reference) : null;
  const event = registration ? getEvent(registration.event_id) : null;

  /**
   * Poll while the registration is pending. This is the mechanism that makes
   * the status flip appear without a manual refresh; it stops as soon as the
   * registration reaches a terminal state so we are not hitting the endpoint
   * forever on a confirmed record.
   */
  useEffect(() => {
    if (!reference || !registration || registration.status !== 'pending') return undefined;
    const timer = setInterval(() => {
      lookupRegistration(reference).catch(() => {
        /* transient lookup failure, the next tick tries again */
      });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reference, registration, lookupRegistration]);

  // Detect the pending -> confirmed transition so the banner only shows on the flip.
  useEffect(() => {
    const current = registration?.status ?? null;
    if (previousStatus.current === 'pending' && current === 'confirmed') {
      setJustConfirmed(true);
      toast.success('Registration confirmed', `Ticket ${registration.ticket_id} has been issued.`);
      const timer = setTimeout(() => setJustConfirmed(false), 8000);
      previousStatus.current = current;
      return () => clearTimeout(timer);
    }
    previousStatus.current = current;
    return undefined;
  }, [registration, toast]);

  /**
   * Navigation state survives a reload, but the registration it points at may
   * not — in design mode the data resets to mock.json, so anything created in
   * the previous session is gone. Drop the dangling reference quietly rather
   * than reopening the page with a warning about something nobody did.
   */
  useEffect(() => {
    if (!reference || isLoading) return;
    if (!getRegistration(reference)) navigate(VIEWS.status, { reference: null });
  }, [reference, isLoading, getRegistration, navigate]);

  const submitLookup = async (formEvent) => {
    formEvent.preventDefault();
    const candidate = lookupValue.trim().toUpperCase();
    if (!candidate) {
      setLookupError('Enter the reference number from your confirmation screen.');
      return;
    }
    setLookingUp(true);
    setLookupError(null);
    try {
      const found = await lookupRegistration(candidate);
      openStatus(found.reference);
      setLookupValue('');
    } catch (error) {
      setLookupError(error?.message ?? 'We could not find that reference.');
    } finally {
      setLookingUp(false);
    }
  };

  /* ------------------------------------------------------------- loading */

  // Registrations arrive asynchronously. Without this, the first paint of a
  // perfectly valid reference finds an empty array and wrongly reports it as
  // missing — which is what "no longer available" was showing on arrival.
  if (reference && isLoading) {
    return (
      <div className="mx-auto max-w-8xl px-5 py-8 sm:px-8 sm:py-12">
        <Skeleton className="h-4 w-24" />
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
          <div className="space-y-5">
            <Skeleton className="h-48 w-full rounded-card" />
            <Skeleton className="h-64 w-full rounded-card" />
          </div>
          <Skeleton className="h-72 w-full rounded-card" />
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------- lookup-only view */

  if (!registration) {
    return (
      <div className="mx-auto max-w-lg px-5 py-12 sm:py-16">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-hairline bg-white text-brand-500">
            <Icon name="ticket" size={22} />
          </div>
          <h1 className="mt-5 font-display text-display-sm font-bold text-ink">Track your registration</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-body">
            Enter the reference number issued when you registered. It looks like{' '}
            <span className="font-mono text-[13px] text-ink">EVT-XXXXXXXX</span>.
          </p>
        </div>

        <form onSubmit={submitLookup} noValidate className="card mt-7 space-y-4 p-5 sm:p-6">
          <Field label="Reference number" required htmlFor="lookup-reference" error={lookupError ?? undefined}>
            <TextInput
              id="lookup-reference"
              value={lookupValue}
              autoComplete="off"
              spellCheck="false"
              placeholder="EVT-XXXXXXXX"
              className="font-mono uppercase tracking-wide"
              error={lookupError ?? undefined}
              onChange={(e) => {
                setLookupValue(e.target.value);
                setLookupError(null);
              }}
            />
          </Field>
          <Button type="submit" size="lg" fullWidth loading={lookingUp} loadingText="Looking up…">
            Find my registration
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={backToEvents}
            className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-body transition-colors hover:text-ink"
          >
            <Icon name="arrowLeft" size={15} />
            Back to all events
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ status view */

  const confirmed = registration.status === 'confirmed';

  return (
    <div className="mx-auto max-w-8xl px-5 py-8 sm:px-8 sm:py-12">
      <button
        type="button"
        onClick={backToEvents}
        className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-body transition-colors hover:text-ink"
      >
        <Icon name="arrowLeft" size={15} />
        All events
      </button>

      {justConfirmed && (
        <Banner tone="success" title="Your registration is confirmed" className="mt-5">
          The ticketing system verified the signature and issued ticket{' '}
          <span className="font-mono text-xs">{registration.ticket_id}</span>.
        </Banner>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:items-start">
        <div className="space-y-5">
      {/* ----------------------------------------------------- summary card */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-meta">Reference</p>
            <div className="mt-1.5 flex items-center gap-2">
              <p className="tabular select-all font-mono text-xl font-medium tracking-tight text-ink sm:text-2xl">
                {registration.reference}
              </p>
              <CopyButton
                variant="icon"
                value={registration.reference}
                onCopied={() => toast.success('Reference copied')}
              />
            </div>
          </div>
          <Badge domain="registration" value={registration.status} className="mt-1" />
        </div>

        <dl className="grid grid-cols-1 divide-y divide-hairline sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="p-5 sm:p-6">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-meta">Event</dt>
            <dd className="mt-1.5">
              <p className="font-display text-[15px] font-semibold leading-snug text-ink">
                {event?.name ?? 'Event unavailable'}
              </p>
              {event && (
                <p className="mt-1 text-[13px] text-body">
                  {formatDate(event.event_date)} · {formatTime(event.event_date)}
                </p>
              )}
              {event && <p className="mt-0.5 text-[13px] text-meta">{event.venue}</p>}
            </dd>
          </div>
          <div className="p-5 sm:p-6">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-meta">Registered as</dt>
            <dd className="mt-1.5">
              <p className="text-[15px] font-medium text-ink">
                {registration.first_name} {registration.last_name}
              </p>
              <p className="mt-1 truncate text-[13px] text-body">{registration.email}</p>
              <p className="tabular mt-0.5 text-[13px] text-meta">{registration.phone}</p>
            </dd>
          </div>
        </dl>

        {confirmed && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-emerald-50/60 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Icon name="ticket" size={17} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Ticket issued</p>
                <p className="tabular mt-0.5 font-mono text-sm font-medium text-emerald-900">
                  {registration.ticket_id}
                </p>
              </div>
            </div>
            <p className="tabular text-[13px] text-emerald-700">
              Confirmed {formatDateTime(registration.confirmed_at)}
            </p>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------- timeline */}
      <section className="card p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-base font-semibold text-ink">Progress</h2>
          {registration.status === 'pending' && (
            <span className="inline-flex items-center gap-2 text-[13px] text-meta">
              <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-amber-500" />
              Checking for updates
            </span>
          )}
        </div>
        <StatusTimeline registration={registration} />
      </section>

        </div>

      </div>
    </div>
  );
}
