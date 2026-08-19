import { useEffect, useMemo, useState } from 'react';
import { USE_MOCK } from '../../api/index.js';
import { cn } from '../../lib/cn.js';
import { useAppData } from '../../state/AppDataContext.jsx';
import { useNavigation, VIEWS } from '../../state/NavigationContext.jsx';
import { useToast } from '../../state/ToastContext.jsx';
import { formatDate, formatDateTime } from '../../lib/format.js';
import { statusMeta, statusValues } from '../../lib/status.js';
import { AdminPageHeader } from '../../components/admin/AdminShell.jsx';
import Badge from '../../components/ui/Badge.jsx';
import CopyButton from '../../components/ui/CopyButton.jsx';
import Icon from '../../components/icons/Icon.jsx';
import JsonBlock from '../../components/JsonBlock.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import SlideOver from '../../components/ui/SlideOver.jsx';
import SelectMenu from '../../components/ui/SelectMenu.jsx';
import { Banner, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import useListQuery from '../../hooks/useListQuery.js';
import useNewArrivals from '../../hooks/useNewArrivals.js';
import IconButton from '../../components/ui/IconButton.jsx';
import { DetailRow } from '../../components/ui/DetailRow.jsx';

/** Column definitions for the datatable. `eventName` resolves the FK to a label. */
function buildColumns(eventName, onView, isNew) {
  return [
    {
      name: 'Reference',
      sortable: true,
      sortField: 'reference',
      width: '130px',
      selector: (row) => row.reference,
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          <span className="tabular font-mono text-[13px] text-ink">{row.reference}</span>
          {isNew(row.id) && (
            <span className="shrink-0 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              New
            </span>
          )}
        </span>
      ),
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
      name: 'Contact',
      sortable: true,
      sortField: 'email',
      minWidth: '190px',
      selector: (row) => row.email,
      cell: (row) => (
        <div className="min-w-0 py-1">
          <p className="truncate">{row.email}</p>
          <p className="tabular truncate text-[13px] text-meta">{row.phone}</p>
        </div>
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
      // Ticket ID folded in here rather than its own column — it only ever
      // exists alongside a confirmed status, so pairing them saves a column
      // without hiding anything.
      name: 'Status',
      sortable: true,
      sortField: 'status',
      width: '150px',
      selector: (row) => row.status,
      cell: (row) => (
        <div className="py-1">
          <Badge domain="registration" value={row.status} size="sm" />
          {row.ticket_id && (
            <p className="tabular mt-1 font-mono text-[12px] text-meta">{row.ticket_id}</p>
          )}
        </div>
      ),
    },
    {
      name: 'Registered',
      sortable: true,
      sortField: 'created_at',
      width: '120px',
      selector: (row) => row.created_at,
      cell: (row) => (
        <span className="tabular whitespace-nowrap text-[13px]">{formatDate(row.created_at)}</span>
      ),
    },
    {
      // The row is clickable, but only this tells you so.
      name: 'Actions',
      width: '80px',
      button: true,
      cell: (row) => (
        <IconButton icon="eye" label="View full record" tone="brand" onClick={() => onView(row)} />
      ),
    },
  ];
}

/** Defined outside the component so its identity is stable across renders. */
const isPending = (registration) => registration.status === 'pending';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...statusValues('registration').map((value) => ({
    value,
    label: statusMeta('registration', value).label,
  })),
];

