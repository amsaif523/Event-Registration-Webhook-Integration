import { useMemo } from 'react';
import { USE_MOCK } from '../../api/index.js';
import { useAppData } from '../../state/AppDataContext.jsx';
import useDashboard from '../../hooks/useDashboard.js';
import { useNavigation, VIEWS } from '../../state/NavigationContext.jsx';
import { cn } from '../../lib/cn.js';
import { formatDate, formatDateTime, relativeTime, truncateMiddle } from '../../lib/format.js';
import { statusMeta, TONE_CLASSES } from '../../lib/status.js';
import { AdminPageHeader } from '../../components/admin/AdminShell.jsx';
import StatCard from '../../components/admin/StatCard.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/icons/Icon.jsx';
import { EmptyState, ErrorState, StatCardSkeleton, TableSkeleton } from '../../components/ui/States.jsx';

export default function DashboardPage() {
  const app = useAppData();
  const live = useDashboard();
  const { navigate } = useNavigation();

  /**
   * Against the real API the dashboard has its own endpoint, polled, so the
   * counts and both feeds come from one call and stay in step. In design mode
   * there is no server, so it falls back to the in-memory data.
   */
  const events = app.events;
  const stats = USE_MOCK ? app.stats : live.stats ?? {};
  const status = USE_MOCK ? app.status : live.status;
  const error = USE_MOCK ? app.error : live.error;
  const reload = USE_MOCK ? app.reload : live.reload;
  const registrations = USE_MOCK ? app.registrations : live.recent_registrations ?? [];
  const webhooks = USE_MOCK ? app.webhook_events : live.recent_webhooks ?? [];

  const recentRegistrations = useMemo(
    () =>
      [...registrations]
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
        .slice(0, 6),
    [registrations],
  );

  // Rows that appeared since the last poll. Empty on first load and in mock mode.
  // Pending only: a confirmed registration needs nobody's attention.
  const isNewRegistration = (id) =>
    live.newRegistrationIds.has(id)
    && recentRegistrations.find((r) => r.id === id)?.status === 'pending';
  const isNewWebhook = (id) => live.newWebhookIds.has(id);
  const newCount = live.newRegistrationIds.size;

  const recentWebhooks = useMemo(
    () =>
      [...webhooks]
        .sort((a, b) => String(b.received_at).localeCompare(String(a.received_at)))
        .slice(0, 6),
    [webhooks],
  );

  const eventName = (id, fallback) =>
    fallback ?? events.find((event) => event.id === id)?.name ?? 'Unknown event';

  if (status === 'error') {
    return (
      <div className="p-5 sm:p-8">
        <ErrorState
          title="The dashboard could not load"
          description={error?.message ?? 'Data is temporarily unavailable.'}
          onRetry={reload}
        />
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-8">
      <AdminPageHeader
        title="Dashboard"
        description="Everything happening across events, registrations and the ticketing integration."
        actions={
          <div className="flex items-center gap-3">
            {/* Says the screen is watching, so a still page reads as "nothing
                has happened" rather than "this is broken". */}
            {live.isPolling && (
              <span className="hidden items-center gap-2 text-[13px] text-meta sm:inline-flex">
                <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-emerald-500" />
                {newCount > 0
                  ? `${newCount} new registration${newCount === 1 ? '' : 's'}`
                  : 'Watching for new registrations'}
              </span>
            )}
            <Button variant="secondary" icon="refresh" onClick={reload}>
              Refresh
            </Button>
          </div>
        }
      />

      {/* ------------------------------------------------------- stat cards */}
      <div className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {status === 'loading' ? (
          Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Total events"
              value={stats.total_events}
              icon="calendar"
              context={`${stats.published_events} published and open to the public`}
            />
            <StatCard
              label="Total registrations"
              value={stats.total_registrations}
              icon="list"
              context={`${stats.confirmed_registrations} confirmed by the ticketing system`}
            />
            <StatCard
              label="Pending confirmations"
              value={stats.pending_registrations}
              icon="clock"
              context={
                stats.pending_registrations > 0
                  ? 'Seats held, waiting on a ticket webhook'
                  : 'Every registration has been resolved'
              }
            />
            <StatCard
              label="Webhooks rejected (24h)"
              value={stats.webhooks_rejected}
              icon="shield"
              alert={stats.webhooks_rejected > 0}
              context={
                stats.webhooks_rejected > 0
                  ? `Out of ${stats.webhooks_last_24h} deliveries. Check the webhook log.`
                  : `All ${stats.webhooks_last_24h} deliveries verified`
              }
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {/* ----------------------------------------- recent registrations */}
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <h2 className="font-display text-base font-semibold text-ink">Recent registrations</h2>
            <button
              type="button"
              onClick={() => navigate(VIEWS.adminRegistrations, { eventId: null })}
              className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800"
            >
              View all
              <Icon name="chevronRight" size={14} />
            </button>
          </header>

          {status === 'loading' ? (
            <TableSkeleton rows={5} columns={3} />
          ) : recentRegistrations.length === 0 ? (
            <EmptyState
              compact
              icon="inbox"
              title="No registrations yet"
              description="They appear here as soon as someone registers for a published event."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {recentRegistrations.map((registration) => {
                const isNew = isNewRegistration(registration.id);

                return (
                  <li
                    key={registration.id}
                    className={cn(
                      'relative flex items-center gap-3 px-5 py-3.5',
                      // Three passes then it settles. A row that flashes
                      // forever stops being a signal.
                      isNew && 'animate-arrive-flash',
                    )}
                  >
                    {isNew && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 w-[3px] bg-brand-500"
                      />
                    )}
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold',
                        isNew ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {registration.first_name.charAt(0)}
                      {registration.last_name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                        {registration.first_name} {registration.last_name}
                        {isNew && (
                          <span className="shrink-0 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            New
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[13px] text-meta">
                        {eventName(registration.event_id, registration.event_name)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="tabular font-mono text-[11px] text-meta">{registration.reference}</p>
                      <p className="tabular text-[11px] text-meta">{formatDate(registration.created_at)}</p>
                    </div>
                    <Badge domain="registration" value={registration.status} size="sm" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ------------------------------------------- recent webhook activity */}
        <section className="card overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-4">
            <h2 className="font-display text-base font-semibold text-ink">Recent webhook activity</h2>
            <button
              type="button"
              onClick={() => navigate(VIEWS.adminWebhooks)}
              className="inline-flex items-center gap-1 rounded text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800"
            >
              View log
              <Icon name="chevronRight" size={14} />
            </button>
          </header>

          {status === 'loading' ? (
            <TableSkeleton rows={5} columns={3} />
          ) : recentWebhooks.length === 0 ? (
            <EmptyState
              compact
              icon="activity"
              title="No deliveries recorded"
              description="Every inbound webhook is logged here, including the ones we reject."
            />
          ) : (
            <ul className="divide-y divide-hairline">
              {recentWebhooks.map((webhook) => {
                const meta = statusMeta('webhook', webhook.status);
                const tone = TONE_CLASSES[meta.tone] ?? TONE_CLASSES.slate;
                const isNew = isNewWebhook(webhook.id);

                return (
                  <li
                    key={webhook.id}
                    className={cn(
                      'relative flex items-center gap-3 px-5 py-3.5',
                      isNew && 'animate-arrive-flash',
                    )}
                  >
                    {isNew && (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-brand-500" />
                    )}
                    <span
                      className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-full', tone.soft, tone.text)}
                    >
                      <Icon
                        name={
                          webhook.status === 'processed'
                            ? 'checkCircle'
                            : webhook.status === 'duplicate'
                              ? 'copy'
                              : 'alertCircle'
                        }
                        size={16}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{webhook.event_type}</p>
                      <p className="truncate font-mono text-[11px] text-meta">
                        {webhook.registration_reference ?? truncateMiddle(webhook.delivery_id)}
                      </p>
                    </div>
                    <time
                      className="tabular hidden shrink-0 text-[11px] text-meta sm:block"
                      dateTime={webhook.received_at}
                      title={formatDateTime(webhook.received_at)}
                    >
                      {relativeTime(webhook.received_at)}
                    </time>
                    <Badge domain="webhook" value={webhook.status} size="sm" />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
