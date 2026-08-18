# Eventide — UI specification (as built)

This started life as a prompt for generating the UI in Figma. The UI now exists, so this file
describes **what was actually built** rather than what was asked for. It stays in the same shape as
the original brief so it still reads as a spec, and section 12 records where the build diverged
from that brief and why — those are the decisions worth being able to defend.

Implementation lives in `frontend/`. Setup, the API contract and known limitations are in
`frontend/README.md`.

---

## 1. The data rule

All displayed content comes from ONE file: `frontend/public/data/mock.json`.

- No hardcoded content in any component. No inline arrays, no placeholder strings typed into a
  card, no dummy rows written into a table.
- It is fetched **once** at the app root (`src/state/AppDataContext.jsx`), held in state, and
  passed down through context.
- Every list, table, card grid, badge, counter and stat renders by mapping over that data.
- Every screen renders correctly when an array is empty and shows a designed empty state instead
  of collapsing.
- Editing `mock.json` and reloading changes the entire UI. That is the acceptance test.

It sits in `public/` so Vite serves it as a static file: editing it and reloading works with no
rebuild.

Seed contents: **6 events** (one nearly full, one completely full, one draft, one cancelled, one
past), **14 registrations** across them with a mix of statuses, **10 webhook deliveries** covering
all four log statuses.

```jsonc
{
  "events":         [{ "id", "name", "description", "event_date", "venue",
                       "capacity", "seats_taken", "seats_left", "status" }],
  "registrations":  [{ "id", "event_id", "reference", "first_name", "last_name", "email",
                       "phone", "status", "ticket_id", "created_at", "confirmed_at" }],
  "webhook_events": [{ "id", "delivery_id", "event_type", "registration_reference",
                       "status", "error_message", "received_at", "payload" }],
  "stats":          { "total_events", "published_events", "total_registrations",
                      "pending_registrations", "confirmed_registrations",
                      "webhooks_last_24h", "webhooks_rejected" }
}
```

**Counters are derived, not trusted.** `stats` is recomputed from the arrays at runtime so the
numbers stay correct after a registration or a simulated webhook. The block stays in the schema
because the API returns it.

---

## 2. No identifiers in URLs

Carried over from `CLAUDE.md` sections 6 and 11, and applied to the frontend as strictly as to the
API.

There is **no router**. The whole app lives at `/` and navigation is state-driven
(`src/state/NavigationContext.jsx`). There are no `/events/12` or `/status/EVT-…` routes, so a
registration reference never reaches the address bar, browser history, a bookmark, or a `Referer`
header sent to a third-party asset.

- The selected event id lives in React state.
- The tracked reference is mirrored into `sessionStorage`, so refreshing the status screen
  recovers instead of dead-ending.
- A reference restored from a previous session that no longer resolves is dropped silently, not
  reported as an error the visitor did not cause.

---

## 3. Visual direction

Editorial and confident, not a dashboard template: generous whitespace, a strong type scale,
restrained colour, real hierarchy.

**Palette**
- Brand: deep cyan `#0FB5C9`, used sparingly and with intent — primary actions, active states, key
  data emphasis. Never a full-bleed gradient.
- Ink `#0B1220` headings, `#475569` body, `#94A3B8` meta.
- Surface `#FAFAFA` page, pure white cards, `#E2E8F0` hairline borders.
- Status: emerald `#059669` confirmed/processed, amber `#D97706` pending, red `#DC2626`
  invalid/failed, orange for failed deliveries, slate `#64748B` cancelled/duplicate/draft.

**Typography**
- Headings: Plus Jakarta Sans, tight tracking, 600/700. Page titles 32–40px desktop.
- Body/UI: Inter, 15px base, 1.6 line height.
- Tabular figures on every number in a table or stat card.

**Craft**
- 12px card radius, 8px inputs and buttons, consistently.
- Depth from hairline borders and one soft shadow, not layered heavy shadows.
- 4px spacing grid.
- Hover, focus-visible, active and disabled designed on every interactive element.
- Transitions 150–200ms ease-out. Nothing bounces.
- Line icons only, 1.5px stroke, one set (`src/components/icons/Icon.jsx`). No emoji as icons.

**Avoided:** purple-to-blue gradient heroes, glassmorphism, neon glows, oversized pill cards,
Bootstrap defaults, centred hero with an abstract blob, drop shadows on everything, stock
photography.

Tokens live in `tailwind.config.js`; base element styles and the skeleton shimmer in
`src/index.css`. Status colour and wording are defined once in `src/lib/status.js` and consumed by
every badge, chip and dot, so they cannot drift apart.