export default function AdminRegistrationsPage() {
  const {
    registrations,
    events,
    listRegistrations,
    version,
    error: dataError,
    isLoading: dataLoading,
    reload,
    webhooksForReference,
    listWebhookEvents,
  } = useAppData();
  const { toast } = useToast();
  const { eventId, navigate } = useNavigation();

  const [selected, setSelected] = useState(null);

  // Arriving from an event's "View registrations" lands here already narrowed
  // to that event, rather than dumping the whole list and making you find it.
  const list = useListQuery({
    fetcher: (query) => listRegistrations(query),
    initialFilters: { status: 'all', event_id: eventId ? String(eventId) : 'all' },
    sortBy: 'created_at',
    sortDir: 'desc',
    dependencies: [version],
    // Registrations arrive while this screen is open, so it refreshes itself.
    pollMs: USE_MOCK ? 0 : 15000,
  });

  /**
   * Rows that arrived since the last refresh, flagged briefly.
   *
   * Only while pending: that is the state that may still need someone to act.
   * Once a webhook confirms or cancels it the outcome is settled, the highlight
   * is dropped on the next refresh, and attention is left for the rows that
   * still need it.
   */
  const arrivals = useNewArrivals(list.items, { shouldHighlight: isPending });

  const status = dataLoading ? 'loading' : list.status;
  const error = list.error ?? dataError;
  const visible = list.items;

  // Flips whenever the query changes underneath the table, so the datatable's
  // own pagination snaps back to page 1 instead of showing a stale page number.
  const [resetPage, setResetPage] = useState(false);
  useEffect(() => {
    setResetPage((flag) => !flag);
  }, [list.search, list.filters, list.perPage]);

  const eventName = (id) => events.find((event) => event.id === id)?.name ?? 'Unknown event';

  const eventOptions = useMemo(
    () => [
      { value: 'all', label: 'All events' },
      ...events.map((event) => ({
        value: String(event.id),
        label: event.name,
        description: formatDate(event.event_date),
      })),
    ],
    [events],
  );

  // Navigating in again from a different event re-narrows the filter.
  useEffect(() => {
    list.setFilter('event_id', eventId ? String(eventId) : 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const clearFilters = () => list.reset();

  const columns = useMemo(
    () => buildColumns(eventName, setSelected, (id) => arrivals.isNew(id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, arrivals.newIds],
  );

  /**
   * The flash for a row that has just arrived. Expressed as a style rather than
   * a class because react-data-table-component owns the row element, and it
   * takes conditional styles, not conditional classNames.
   */
  const newRowStyles = useMemo(
    () => [
      {
        when: (row) => arrivals.isNew(row.id),
        style: {
          animation: 'arrive-flash 1.1s ease-in-out 3',
          boxShadow: 'inset 3px 0 0 0 #0FB5C9',
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arrivals.newIds],
  );

  const emptyState = (
    <EmptyState
      icon="inbox"
      title={registrations.length === 0 ? 'No registrations yet' : 'Nothing matches those filters'}
      description={
        registrations.length === 0
          ? 'Registrations appear here the moment someone signs up for a published event.'
          : 'Try widening the search or clearing the event and status filters.'
      }
      action={registrations.length === 0 ? undefined : 'Clear filters'}
      actionIcon="refresh"
      onAction={clearFilters}
    />
  );

  /**
   * Deliveries for the open record.
   *
   * In design mode they come from the in-memory data. Against the real API
   * they have to be fetched: the public bundle never loads the webhook log, and
   * it would be wrong to — it is admin data and it is paginated.
   */
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
    // `version` bumps after a simulated delivery, which is what refreshes this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, version]);

  return (
    <div className="p-5 sm:p-8">
      <AdminPageHeader
        title="Registrations"
        description="Every registration across all events, with the webhook deliveries that resolved it."
        actions={
          !USE_MOCK && (
            <span className="hidden items-center gap-2 text-[13px] text-meta sm:inline-flex">
              <span className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-emerald-500" />
              {arrivals.count > 0
                ? `${arrivals.count} new`
                : 'Live — newest first'}
            </span>
          )
        }
      />

      {/* Two filters share a row on mobile; search keeps the full width above them. */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_13rem]">
        <SearchInput
          id="registrations-search"
          className="col-span-2 lg:col-span-1"
          value={list.search}
          onChange={list.setSearch}
          placeholder="Search reference, name or email"
          label="Search registrations"
        />
        <SelectMenu
          id="registrations-event"
          label="Filter by event"
          value={list.filters.event_id}
          onChange={(value) => list.setFilter('event_id', value)}
          searchPlaceholder="Search events…"
          options={eventOptions}
        />
        <SelectMenu
          id="registrations-status"
          label="Filter by status"
          value={list.filters.status}
          onChange={(value) => list.setFilter('status', value)}
          searchPlaceholder="Search statuses…"
          options={STATUS_OPTIONS}
        />
      </div>

      <p className="mt-4 hidden text-[13px] text-meta sm:block">
        Showing <span className="tabular font-medium text-body">{list.total}</span> of{' '}
        <span className="tabular">{registrations.length}</span> registrations
      </p>

      <div className="mt-4 sm:mt-3">
        {status === 'error' && (
          <ErrorState title="Registrations could not be loaded" description={error?.message} onRetry={reload} />
        )}

        {status !== 'error' && (
          <>
            {/* The server has already sorted and paged; the table only draws. */}
            <DataTable
              columns={columns}
              data={visible}
              loading={status === 'loading'}
              skeletonColumns={8}
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
              // 6 = the "Registered" column. Without this the header shows no
              // sort arrow, so a list that IS newest-first looks unsorted.
              defaultSortFieldId={6}
              defaultSortAsc={false}
              onSort={(column, direction) => list.setSort(column.sortField, direction)}
              onRowClicked={setSelected}
              pointerOnHover
              conditionalRowStyles={newRowStyles}
            />

            {/* Mobile: cards and pagination inside one bordered panel. */}
            <div className="overflow-hidden rounded-card border border-hairline bg-white sm:hidden">
              {status === 'loading' ? (
                <div className="space-y-3 p-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-32 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                emptyState
              ) : (
                <>
                  <ul className="divide-y divide-hairline">
                    {visible.map((registration) => (
                      <li key={registration.id} className="relative">
                        {arrivals.isNew(registration.id) && (
                          <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-[3px] bg-brand-500" />
                        )}
                        <button
                          type="button"
                          onClick={() => setSelected(registration)}
                          className={cn(
                            'w-full p-4 text-left transition-colors duration-150 active:bg-slate-50',
                            arrivals.isNew(registration.id) && 'animate-arrive-flash',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="inline-flex items-center gap-2">
                              <span className="tabular font-mono text-[13px] text-ink">
                                {registration.reference}
                              </span>
                              {arrivals.isNew(registration.id) && (
                                <span className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                  New
                                </span>
                              )}
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
                            Registered {formatDate(registration.created_at)}
                          </p>

                          <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700">
                            <Icon name="eye" size={15} />
                            View full record
                            <Icon name="chevronRight" size={14} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Pagination {...list} label="registrations" />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------ detail panel */}
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

            {selected.status === 'pending' && (
              <Banner tone="warning" title="Waiting on the ticketing system">
                <p>
                  This registration has not been confirmed yet.{' '}
                  <button
                    type="button"
                    onClick={() => navigate(VIEWS.adminApprovals)}
                    className="font-medium text-amber-900 underline underline-offset-2"
                  >
                    Go to Approvals
                  </button>{' '}
                  to confirm or reject it.
                </p>
              </Banner>
            )}

            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-meta">Registration</h3>
              <dl className="mt-1 divide-y divide-hairline">
                <DetailRow label="Email">{selected.email}</DetailRow>
                <DetailRow label="Phone" mono>
                  {selected.phone}
                </DetailRow>
                <DetailRow label="Event">{eventName(selected.event_id)}</DetailRow>
                <DetailRow label="Registered">{formatDateTime(selected.created_at)}</DetailRow>
                <DetailRow label="Ticket ID" mono>
                  {selected.ticket_id ?? '—'}
                </DetailRow>
                <DetailRow label="Confirmed">
                  {selected.confirmed_at ? formatDateTime(selected.confirmed_at) : '—'}
                </DetailRow>
              </dl>
            </section>

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
                        <time className="tabular text-[11px] text-meta">
                          {formatDateTime(delivery.received_at)}
                        </time>
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
