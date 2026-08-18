import { cn } from '../lib/cn.js';
import { formatDateTime } from '../lib/format.js';
import Icon from './icons/Icon.jsx';

/**
 * Three fixed steps mirroring the backend lifecycle. Completed steps are
 * emerald, the step being waited on is amber with a soft pulsing indicator,
 * future steps are grey, and each state is spelled out in words as well.
 */
export default function StatusTimeline({ registration }) {
  const cancelled = registration.status === 'cancelled';
  const confirmed = registration.status === 'confirmed';

  const steps = [
    {
      key: 'received',
      title: 'Registration received',
      description: 'Your seat is held and a reference number was issued.',
      timestamp: registration.created_at,
      state: 'complete',
    },
    {
      key: 'awaiting',
      title: 'Awaiting ticket confirmation',
      description: cancelled
        ? 'This registration was cancelled before it was confirmed.'
        : 'The ticketing system is issuing your ticket.',
      timestamp: null,
      state: cancelled ? 'cancelled' : confirmed ? 'complete' : 'current',
    },
    {
      key: 'confirmed',
      title: confirmed ? 'Confirmed' : 'Confirmation',
      description: confirmed
        ? `Ticket ${registration.ticket_id} issued.`
        : cancelled
          ? 'Not reached.'
          : 'Your ticket ID appears here once issued.',
      timestamp: registration.confirmed_at,
      state: confirmed ? 'complete' : cancelled ? 'cancelled' : 'upcoming',
    },
  ];

  return (
    <ol className="relative space-y-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-[13px] top-8 h-[calc(100%-1.25rem)] w-px',
                  step.state === 'complete' ? 'bg-emerald-300' : 'bg-hairline',
                )}
              />
            )}

            {/* The marker carries the state on its own: a tick inside the
                circle when the step is done, a pulsing dot while it is running,
                an empty ring before it starts. */}
            <span
              className={cn(
                'relative z-10 mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300',
                step.state === 'complete' && 'border-emerald-600 bg-emerald-600 text-white',
                step.state === 'current' && 'border-amber-500 bg-white text-amber-600',
                step.state === 'upcoming' && 'border-slate-300 bg-white text-slate-400',
                step.state === 'cancelled' && 'border-slate-300 bg-white text-slate-400',
              )}
            >
              {step.state === 'complete' ? (
                <Icon name="check" size={16} strokeWidth={3} className="text-white" />
              ) : step.state === 'current' ? (
                <span className="h-2.5 w-2.5 animate-soft-pulse rounded-full bg-amber-500" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              )}
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3
                  className={cn(
                    'font-display text-[15px] font-semibold',
                    step.state === 'upcoming' || step.state === 'cancelled' ? 'text-slate-400' : 'text-ink',
                  )}
                >
                  {step.title}
                </h3>
                {step.state === 'current' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                    In progress
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-body">{step.description}</p>
              {step.timestamp && (
                <p className="tabular mt-1 text-xs text-meta">{formatDateTime(step.timestamp)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