**Width.** Page shells run to `max-w-8xl` (88rem — a custom token; Tailwind stops at `7xl`). The
events grid gains a fourth column at `2xl`; the status page splits into two columns at `xl` rather
than stretching one. The success screen and the reference-lookup form stay narrow on purpose —
they are single-column reading tasks.

---

## 4. Third-party components

Four libraries do work that would have been poor to rebuild. Each is themed onto our tokens so it
does not read as bolted on.

| Library | Used for | Notes |
|---|---|---|
| `react-data-table-component` | all three admin tables | Configured once in `ui/DataTable.jsx`. Renders from `sm` up only. |
| `react-international-phone` | phone field on the registration form | Emits E.164. Flags load from a CDN. |
| `@mui/x-date-pickers` | date + time on the event form | Responsive by design. **Lazily imported** — its own ~134 kB chunk, never on the public site. |
| `styled-components` | transitive, via the datatable | — |

Everything else is hand-built, including the searchable select, because none of these ship one
that matches the design system.

**Dropdowns.** Every `<select>` in the app is `ui/SelectMenu.jsx`, not a native one. Natives cannot
be themed consistently across browsers and give no way to filter a long list — the event filter
runs to hundreds of entries against a real database. Each menu carries its own search box, full
keyboard support (arrows, Home/End, Enter, Escape, type-to-filter) and `combobox`/`listbox`
semantics. The panel renders through a **portal with fixed positioning**, because some of these
live inside the slide-over whose body is `overflow-y-auto` and would clip an absolutely positioned
panel; it flips above the trigger when there is no room below.

---

## 5. Public screens

### 5.1 Events list
Compact header: wordmark left, one action right — **"Track registration"**, visible at every width
(shortened to "Track" on mobile). It is what a returning visitor comes back to do. Admin is *not*
here; it lives in the footer.

Short page title and one line of supporting copy. Filter chips — All events, Upcoming, Almost full
— each with a count, beside a **search field** covering name, description and venue. Chip counts
recompute against the search so a chip never promises results the search has already removed.

Responsive card grid: 4 up at `2xl`, 3 on desktop, 2 on tablet, 1 on mobile. Each card carries a
date block (month above, day number large), status badge, event name, two-line truncated
description, date/time, venue, a capacity bar with "24 of 120 seats left", and a CTA.

Cards for full, draft, cancelled or past events are **muted and disabled, never hidden** — a
sold-out event still tells you the event exists. Their button reads "Sold out", "Cancelled" or
"Registration closed". Hover raises a live card very slightly and shifts its border to brand cyan.

### 5.2 Event detail and registration
Two columns on desktop: event information left, sticky registration form card right. Single column
on mobile with a sticky bottom bar holding the primary Register button — which hides once the form
itself is on screen, and whose reserved space is only allocated while it is showing.

Form fields: first name, last name, email, phone. Top-aligned labels, required markers, helper
text. Client-side rules mirror the backend exactly, but the server is the authority: a 422 returns
per-field messages that overwrite ours. Errors appear only after a field has been blurred, so the
form does not shout at someone still typing.

Phone uses `react-international-phone`: country picker, dial code, as-you-type formatting, E.164
out. A bare dial code counts as empty rather than invalid, because the picker seeds one before
anything is typed.

Designed states: validation error (red border, 13px message, first invalid field focused), submit
button in default / hover / loading ("Registering…") / disabled, and both failure banners — "This
event is now full" and "This email is already registered for this event".

### 5.3 Registration success
Calm confirmation, not confetti. Centred column, restrained check mark. **The reference number is
the hero**: large, monospaced, on a bordered surface, with copy-to-clipboard and a "Copied" toast.
Below it a three-step "What happens next". Primary button: "Track my registration".

### 5.4 Registration status
Reference with copy button, status badge, event summary, and who registered. A three-step timeline
— Registration received, Awaiting ticket confirmation, Confirmed — with completed steps in emerald
carrying a **tick inside the marker**, the current step in amber with a soft pulsing dot, future
steps grey. Both terminal states designed: still Pending, and Confirmed showing ticket ID and
confirmation timestamp with a success banner that slides in on the transition.

Polls every 4 seconds while pending and stops at a terminal state.

Two columns at `xl` — summary and timeline left — because a single column at full width strands
the content.

**The webhook simulator is not on this screen.** See 6.4.

---

## 6. Admin screens

### 6.1 Login
Split screen. Left: ink panel with the wordmark, a headline and three capability rows over a flat
hairline grid — hidden below `lg` rather than stacked, since stacking pushes the form below the
fold for no benefit. Right: the form.

**Username and password**, both required. Username accepts an email or a plain username. Show/hide
toggle on the password. Per-field errors with focus sent to the first problem, plus a banner for a
failed sign-in. No sign-up, no password reset, no social buttons.

