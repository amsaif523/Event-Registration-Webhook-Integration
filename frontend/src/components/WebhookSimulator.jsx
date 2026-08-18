import { useState } from 'react';
import { cn } from '../lib/cn.js';
import { formatTime } from '../lib/format.js';
import { statusMeta, TONE_CLASSES } from '../lib/status.js';
import { Tag } from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import Icon from './icons/Icon.jsx';

/**
 * The reviewer opens a public URL, not a terminal, so the ticketing system has
 * to be triggerable from the browser or step four of the flow is invisible.
 *
 * The button posts to /api/dev/simulate-webhook, which signs the payload
 * server-side and delivers it to the real webhook endpoint. WEBHOOK_SECRET
 * never reaches the browser. The failure paths are here on purpose: watching a
 * bad signature get rejected proves as much as watching a good one succeed.
 */
const MODES = [
  {
    id: 'valid',
    label: 'Send valid webhook',
    hint: 'Correctly signed, confirms the registration.',
    variant: 'primary',
    icon: 'checkCircle',
  },
  {
    id: 'bad_signature',
    label: 'Send with invalid signature',
    hint: 'Signed with the wrong secret. Expect 401 and no change.',
    variant: 'secondary',
    icon: 'shield',
  },
  {
    id: 'duplicate',
    label: 'Send duplicate webhook',
    hint: 'Replays the same delivery id. Expect 200 and no change.',
    variant: 'secondary',
    icon: 'copy',
  },
];

export default function WebhookSimulator({ reference, onSimulate, attempts = [] }) {
  const [busyMode, setBusyMode] = useState(null);

  const run = async (mode) => {
    setBusyMode(mode);
    try {
      await onSimulate(mode);
    } finally {
      setBusyMode(null);
    }
  };

  return (
    <section className="rounded-card border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h2 className="font-display text-base font-semibold text-ink">Simulate ticketing system</h2>
            <Tag tone="amber">Demo only</Tag>
          </div>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-body">
            Stands in for the external ticketing provider. The payload is signed on the server and posted to the
            real webhook endpoint, so the secret is never exposed to this page.
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-3 xl:grid-cols-1">
        {MODES.map((mode) => (
          <div key={mode.id} className="flex flex-col">
            <Button
              variant={mode.variant}
              icon={mode.icon}
              fullWidth
              loading={busyMode === mode.id}
              loadingText="Sending…"
              disabled={Boolean(busyMode) && busyMode !== mode.id}
              onClick={() => run(mode.id)}
              className="!justify-start"
            >
              {mode.label}
            </Button>
            <p className="mt-1.5 px-0.5 text-[12px] leading-snug text-meta">{mode.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-hairline bg-white">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-meta">Delivery log</h3>
          <span className="tabular text-[11px] text-meta">
            {attempts.length} {attempts.length === 1 ? 'attempt' : 'attempts'}
          </span>
        </div>

        {attempts.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-5 text-[13px] text-meta">
            <Icon name="activity" size={15} />
            No deliveries yet for {reference}. Send one above to watch it arrive.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {attempts.slice(0, 5).map((attempt) => {
              const meta = statusMeta('webhook', attempt.status);
              const tone = TONE_CLASSES[meta.tone] ?? TONE_CLASSES.slate;
              return (
                <li key={attempt.id ?? attempt.delivery_id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      tone.badge,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                    {meta.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-meta">
                    {attempt.delivery_id}
                  </span>
                  <time className="tabular shrink-0 text-[11px] text-meta">
                    {formatTime(attempt.received_at)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
