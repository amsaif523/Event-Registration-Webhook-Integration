# Eventide — frontend

React 18 + Vite + Tailwind UI for the Event Registration & Webhook Integration app.
This directory is the frontend only; the PHP backend lands in `../backend` in a later phase.

## Running it

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

`npm run build` produces `dist/`, `npm run preview` serves that build.

No backend is required right now. With `VITE_USE_MOCK=true` (the default) the app reads
`public/data/mock.json` and every screen, including the failure paths, is fully interactive.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `VITE_API_BASE_URL` | empty | Base for API calls. Empty means same-origin `/api/*`, which the Vite dev proxy forwards to Apache. |
| `VITE_USE_MOCK` | `true` | `true` reads `public/data/mock.json`. `false` calls the real `POST /api/*` endpoints. |

Navigation state (current screen and the reference being tracked) is kept in `sessionStorage` so a
refresh does not dead-end. In design mode a reload also resets the data to `mock.json`, so a
registration created in the previous session no longer exists — the tracking page drops that
dangling reference silently rather than reopening with a warning about something nobody did.

## All content comes from one file

`public/data/mock.json` is the single source of every event, registration, webhook log entry and
counter in the UI. It is fetched **once** at the app root (`src/state/AppDataContext.jsx`) and
handed down through context. No component contains content of its own.

Edit that file, reload, and the whole UI changes. That is the acceptance test.

Its shape matches what the API will return, so wiring the real backend in Phase 5 means flipping
`VITE_USE_MOCK` to `false` — `src/api/client.js` already speaks the real endpoints. No component
changes.

Counters (`stats`) are recomputed from the arrays rather than trusted from the file, so they stay
correct after a registration or a simulated webhook. Every screen renders a designed empty state
if an array is empty rather than collapsing.

## No identifiers in URLs

Per `CLAUDE.md` §6 and §11 the backend puts every id in the request body, and the frontend holds
to the same rule. There is no router: the whole app lives at `/` and navigation is state-driven
(`src/state/NavigationContext.jsx`). There are no `/events/12` or `/status/EVT-…` routes, so a
registration reference never reaches the address bar, browser history, a bookmark, or a `Referer`
header sent to a third-party asset.

The selected event id lives in React state. The reference is mirrored into `sessionStorage`, so
refreshing on the status screen recovers instead of dead-ending.

## Screens

**Public** — events list (filter chips, muted-but-visible cards for full/draft/cancelled/past),
event detail with a sticky registration form, registration success with the reference as the hero
of the screen, and a status page with the three-step timeline.

**Admin** (token gate) — dashboard, events management with a create/edit slide-over, registrations
with a detail slide-over showing related webhook deliveries, and the webhook log with inline
expandable raw payloads.

Admin chrome (sidebar, top bar, footer) is fixed; only the content column scrolls. The signed-in
user appears as an initials avatar with a sign-out button in both the sidebar and the top bar.

On mobile the sidebar becomes a bottom tab bar rather than a drawer behind a hamburger: sections
stay one thumb-tap away and always visible, which is how a phone app behaves. Row actions are
visible buttons — edit and view-registrations on events, view-record on registrations — rather
than a three-dot menu, on the grounds that a menu saves 40px of width and costs every user a
guess. On mobile those become full-width labelled buttons inside each card.

Each mobile list is one bordered panel containing the rows and their pagination, rather than a
stack of free-floating cards, and it paginates like the desktop table does — 10/25/50 per page
plus a "Show all", since on a phone scrolling a short list often beats paging through it
(`src/components/ui/Pagination.jsx`).

Universal states are built for every screen: skeleton loading that matches the real layout, empty
states, inline error-and-retry, toasts, and a 404.

### The webhook simulator

A dashed-border "Simulate ticketing system" panel with three buttons: send a valid webhook, send
one with an invalid signature, send a duplicate. A reviewer opening a public URL will not run curl,
so without this, step four of the flow is invisible.

**It lives in the admin panel, not the public site** — open Registrations, click a record, and it
sits above that record's webhook deliveries. Someone who has just registered should see their
status and nothing else; a tool for provoking webhooks is staff equipment. Putting it beside the
record it acts on also means you watch the status and the delivery log change together.

It calls `POST /api/dev/simulate-webhook`, which signs the payload **server-side** and delivers it
to the real webhook endpoint. `WEBHOOK_SECRET` never reaches the browser. The failure buttons are
deliberate: watching a bad signature get rejected and a duplicate return 200 without changing
anything proves as much as watching the happy path.

It calls `POST /api/dev/simulate-webhook`, which signs the payload **server-side** and delivers it
to the real webhook endpoint. `WEBHOOK_SECRET` never reaches the browser. The failure buttons are
deliberate: watching a bad signature get rejected and a duplicate return 200 without changing
anything proves as much as watching the happy path.

