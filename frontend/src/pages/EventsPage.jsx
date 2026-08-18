import { useMemo, useState } from 'react';
import { useAppData } from '../state/AppDataContext.jsx';
import { useNavigation } from '../state/NavigationContext.jsx';
import { eventFacts } from '../lib/events.js';
import EventCard from '../components/EventCard.jsx';
import FilterChip from '../components/ui/FilterChip.jsx';
import SearchInput from '../components/ui/SearchInput.jsx';
import { EmptyState, ErrorState, EventCardSkeleton } from '../components/ui/States.jsx';

const FILTERS = [
  { id: 'all', label: 'All events', match: () => true },
  { id: 'upcoming', label: 'Upcoming', match: (facts, event) => event.status === 'published' && !facts.past },
  { id: 'almost_full', label: 'Almost full', match: (facts) => facts.almostFull && facts.registerable },
];

export default function EventsPage() {
  const { events, status, error, reload } = useAppData();
  const { openEvent } = useNavigation();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return events;
    return events.filter((event) =>
      [event.name, event.description, event.venue]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle)),
    );
  }, [events, query]);

  // Counts reflect the search too, so a chip never promises results that the
  // search has already filtered away.
  const counts = useMemo(() => {
    const result = {};
    for (const item of FILTERS) {
      result[item.id] = searched.filter((event) => item.match(eventFacts(event), event)).length;
    }
    return result;
  }, [searched]);

  const visible = useMemo(() => {
    const active = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
    return searched
      .filter((event) => active.match(eventFacts(event), event))
      .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
  }, [searched, filter]);

  return (
    <div className="mx-auto max-w-8xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="max-w-2xl">
        <h1 className="font-display text-display-md font-bold text-ink sm:text-display-lg">
          What&rsquo;s on
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-body">
          Talks, workshops and evenings worth clearing your calendar for. Pick one, register in under a minute,
          and track your ticket with the reference we issue.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter events">
          {FILTERS.map((item) => (
            <FilterChip
              key={item.id}
              active={filter === item.id}
              count={counts[item.id]}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </FilterChip>
          ))}
        </div>

        <SearchInput
          id="events-search"
          className="lg:w-80"
          value={query}
          onChange={setQuery}
          placeholder="Search events, venues or topics"
          label="Search events"
        />
      </div>

      <div className="mt-6">
        {status === 'loading' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <EventCardSkeleton key={index} />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title="We could not load the events"
            description={error?.message ?? 'The events list is temporarily unavailable.'}
            onRetry={reload}
          />
        )}

        {status === 'ready' && visible.length === 0 && (
          <div className="card">
            <EmptyState
              icon="calendar"
              title={
                events.length === 0
                  ? 'No events published yet'
                  : query.trim()
                    ? `Nothing matches "${query.trim()}"`
                    : 'Nothing matches this filter'
              }
              description={
                events.length === 0
                  ? 'New events appear here as soon as they are published. Check back shortly.'
                  : 'Try a different search term or filter to see the rest of the programme.'
              }
              action={events.length === 0 ? undefined : 'Show all events'}
              onAction={() => {
                setFilter('all');
                setQuery('');
              }}
            />
          </div>
        )}

        {status === 'ready' && visible.length > 0 && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map((event) => (
              <EventCard key={event.id} event={event} onOpen={openEvent} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