The password is what travels as `X-Admin-Token`; the username is a session label used for the
avatar. `asma.madhvaswala@example.com` renders as "Asma Madhvaswala" → **AM**.

### 6.2 Shell
Fixed chrome, scrolling content. Sidebar, top bar and footer are all `position: fixed`; only the
content column scrolls, so navigation and identity stay reachable from anywhere in a long table.
The main column is padded to clear each fixed edge rather than nested in an inner scroll container,
so the page keeps its native scrollbar and Cmd+F still works.

- **Desktop:** persistent left sidebar — wordmark, four nav items, signed-in user pinned at the
  bottom. Active item marked with a cyan left rule and a tinted background. Fixed footer with the
  copyright year.
- **Mobile:** the sidebar becomes a **bottom tab bar**, not a drawer behind a hamburger. Four tabs
  (Home, Events, Signups, Webhooks), icon over label, active tab cyan with a top rule. Sections
  stay one thumb-tap away and always visible, which is how a phone app behaves. The footer is
  desktop-only; the tab bar owns the bottom edge.

The signed-in user appears as an **initials avatar with a sign-out button** in both the sidebar and
the top bar.

### 6.3 Dashboard
Four stat cards: total events, total registrations, pending confirmations, webhooks rejected in the
last 24 hours. Each with a label, a large tabular number and a context line. The rejected-webhooks
card turns red-tinted when the value is above zero. **Two per row on mobile**, with the number and
padding stepping down so a half-width card still reads.

Below: "Recent registrations" and "Recent webhook activity" side by side on desktop, stacked on
mobile, each with its own empty state.

### 6.4 Events management
Header with title and description. Below it, **search and the primary action share one line** at
every size — the Create button collapses to a `+` on mobile — with the status dropdown beneath on
mobile and inline on desktop.

Data table: name, date, venue, capacity as a mini progress bar with "96 / 120", status badge, and
**visible row actions** — an edit pencil and a view-registrations icon, both labelled. Not a
three-dot menu: that saved 40px of width and cost every user a guess. The description is not in the
table; it duplicated the name and crowded the row.

Create and edit open the same **right-side slide-over**, not a centred modal, so the table stays
visible behind it. Fields: name, description with character count, date and time, venue, capacity
with steppers, status. Footer with Cancel and Save, Save showing a loading state. Reducing capacity
below current registrations shows an **amber inline warning** and still allows the save — it is a
real decision, not a typo.

Date and time uses the MUI picker: calendar-and-clock popper on desktop, full-screen modal with
larger touch targets on mobile, sized to exactly match every other control in the panel.

### 6.5 Registrations
Filterable table: reference in monospace, name, contact, event, status badge, registered date,
ticket ID, and a view action. Search covers reference, name and email; dropdowns filter by event
and status, **sharing one row on mobile** with search full-width above.

Arriving from an event's "View registrations" lands here **already narrowed to that event**.
Navigating in from the sidebar or tab bar clears that scope, so you never inherit a stale filter
from an event you looked at earlier.

Clicking a row opens a detail slide-over with the full record, **the webhook simulator**, and that
registration's webhook deliveries with their raw payloads.

**The simulator lives here, not on the public tracking page.** Someone who has just registered
should see their status and nothing else; a tool for provoking webhooks is staff equipment. Placing
it beside the record it acts on also means you watch the status and the delivery log change
together.

It is a dashed-border panel tagged "Demo only" with three buttons — send a valid webhook, send one
with an invalid signature, send a duplicate — over a live result log with coloured status chips. It
calls `POST /api/dev/simulate-webhook`, which signs the payload **server-side**;
`WEBHOOK_SECRET` never reaches the browser. The failure buttons are deliberate: watching a bad
signature get rejected and a duplicate return 200 without changing anything proves as much as the
happy path.

### 6.6 Webhook logs
The proof that the integration works.

Table: received time (absolute and relative), event type, delivery ID truncated in monospace with a
copy button, registration reference, and a status chip. A row **expands inline** to reveal the raw
JSON payload in a monospaced block with syntax colouring, plus the error message when present.

Filtering is a **status dropdown with per-status counts as option subtitles**, not chips — chips
read as status badges, and the Status column already uses badges for something else.

---

## 7. Lists, search and pagination

Search, filtering, sorting and pagination are **one server-side operation**. They cannot be split:
if the API returns one page and the frontend filters that array, the search only ever looks at the
rows you happen to be on and silently misses every match on the other pages.

So no admin screen filters data it is holding. Each sends a query object and renders what comes
back (`src/hooks/useListQuery.js` → `AppDataContext` → `src/api/`). The mock implements the same
contract, so `VITE_USE_MOCK=false` is a transport change with no component edits.