## Third-party UI libraries

- **`react-data-table-component`** powers all three admin tables — sorting, pagination and the
  expandable payload rows on the webhook log. It is configured once in
  `src/components/ui/DataTable.jsx` so the library's default chrome never leaks into the design
  system, and it renders from `sm` up only; below that each screen keeps its stacked cards.
- **`react-international-phone`** provides the phone field on the registration form: country
  picker, dial code and as-you-type formatting. It emits E.164 (`+919820041277`), which is what we
  store and what the backend validates. Restyled onto our tokens via its CSS variables in
  `index.css`.

  Note that the library loads its flag images from `cdnjs.cloudflare.com`, so the flags (and only
  the flags) need outbound internet. Everything else about the control works offline, and the
  country name and dial code carry the meaning if an image fails to load.

- **`@mui/x-date-pickers`** provides the date and time field on the event form
  (`src/components/ui/DateTimeField.jsx`). It is responsive by design — a calendar-and-clock popper
  on desktop, a full-screen modal with larger touch targets on mobile — which is what earns it over
  the native `datetime-local` input, whose mobile UI cannot be styled and whose desktop UI differs
  per browser.

  MUI ships its own design system, so the component carries a theme that overrides it back onto our
  tokens: brand cyan, Inter, 8px radii, hairline borders, and the same focus ring every other
  control uses. It is the heaviest dependency here by some way, so it is **lazily imported** by the
  event slide-over — it lands in its own chunk (~134 kB gzipped) that only loads when an admin
  opens that panel, and never reaches the public site at all.

`react-data-table-component` and `react-international-phone` pull in transitive weight —
`styled-components` arrives with the datatable — taking the main bundle from ~74 kB to ~129 kB
gzipped. Worth it for the behaviour; noted as a tradeoff.

## Dropdowns

Every dropdown in the app is `src/components/ui/SelectMenu.jsx`, not a native `<select>`. Natives
cannot be themed consistently across browsers and give no way to filter a long list — the event
filter alone runs to hundreds of entries once this talks to a real database. Each menu carries its
own search box, full keyboard support (arrows, Home/End, Enter, Escape, type-to-filter) and
`combobox`/`listbox` semantics.

The panel renders through a portal with fixed positioning rather than absolutely inside its
parent, because some of these live inside the slide-over whose body is `overflow-y-auto` and would
otherwise clip them. It flips above the trigger when there is no room below.

On mobile the two registration filters share a row, with search full-width above them.

### Filtering by event from elsewhere

An event's "View registrations" action carries the event id through navigation, so the
registrations page arrives already narrowed to that event instead of dumping the full list. Moving
between admin sections from the sidebar or tab bar clears that scope, so you never inherit a stale
filter from an event you looked at earlier.

## Backend contract for lists

**This section is a specification for the PHP side. The endpoints it describes do not exist yet.**

Search, filtering, sorting and pagination are one server-side operation. They cannot be split:
if the API returns one page and the frontend filters that array, the search only ever looks at the
rows you happen to be on and silently misses every match on the other pages. So no admin screen
filters data it is holding — each one sends a query and renders whatever comes back
(`src/hooks/useListQuery.js` → `AppDataContext` → `src/api/`).

The mock layer implements this exact contract today (`applyListQuery` in `src/api/mock.js`), so
switching `VITE_USE_MOCK` to `false` changes the transport and nothing else. No component changes.

### Request

Following the project-wide rule, everything travels in the POST body:

```json
{
  "search": "meera",
  "status": "pending",
  "event_id": 3,
  "page": 1,
  "per_page": 10,
  "sort_by": "created_at",
  "sort_dir": "desc"
}
```

All keys optional. A filter set to `"all"`, `null` or `""` must not narrow the result.
`per_page` of `0` or `"all"` means no pagination — that is the "Show all" option in the UI.

### Response

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 14,
    "page": 1,
    "per_page": 10,
    "total_pages": 2
  }
}
```

`total` is the count **after** filtering and **before** pagination — the UI needs it for the
"1–10 of 14" readout and to know how many pages exist.

### Order of operations, which the SQL must follow

1. Apply filters.
2. Apply search across the filtered set (`WHERE ... LIKE` over the searchable columns).
3. `COUNT(*)` for `total`, on the filtered and searched set.
4. Apply `ORDER BY`.
5. Apply `LIMIT`/`OFFSET`.

Searchable columns per resource, matching the mock:

| Resource | Search | Filters | Default sort |
|---|---|---|---|
| events | name, venue, description | status | `event_date desc` |
| registrations | reference, email, phone, first + last name | status, event_id | `created_at desc` |
| webhook_events | delivery_id, registration_reference, event_type, error_message | status | `received_at desc` |

### Two endpoints CLAUDE.md does not yet specify

Section 6 of `CLAUDE.md` lists no admin endpoint for reading registrations or webhook deliveries,
but the admin screens need both. These have to be added to the API surface and to `docs/api.md`:

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/registrations/list` | admin token | the query object above |
| POST | `/api/webhooks/list` | admin token | the query object above |

