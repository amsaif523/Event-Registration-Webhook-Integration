import { useEffect, useMemo, useState } from 'react';
import { USE_MOCK } from '../../api/index.js';
import { cn } from '../../lib/cn.js';
import { useAppData } from '../../state/AppDataContext.jsx';
import { useToast } from '../../state/ToastContext.jsx';
import { formatDate, relativeTime } from '../../lib/format.js';
import { statusMeta } from '../../lib/status.js';
import { AdminPageHeader } from '../../components/admin/AdminShell.jsx';
import Badge from '../../components/ui/Badge.jsx';
import CopyButton from '../../components/ui/CopyButton.jsx';
import Icon from '../../components/icons/Icon.jsx';
import JsonBlock from '../../components/JsonBlock.jsx';
import WebhookSimulator from '../../components/WebhookSimulator.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import SlideOver from '../../components/ui/SlideOver.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import useListQuery from '../../hooks/useListQuery.js';
import IconButton from '../../components/ui/IconButton.jsx';
import { DetailRow } from '../../components/ui/DetailRow.jsx';

/**
 * The one place staff act on a registration rather than just look at it.
 * Registrations elsewhere in the admin are read-only; the "confirm this"
 * action lives only here, scoped to the queue that actually needs it.
 */
function buildColumns(eventName, onView) {
  return [
    {
      name: 'Reference',
      sortable: true,
      sortField: 'reference',
      width: '130px',
      selector: (row) => row.reference,
      cell: (row) => <span className="tabular font-mono text-[13px] text-ink">{row.reference}</span>,
    },
    {
      name: 'Name',
      sortable: true,
      sortField: 'first_name',
      minWidth: '140px',
      selector: (row) => `${row.first_name} ${row.last_name}`,
      cell: (row) => (
        <span className="whitespace-nowrap font-medium text-ink">
          {row.first_name} {row.last_name}
        </span>
      ),
    },
    {
      name: 'Event',
      sortable: true,
      sortField: 'event_id',
      minWidth: '150px',
      selector: (row) => eventName(row.event_id),
      cell: (row) => <span className="block truncate">{eventName(row.event_id)}</span>,
    },
    {
      name: 'Waiting since',
      sortable: true,
      sortField: 'created_at',
      width: '140px',
      selector: (row) => row.created_at,
      cell: (row) => (
        <span className="tabular whitespace-nowrap text-[13px]">{relativeTime(row.created_at)}</span>
      ),
    },
    {
      name: 'Actions',
      width: '90px',
      button: true,
      cell: (row) => (
        <IconButton icon="checkCircle" label="Review and approve" tone="brand" onClick={() => onView(row)} />
      ),
    },
  ];
}

