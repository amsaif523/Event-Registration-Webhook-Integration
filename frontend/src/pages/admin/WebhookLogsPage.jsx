import { useEffect, useMemo, useState } from 'react';
import { USE_MOCK } from '../../api/index.js';
import { useAppData } from '../../state/AppDataContext.jsx';
import { useToast } from '../../state/ToastContext.jsx';
import { cn } from '../../lib/cn.js';
import { formatDateTime, formatTime, relativeTime, truncateMiddle } from '../../lib/format.js';
import { statusMeta, statusValues, TONE_CLASSES } from '../../lib/status.js';
import { AdminPageHeader } from '../../components/admin/AdminShell.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import CopyButton from '../../components/ui/CopyButton.jsx';
import SelectMenu from '../../components/ui/SelectMenu.jsx';
import Icon from '../../components/icons/Icon.jsx';
import JsonBlock from '../../components/JsonBlock.jsx';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import DataTable from '../../components/ui/DataTable.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import useListQuery from '../../hooks/useListQuery.js';

/**
 * Expanded row: the raw payload exactly as it arrived, plus the rejection
 * reason when there is one. Being able to show a reviewer why a signature
 * failed is the whole point of keeping the rejected deliveries.
 */
function PayloadPanel({ data: webhook }) {
  const meta = statusMeta('webhook', webhook.status);
  const tone = TONE_CLASSES[meta.tone] ?? TONE_CLASSES.slate;

  return (
    <div className="border-l-2 px-5 py-4 sm:px-6" style={{ borderLeftColor: 'transparent' }}>
      {webhook.error_message && (
        <div className="mb-3 flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2.5">
          <Icon name="alertCircle" size={15} className="mt-0.5 shrink-0 text-red-600" />
          <p className="text-[13px] text-red-700">{webhook.error_message}</p>
        </div>
      )}
      <dl className="mb-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
        <div>
          <dt className="text-meta">Received</dt>
          <dd className="tabular text-ink">{formatDateTime(webhook.received_at)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-meta">Delivery ID</dt>
          <dd className="break-all font-mono text-xs text-ink">{webhook.delivery_id}</dd>
        </div>
        <div>
          <dt className="text-meta">Outcome</dt>
          <dd className={cn('font-medium', tone.text)}>{meta.label}</dd>
        </div>
      </dl>
      <JsonBlock payload={webhook.payload} />
    </div>
  );
}

/** Column definitions for the datatable. */
function buildColumns(onCopied) {
  return [
    {
      name: 'Received',
      sortable: true,
      sortField: 'received_at',
      width: '160px',
      selector: (row) => row.received_at,
      cell: (row) => (
        <div className="py-1">
          <p className="tabular whitespace-nowrap text-sm text-ink">{formatTime(row.received_at)}</p>
          <p className="tabular text-[13px] text-meta">{relativeTime(row.received_at)}</p>
        </div>
      ),
    },
    {
      name: 'Event type',
      sortable: true,
      sortField: 'event_type',
      minWidth: '160px',
      selector: (row) => row.event_type,
      cell: (row) => <span className="font-mono text-[13px] text-body">{row.event_type}</span>,
    },
    {
      name: 'Delivery ID',
      sortable: true,
      sortField: 'delivery_id',
      minWidth: '200px',
      selector: (row) => row.delivery_id,
      cell: (row) => (
        <span className="inline-flex items-center gap-1">
          <span className="font-mono text-[13px] text-body" title={row.delivery_id}>
            {truncateMiddle(row.delivery_id, 12, 4)}
          </span>
          <CopyButton
            variant="icon"
            value={row.delivery_id}
            label="Copy delivery id"
            onCopied={onCopied}
          />
        </span>
      ),
    },
    {
      name: 'Reference',
      sortable: true,
      sortField: 'registration_reference',
      width: '160px',
      selector: (row) => row.registration_reference ?? '',
      cell: (row) => (
        <span className="tabular font-mono text-[13px] text-ink">
          {row.registration_reference ?? '—'}
        </span>
      ),
    },
    {
      name: 'Status',
      sortable: true,
      sortField: 'status',
      width: '160px',
      selector: (row) => row.status,
      cell: (row) => <Badge domain="webhook" value={row.status} size="sm" />,
    },
  ];
}

/**
 * The audit trail. Every inbound delivery is here, including the ones that were
 * rejected, which is the point: being able to show a reviewer exactly why a
 * signature failed is worth more than only showing the deliveries that worked.
 */
export default function WebhookLogsPage() {
  const {
    webhook_events: webhooks,
    listWebhookEvents,
    version,
    isLoading: dataLoading,
    error: dataError,
    reload,
  } = useAppData();
  const { toast } = useToast();

  const [expanded, setExpanded] = useState(null);

  const list = useListQuery({
    fetcher: (query) => listWebhookEvents(query),
    initialFilters: { status: 'all' },
    sortBy: 'received_at',
    sortDir: 'desc',
    dependencies: [version],
  });

  const filter = list.filters.status;
  const setFilter = (value) => list.setFilter('status', value);
  const status = dataLoading ? 'loading' : list.status;
  const error = list.error ?? dataError;
  const visible = list.items;

  // Flips whenever the query changes underneath the table, so the datatable's
  // own pagination snaps back to page 1 instead of showing a stale page number.
  const [resetPage, setResetPage] = useState(false);
  useEffect(() => {
    setResetPage((flag) => !flag);
  }, [list.search, list.filters, list.perPage]);

  /**
   * Counts for the filter options.
   *
   * They come from the server, because the client only ever holds one page and
   * cannot count deliveries it has never been sent. In design mode there is no
   * server, so it counts the in-memory data instead.
   */
  const statusOptions = useMemo(() => {
    const counts = USE_MOCK
      ? webhooks.reduce(
          (acc, webhook) => ({ ...acc, [webhook.status]: (acc[webhook.status] ?? 0) + 1, all: acc.all + 1 }),
          { all: 0 },
        )
      : (list.statusCounts ?? {});

    const describe = (n) => `${n ?? 0} ${(n ?? 0) === 1 ? 'delivery' : 'deliveries'}`;

    return [
      { value: 'all', label: 'All deliveries', description: `${counts.all ?? 0} total` },
      ...statusValues('webhook').map((value) => ({
        value,
        label: statusMeta('webhook', value).label,
        description: describe(counts[value]),
      })),
    ];
  }, [webhooks, list.statusCounts]);

  const toggle = (id) => setExpanded((current) => (current === id ? null : id));

  const columns = useMemo(
    () => buildColumns(() => toast.success('Delivery ID copied')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const emptyState = (
    <EmptyState
      icon="activity"
      title={
        webhooks.length === 0
          ? 'No deliveries recorded'
          : `No ${statusMeta('webhook', filter).label.toLowerCase()} deliveries`
      }
      description={
        webhooks.length === 0
          ? 'Inbound webhooks are logged here the moment they arrive, whether we accept them or not.'
          : 'Nothing in the log has that status right now.'
      }
      action={webhooks.length === 0 ? undefined : 'Show all deliveries'}
      onAction={() => setFilter('all')}
    />
  );

  return (
    <div className="p-5 sm:p-8">
      <AdminPageHeader
        title="Webhook logs"
        description="Every delivery to /api/webhooks/ticketing, verified or rejected, stored with its raw payload."
        actions={
          <Button variant="secondary" icon="refresh" onClick={reload}>
            Refresh
          </Button>
        }
      />

      {/* A dropdown, like every other filter in the admin. Chips read as status
          badges, which is what the Status column already uses — two different
          meanings for the same shape. */}
      <div className="mt-5 sm:mt-6 sm:flex sm:items-center sm:gap-3">
        <div className="sm:w-64">
          <SelectMenu
            id="webhooks-status"
            label="Filter by delivery status"
            value={filter}
            onChange={setFilter}
            searchPlaceholder="Search statuses…"
            options={statusOptions}
          />
        </div>
      </div>

      <div className="mt-5">
        {status === 'error' && (
          <ErrorState title="The webhook log could not be loaded" description={error?.message} onRetry={reload} />
        )}

        {status !== 'error' && (
          <>
            {/* The server has already sorted and paged; the table only draws. */}
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
              onSort={(column, direction) => list.setSort(column.sortField, direction)}
              expandableRows
              expandableRowsComponent={PayloadPanel}
              expandOnRowClicked
              pointerOnHover
            />

            {/* Mobile: cards and pagination inside one bordered panel. */}
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
                    {visible.map((webhook) => {
                      const open = expanded === webhook.id;
                      return (
                        <li key={webhook.id} className="p-4">
                          <button
                            type="button"
                            onClick={() => toggle(webhook.id)}
                            aria-expanded={open}
                            className="w-full text-left"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-mono text-[13px] text-ink">{webhook.event_type}</p>
                                <p className="tabular mt-0.5 text-[13px] text-meta">
                                  {formatDateTime(webhook.received_at)}
                                </p>
                              </div>
                              <Badge domain="webhook" value={webhook.status} size="sm" />
                            </div>

                            <p className="tabular mt-2 font-mono text-[13px] text-body">
                              {webhook.registration_reference ?? 'No reference'}
                            </p>
                            <p className="mt-0.5 break-all font-mono text-[11px] text-meta">
                              {webhook.delivery_id}
                            </p>

                            <span className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-brand-700">
                              {open ? 'Hide payload' : 'Show payload'}
                              <Icon
                                name="chevronRight"
                                size={14}
                                className={cn('transition-transform duration-200', open && 'rotate-90')}
                              />
                            </span>
                          </button>

                          {open && (
                            <div className="mt-3">
                              {webhook.error_message && (
                                <p className="mb-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
                                  {webhook.error_message}
                                </p>
                              )}
                              <JsonBlock payload={webhook.payload} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <Pagination {...list} label="deliveries" />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
