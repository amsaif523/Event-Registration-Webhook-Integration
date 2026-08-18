import { useAppData } from '../state/AppDataContext.jsx';
import { useNavigation } from '../state/NavigationContext.jsx';
import { useToast } from '../state/ToastContext.jsx';
import { formatDate, formatTime } from '../lib/format.js';
import Button from '../components/ui/Button.jsx';
import CopyButton from '../components/ui/CopyButton.jsx';
import Icon from '../components/icons/Icon.jsx';
import { EmptyState } from '../components/ui/States.jsx';

const NEXT_STEPS = [
  {
    title: 'Your seat is held',
    description: 'The registration is recorded as pending and counted against the event capacity straight away.',
  },
  {
    title: 'The ticketing system confirms it',
    description: 'An external provider issues your ticket and notifies us over a signed webhook.',
  },
  {
    title: 'Your status flips to confirmed',
    description: 'The tracking page updates on its own, with your ticket ID attached. No refresh needed.',
  },
];

export default function RegistrationSuccessPage() {
  const { getRegistration, getEvent } = useAppData();
  const { reference, openStatus, backToEvents } = useNavigation();
  const { toast } = useToast();

  const registration = getRegistration(reference);
  const event = registration ? getEvent(registration.event_id) : null;

  if (!registration) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16">
        <div className="card">
          <EmptyState
            icon="ticket"
            title="No registration to show"
            description="Start from the events list to register, or track an existing reference number."
            action="Browse events"
            actionIcon="arrowLeft"
            onAction={backToEvents}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-12 text-center sm:py-16">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
        <Icon name="check" size={26} strokeWidth={2} />
      </div>

      <h1 className="mt-6 font-display text-display-sm font-bold text-ink sm:text-display-md">
        You&rsquo;re registered
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-body">
        {event ? (
          <>
            We&rsquo;ve held a seat for you at <span className="font-medium text-ink">{event.name}</span> on{' '}
            {formatDate(event.event_date)} at {formatTime(event.event_date)}.
          </>
        ) : (
          'We have held your seat.'
        )}
      </p>

      {/* The reference is the hero of this screen. */}
      <div className="mt-8 rounded-card border border-hairline bg-white p-5 shadow-soft sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-meta">Your reference number</p>
        <p className="tabular mt-3 select-all break-all font-mono text-[26px] font-medium tracking-tight text-ink sm:text-[32px]">
          {registration.reference}
        </p>
        <div className="mt-4 flex justify-center">
          <CopyButton
            value={registration.reference}
            label="Copy reference"
            onCopied={() => toast.success('Reference copied', 'Keep it somewhere you can find again.')}
          />
        </div>
        <p className="mt-4 border-t border-hairline pt-4 text-[13px] text-meta">
          Save this. It is the only thing you need to track or discuss your registration.
        </p>
      </div>

      <div className="mt-9 text-left">
        <h2 className="text-center font-display text-base font-semibold text-ink">What happens next</h2>
        <ol className="mt-4 space-y-3">
          {NEXT_STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3.5 rounded-card border border-hairline bg-white p-4">
              <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-700">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{step.title}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-body">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" iconAfter="arrowRight" onClick={() => openStatus(registration.reference)}>
          Track my registration
        </Button>
        <Button size="lg" variant="secondary" onClick={backToEvents}>
          Back to events
        </Button>
      </div>
    </div>
  );
}