`POST /api/events/list` already exists in section 6 and needs extending from `{ "status": "..." }`
to the full query object. Both new endpoints must be behind `AdminAuth`: they expose every
registrant's name, email and phone, so an unauthenticated list endpoint would be a data breach,
not a missing feature.

Until these exist, `VITE_USE_MOCK=false` will break the two admin list screens. The events list
will work.

## Search

The public events list searches name, description and venue, and the filter chip counts update
with it so a chip never promises results the search has filtered away. It renders the full list
from context and is not paginated, so filtering locally there is correct.

The admin screens are different: they go through the query contract above. Typing is debounced by
250ms so a search does not fire a request per keystroke, and responses are sequence-checked so a
slow early reply cannot overwrite a fast later one and leave results on screen for a query the
user has already moved on from.

## Design system

Palette, type scale, radii, shadows and motion live in `tailwind.config.js`; base element styles
and the skeleton shimmer are in `src/index.css`. Brand is `#0FB5C9`, used sparingly.

Status colour and wording are defined once in `src/lib/status.js` and consumed by every badge,
chip and dot, so they cannot drift apart. Status is never communicated by colour alone — every
badge carries its written label.

Accessibility: one focus-visible ring for the whole app, labelled fields with `aria-describedby`
error wiring, `aria-invalid` on failures, focus trapping and Escape-to-close in slide-overs, and
16px inputs so iOS Safari does not zoom on focus.

Page shells run to `max-w-8xl` (88rem — a token added in `tailwind.config.js`, since Tailwind stops
at `7xl`), so the layout uses the full width of a 1440 display. The events grid gains a fourth
column at `2xl` and the status page splits into two columns at `xl` rather than stretching one.
The success screen and the reference-lookup form stay narrow on purpose — they are single-column
reading tasks, and a full-width line length would hurt them.

Full-height layouts use `dvh`, not `vh`. On a phone `100vh` measures the viewport *without* the
collapsible browser chrome, so a `min-h-screen` page is taller than the screen and ends in dead
space plus a scroll that goes nowhere. `dvh` tracks the visible viewport. Padding that clears a
fixed bar is applied only while that bar is on screen, for the same reason.

Responsive at 390 / 768 / 1440. Tables become stacked cards under `sm` rather than scrolling
sideways, slide-overs become bottom sheets with a drag handle, and primary actions become sticky
bottom bars.

## Linting

```bash
npm run lint
```

Deliberately narrow: this is not a style linter. It catches the one class of mistake a bundler
builds happily and only fails at runtime — a component or variable referenced but never defined
(`react/jsx-no-undef`) — plus hook dependency bugs. Vite will bundle `<Foo />` with no import for
`Foo` without complaint and hand you a white screen; ESLint will not.

`react-hooks/set-state-in-effect` is downgraded to a warning rather than disabled. Every current
hit is a legitimate case the rule cannot distinguish: fetching on mount, syncing a form to the
record a panel was opened with, resetting to page 1 when a filter changes.

## Layout

```
src/
├── api/          client.js (real POST endpoints), mock.js (design-mode source), index.js (picks one)
├── components/   ui/ primitives, icons/, admin/, plus domain components
├── lib/          cn, format, status, events, validation
├── pages/        public screens + pages/admin/
├── state/        AppDataContext, NavigationContext, AuthContext, ToastContext
├── App.jsx       providers + which screen renders
└── index.css     Tailwind layers and base styles
```

## Known limitations

- Admin sign-in asks for a username and a password, but the backend behind it is still a single
  shared `ADMIN_TOKEN`: the password is what travels as `X-Admin-Token`, and the username is only a
  session label used for the avatar and greeting. Nothing is authorised on the strength of the
  username, and anyone can type any name. In design mode any password of 8+ characters is accepted
  because there is no server to check it against; with `VITE_USE_MOCK=false` the server rejects a
  bad one. Real accounts with hashed passwords and roles are the obvious next step, and this form
  is the seam where they slot in.
- `npm audit` reports two dev-only advisories in esbuild via Vite 5. They affect the dev server
  only, not the build output; clearing them means a breaking upgrade to Vite 8.
- The status page polls every 4 seconds while a registration is pending. Fine at this scale; at
  thousands of concurrent users this wants server-sent events or a websocket instead.
- Mutations in design mode live in memory only. A reload restores `mock.json`.