Typing is debounced 250ms, and responses are sequence-checked so a slow early reply cannot
overwrite a fast later one.

**The full contract, and the two endpoints `CLAUDE.md` section 6 does not yet specify
(`POST /api/registrations/list` and `POST /api/webhooks/list`, both behind `AdminAuth`), are
documented in `frontend/README.md` under "Backend contract for lists".**

The public events list is the exception: it renders the full set from context and is not
paginated, so filtering locally there is correct.

Mobile card lists paginate like the desktop tables — 10/25/50 per page plus **"Show all"**, since
on a phone scrolling a short list often beats paging through it. Each mobile list is one bordered
panel containing its rows and pagination, rather than a stack of free-floating cards.

---

## 8. Universal states

Built on every screen:

- **Loading:** skeleton placeholders matching the real layout, not centred spinners.
- **Empty:** line icon, headline, one line of guidance, and a primary action where relevant.
- **Error:** inline retry card with a short plain-language message.
- **Toasts:** bottom-right on desktop, top on mobile, success/error/info, auto-dismiss.
- **404.**

---

## 9. Responsive

Designed at 390 / 768 / 1440.

- Tables become stacked cards below `sm`, never horizontally scrolling tables.
- Slide-over panels become full-height bottom sheets with a drag handle.
- Primary actions become sticky bottom bars.
- Minimum 44px touch targets; 16px minimum font on inputs so iOS Safari does not zoom on focus.
- Long chip rows scroll sideways rather than wrapping into a tall block.

**Full-height layouts use `dvh`, not `vh`.** On a phone `100vh` measures the viewport *without* the
collapsible browser chrome, so a `min-h-screen` page is taller than the screen and ends in dead
space plus a scroll that goes nowhere. Padding that clears a fixed bar is applied only while that
bar is on screen, for the same reason.

---

## 10. Accessibility

- WCAG AA contrast on all text, badges and muted meta text included.
- One visible focus-visible ring for the whole app, keyboard-only.
- **Status is never colour alone** — every badge carries its written label.
- Semantic headings; labelled fields wired to their errors with `aria-describedby` and
  `aria-invalid`.
- Slide-overs trap focus, close on Escape and restore focus to the trigger.
- Icon-only buttons carry both `aria-label` and a title tooltip.
- `prefers-reduced-motion` respected globally.

---

## 11. Tooling

- `npm run lint` — deliberately narrow. Not a style linter: it catches what the bundler builds
  happily and only fails at runtime, chiefly a component referenced but never imported
  (`react/jsx-no-undef`), plus hook dependency bugs.
- A server-render smoke harness mounts every page with its providers, so a crash is caught before
  a browser sees it. Vite building successfully does **not** mean the app runs.

---

## 12. Where this diverged from the original brief, and why

| Original brief | As built | Why |
|---|---|---|
| Admin link in the header | Admin in the footer; header carries "Track registration" | Admin is a staff entry point, not a visitor task. Tracking is what a visitor returns to do, so it earns the header slot at every width. |
| Webhook simulator on the public status page | In the admin registration detail panel | Someone who just registered should see their status, not a tool for provoking webhooks. Beside the record it acts on, you watch status and delivery log change together. |
| "Admin access token" single field | Username + password | Asked for during the build. The password still maps to the shared `ADMIN_TOKEN`; the username is a session label for the avatar. Real accounts slot in at this seam. |
| Filter chips on webhook logs | Status dropdown with counts | Chips read as status badges, and the Status column already uses badges. Two shapes, two meanings. |
| Sidebar becomes a drawer on mobile | Sidebar becomes a bottom tab bar | Sections stay one tap away and always visible. A drawer hides navigation behind a gesture nobody prompts you to make. |
| Row actions menu with Edit / View registrations | Two visible labelled icon buttons | The menu saved 40px of width and cost every user a guess about where the actions were. |
| Native selects | Custom searchable `SelectMenu` | Natives cannot be themed consistently and cannot filter a long list. |
| Native `datetime-local` | MUI X `DateTimePicker`, lazily loaded | Its mobile UI cannot be styled and its desktop UI differs per browser. |
| Client-side filtering | Server-shaped list queries | Filtering a paginated response only ever searches the page you are on. |
| Event description shown in the admin table | Removed | It duplicated the name and crowded the row. |
| — | `max-w-8xl` page shells, `dvh` heights, fixed public footer | Requested during the build; `dvh` also fixed a real mobile scroll bug. |

Two things in the original brief were **not** implemented and are deliberate omissions:
`data/mock.json` sits at `public/data/mock.json` so Vite serves it without a rebuild, and the
`stats` block is recomputed from the arrays rather than read from the file, so counters stay
correct after a mutation.
