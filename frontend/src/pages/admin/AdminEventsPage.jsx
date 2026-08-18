import { useMemo, useState } from 'react';
import { useAppData } from '../../state/AppDataContext.jsx';
import { useNavigation } from '../../state/NavigationContext.jsx';
import { useToast } from '../../state/ToastContext.jsx';
import { eventFacts } from '../../lib/events.js';
import { formatDate, formatTime } from '../../lib/format.js';
import { statusMeta, statusValues } from '../../lib/status.js';
import { AdminPageHeader } from '../../components/admin/AdminShell.jsx';
import EventSlideOver from '../../components/admin/EventSlideOver.jsx';
import Badge from '../../components/ui/Badge.jsx';
import Button from '../../components/ui/Button.jsx';
import { CapacityMini } from '../../components/ui/CapacityBar.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import SelectMenu from '../../components/ui/SelectMenu.jsx';
import IconButton, { ActionButton } from '../../components/ui/IconButton.jsx';
import Pagination from '../../components/ui/Pagination.jsx';
import useListQuery from '../../hooks/useListQuery.js';
import { EmptyState, ErrorState } from '../../components/ui/States.jsx';
import DataTable from '../../components/ui/DataTable.jsx';

/**
 * Row actions, shown as two visible buttons rather than hidden behind a
 * three-dot menu. The menu saved 40px of width and cost every user a guess.
 */
function RowActions({ onEdit, onViewRegistrations }) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <IconButton icon="edit" label="Edit event" tone="brand" onClick={onEdit} />
      <IconButton icon="list" label="View registrations" onClick={onViewRegistrations} />
    </div>
  );
}

/** Column definitions for the datatable. Sortable on the fields worth sorting. */
function buildColumns({ onEdit, onViewRegistrations }) {
  return [
    {
      name: 'Event',
      sortable: true,
      sortField: 'name',
      grow: 2,
      minWidth: '240px',
      selector: (row) => row.name,
      cell: (row) => <span className="truncate font-medium text-ink">{row.name}</span>,
    },
    {
      name: 'Date',
      sortable: true,
      sortField: 'event_date',
      width: '140px',
      selector: (row) => row.event_date,
      cell: (row) => (
        <div className="py-1">
          <p className="tabular whitespace-nowrap text-ink">{formatDate(row.event_date)}</p>
          <p className="tabular text-[13px] text-meta">{formatTime(row.event_date)}</p>
        </div>
      ),
    },
    {
      name: 'Venue',
      sortable: true,
      sortField: 'venue',
      minWidth: '160px',
      selector: (row) => row.venue,
      cell: (row) => <span className="block truncate">{row.venue}</span>,
    },
    {
      name: 'Capacity',
      sortable: true,
      sortField: 'seats_taken',
      width: '180px',
      // Sort by how full the event is, which is the useful ordering here.
      selector: (row) => eventFacts(row).fillPercent,
      cell: (row) => {
        const facts = eventFacts(row);
        return <CapacityMini taken={facts.taken} capacity={facts.capacity} />;
      },
    },
    {
      name: 'Status',
      sortable: true,
      sortField: 'status',
      width: '130px',
      selector: (row) => row.status,
      cell: (row) => <Badge domain="event" value={row.status} size="sm" />,
    },
    {
      name: 'Actions',
      width: '110px',
      allowOverflow: true,
      button: true,
      cell: (row) => (
        <RowActions onEdit={() => onEdit(row)} onViewRegistrations={() => onViewRegistrations(row)} />
      ),
    },
  ];
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...statusValues('event').map((value) => ({ value, label: statusMeta('event', value).label })),
];