export default function AdminApprovalsPage() {
  const {
    events,
    listRegistrations,
    version,
    error: dataError,
    isLoading: dataLoading,
    reload,
    webhooksForReference,
    listWebhookEvents,
    simulateWebhook,
  } = useAppData();
  const { toast } = useToast();

  const [selected, setSelected] = useState(null);

  // This queue is deliberately fixed to pending — that is the whole point of
  // the page. A confirmed or cancelled registration drops out on its own the
  // next time the list refreshes.
  const list = useListQuery({
    fetcher: (query) => listRegistrations({ ...query, status: 'pending' }),
    sortBy: 'created_at',
    sortDir: 'asc',
    dependencies: [version],
    pollMs: USE_MOCK ? 0 : 15000,
  });

  const status = dataLoading ? 'loading' : list.status;
  const error = list.error ?? dataError;
  const visible = list.items;

  const [resetPage, setResetPage] = useState(false);
  useEffect(() => {
    setResetPage((flag) => !flag);
  }, [list.search, list.perPage]);

  const eventName = (id) => events.find((event) => event.id === id)?.name ?? 'Unknown event';

  const columns = useMemo(
    () => buildColumns(eventName, setSelected),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events],
  );

  // The panel is open on a registration that just got confirmed elsewhere
  // (another tab, another admin) — nothing left to approve, so close it
  // instead of showing a stale "pending" record with no action that applies.
  useEffect(() => {
    if (selected && !visible.some((row) => row.id === selected.id)) setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const emptyState = (
    <EmptyState
      icon="checkCircle"
      title="Nothing waiting"
      description="Every registration has a ticketing decision. New pending registrations will show up here as they arrive."
    />
  );

  const [selectedDeliveries, setSelectedDeliveries] = useState([]);

  useEffect(() => {
    if (!selected) {
      setSelectedDeliveries([]);

      return undefined;
    }

    if (USE_MOCK) {
      setSelectedDeliveries(webhooksForReference(selected.reference));

      return undefined;
    }

    let cancelled = false;

    listWebhookEvents({ registration_reference: selected.reference, per_page: 'all' })
      .then((result) => {
        if (!cancelled) setSelectedDeliveries(result.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setSelectedDeliveries([]);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, version]);

  const runSimulation = async (mode) => {
    try {
      const result = await simulateWebhook({ reference: selected.reference, mode });
      const meta = statusMeta('webhook', result.log.status);
      if (result.log.status === 'processed') {
        toast.success('Approved', 'Signature verified, registration confirmed.');
      } else if (result.log.status === 'duplicate') {
        toast.info('Duplicate ignored', 'Same delivery id, returned 200 without changing anything.');
      } else {
        toast.error(
          `Webhook rejected: ${meta.label}`,
          result.log.error_message ?? 'The delivery was not accepted.',
        );
      }
      setSelected((current) =>
        current && result.registration?.reference === current.reference ? result.registration : current,
      );
    } catch (error) {
      toast.error('Could not send the webhook', error?.message);
    }
  };

  return (
    <div className="p-5 sm:p-8">
      <AdminPageHeader
        title="Approvals"
        description="Pending registrations waiting on a ticketing confirmation. Simulate the webhook to approve or reject one."
        actions={
          <span className="hidden items-center gap-2 text-[13px] text-meta sm:inline-flex">
            <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-amber-500" />
            {list.total} waiting
          </span>
        }
      />

      <div className="mt-6">
        <SearchInput
          id="approvals-search"
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search reference, name or email"
          label="Search pending registrations"
        />
      </div>

      <div className="mt-4 sm:mt-3">
        {status === 'error' && (
          <ErrorState title="Approvals could not be loaded" description={error?.message} onRetry={reload} />
        )}

        {status !== 'error' && (
          <>
            <DataTable
              columns={columns}
              data={visible}
              loading={status === 'loading'}
              skeletonColumns={5}
              emptyState={emptyState}
              pagination
              paginationServer
              paginationTotalRows={list.total}
              paginationPerPage={Number(list.perPage) || 10}
              paginationDefaultPage={list.page}
              paginationResetDefaultPage={resetPage}
              onChangePage={list.setPage}
              onChangeRowsPerPage={(newPerPage) => list.setPerPage(newPerPage)}
              sortServer
              defaultSortFieldId={4}
              defaultSortAsc
              onSort={(column, direction) => list.setSort(column.sortField, direction)}
              onRowClicked={setSelected}
              pointerOnHover
            />

            <div className="overflow-hidden rounded-card border border-hairline bg-white sm:hidden">
              {status === 'loading' ? (
                <div className="space-y-3 p-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-28 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                emptyState
              ) : (
                <>
                  <ul className="divide-y divide-hairline">
                    {visible.map((registration) => (
                      <li key={registration.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(registration)}
                          className={cn(
                            'w-full p-4 text-left transition-colors duration-150 active:bg-slate-50',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="tabular font-mono text-[13px] text-ink">
                              {registration.reference}
                            </span>
                            <Badge domain="registration" value={registration.status} size="sm" />
                          </div>
                          <p className="mt-1.5 font-medium text-ink">
                            {registration.first_name} {registration.last_name}
                          </p>
                          <p className="truncate text-[13px] text-meta">{registration.email}</p>
                          <p className="mt-1.5 truncate text-[13px] text-body">
                            {eventName(registration.event_id)}
                          </p>
                          <p className="tabular mt-0.5 text-[13px] text-meta">
                            Waiting {relativeTime(registration.created_at)}
                          </p>

                          <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700">
                            <Icon name="checkCircle" size={15} />
                            Review and approve
                            <Icon name="chevronRight" size={14} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Pagination {...list} label="pending registrations" />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------ approval panel */}
      <SlideOver
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.first_name} ${selected.last_name}` : ''}
        description={selected ? eventName(selected.event_id) : ''}
        width="lg"
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-slate-50 p-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-meta">Reference</p>
                <p className="tabular mt-1 font-mono text-lg text-ink">{selected.reference}</p>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton
                  variant="icon"
                  value={selected.reference}
                  onCopied={() => toast.success('Reference copied')}
                />
                <Badge domain="registration" value={selected.status} />
              </div>
            </div>

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-meta">Registration</h3>
              <dl className="mt-1 divide-y divide-hairline">
                <DetailRow label="Email">{selected.email}</DetailRow>
                <DetailRow label="Phone" mono>
                  {selected.phone}
                </DetailRow>
                <DetailRow label="Event">{eventName(selected.event_id)}</DetailRow>
                <DetailRow label="Registered">{formatDate(selected.created_at)}</DetailRow>
              </dl>
            </section>

            <WebhookSimulator
              reference={selected.reference}
              attempts={selectedDeliveries}
              onSimulate={runSimulation}
            />

            <section>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-meta">
                  Webhook deliveries
                </h3>
                <span className="tabular text-[11px] text-meta">{selectedDeliveries.length}</span>
              </div>

              {selectedDeliveries.length === 0 ? (
                <p className="mt-3 flex items-center gap-2 rounded-card border border-dashed border-hairline p-4 text-[13px] text-meta">
                  <Icon name="activity" size={15} />
                  No webhook deliveries recorded for this reference yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {selectedDeliveries.map((delivery) => (
                    <li key={delivery.id} className="rounded-card border border-hairline p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge domain="webhook" value={delivery.status} size="sm" />
                          <span className="text-[13px] text-body">{delivery.event_type}</span>
                        </div>
                        <time className="tabular text-[11px] text-meta">{relativeTime(delivery.received_at)}</time>
                      </div>
                      <p className="mt-2 truncate font-mono text-[11px] text-meta">{delivery.delivery_id}</p>
                      {delivery.error_message && (
                        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                          {delivery.error_message}
                        </p>
                      )}
                      <JsonBlock className="mt-3" payload={delivery.payload} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