export default function AdminEventsPage() {
  const {
    events,
    listEvents,
    version,
    isLoading: dataLoading,
    error: dataError,
    reload,
    saveEvent,
  } = useAppData();
  const { openRegistrationsFor } = useNavigation();
  const { toast } = useToast();

  const [panel, setPanel] = useState({ open: false, event: null });

  // Search, filter, sort and pagination all go to the data layer as one query;
  // nothing is filtered out of an array this component is holding.
  const list = useListQuery({
    fetcher: listEvents,
    initialFilters: { status: 'all' },
    sortBy: 'event_date',
    sortDir: 'desc',
    dependencies: [version],
  });

  // Treat the initial data load as part of the list's own loading state,
  // otherwise the empty state flashes before the first query resolves.
  const status = dataLoading ? 'loading' : list.status;
  const error = list.error ?? dataError;
  const visible = list.items;

  const save = async (input) => {
    const saved = await saveEvent(input);
    toast.success(input.id ? 'Event updated' : 'Event created', saved.name);
    return saved;
  };

  const openRegistrations = (event) => openRegistrationsFor(event?.id ?? null);

  const columns = useMemo(
    () =>
      buildColumns({
        onEdit: (event) => setPanel({ open: true, event }),
        onViewRegistrations: (event) => openRegistrationsFor(event.id),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const emptyState = (
    <EmptyState
      icon="calendar"
      title={events.length === 0 ? 'No events yet' : 'No events match those filters'}
      description={
        events.length === 0
          ? 'Create your first event to start taking registrations.'
          : 'Clear the search or pick a different status.'
      }
      action={events.length === 0 ? 'Create event' : 'Clear filters'}
      actionIcon={events.length === 0 ? 'plus' : 'refresh'}
      onAction={() => {
        if (events.length === 0) setPanel({ open: true, event: null });
        else list.reset();
      }}
    />
  );

  return (
    <div className="p-5 sm:p-8">
      <AdminPageHeader
        title="Events"
        description="Create, publish and adjust events. Draft events stay hidden from the public list."
      />

      {/* Search and the primary action share one line at every size; the filter
          sits beneath on mobile rather than squeezing three controls into a row. */}
      <div className="mt-5 space-y-3 sm:mt-6 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
        <div className="flex items-center gap-2 sm:contents">
          <SearchInput
            id="events-search"
            className="min-w-0 flex-1 sm:max-w-xs"
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search events"
            label="Search events"
          />
          <Button
            icon="plus"
            className="shrink-0 sm:order-last"
            onClick={() => setPanel({ open: true, event: null })}
          >
            <span className="hidden sm:inline">Create event</span>
            <span className="sr-only sm:hidden">Create event</span>
          </Button>
        </div>

        <div className="sm:w-52">
          <SelectMenu
            id="events-status"
            label="Filter by status"
            value={list.filters.status}
            onChange={(value) => list.setFilter('status', value)}
            searchPlaceholder="Search statuses…"
            options={STATUS_OPTIONS}
          />
        </div>
      </div>

      <div className="mt-5">
        {status === 'error' && (
          <ErrorState
            title="Events could not be loaded"
            description={error?.message}
            onRetry={reload}
          />
        )}

        {status !== 'error' && (
          <>
            {/* The server has already sorted and paged; the table only draws. */}
            <DataTable
              columns={columns}
              data={visible}
              loading={status === 'loading'}
              skeletonColumns={6}
              emptyState={emptyState}
              pagination={false}
              sortServer
              onSort={(column, direction) => list.setSort(column.sortField, direction)}
              footer={<Pagination {...list} label="events" />}
            />

            {/* Mobile: one bordered panel holding the cards and their pagination,
                so the list reads as a single object instead of loose fragments. */}
            <div className="overflow-hidden rounded-card border border-hairline bg-white sm:hidden">
              {status === 'loading' ? (
                <div className="space-y-3 p-3">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-36 animate-pulse rounded bg-slate-100" />
                  ))}
                </div>
              ) : visible.length === 0 ? (
                emptyState
              ) : (
                <>
                  <ul className="divide-y divide-hairline">
                    {visible.map((event) => {
                      const facts = eventFacts(event);
                      return (
                        <li key={event.id} className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 flex-1 font-medium leading-snug text-ink">{event.name}</p>
                            <Badge domain="event" value={event.status} size="sm" />
                          </div>
                          <p className="tabular mt-1.5 text-[13px] text-meta">
                            {formatDate(event.event_date)} · {formatTime(event.event_date)}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] text-meta">{event.venue}</p>
                          <div className="mt-3">
                            <CapacityMini taken={facts.taken} capacity={facts.capacity} />
                          </div>

                          {/* Spelled out, because a tappable card with no affordance
                              is indistinguishable from a static one. */}
                          <div className="mt-3.5 flex gap-2">
                            <ActionButton
                              icon="edit"
                              tone="brand"
                              onClick={() => setPanel({ open: true, event })}
                            >
                              Edit
                            </ActionButton>
                            <ActionButton icon="list" onClick={() => openRegistrations(event)}>
                              Registrations
                            </ActionButton>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <Pagination {...list} label="events" />
                </>
              )}
            </div>
          </>
        )}
      </div>

      <EventSlideOver
        open={panel.open}
        event={panel.event}
        onClose={() => setPanel({ open: false, event: null })}
        onSave={save}
      />
    </div>
  );
}
