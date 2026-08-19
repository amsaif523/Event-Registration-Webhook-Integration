# Figma AI prompt: Event Registration Platform

Paste everything inside the block below. Keep it in one go, it is written to be read as a single
brief.

---

```
Design and build a production-quality web application UI called "Eventide", an event
registration platform. It has two distinct surfaces: a public registration flow and an internal
admin panel. Desktop and mobile, both fully designed.

=====================================================================
NON-NEGOTIABLE DATA RULE
=====================================================================
All displayed content comes from ONE file: data/mock.json.

- No hardcoded content anywhere in any component. No inline arrays, no placeholder
  strings like "Event Name" typed into a card, no dummy rows written into a table.
- Fetch data/mock.json once at the app root, hold it in state, pass it down.
- Every list, table, card grid, badge, counter, and stat renders by mapping over that data.
- Every screen must still render correctly if an array in that file is empty, and must show a
  designed empty state instead of collapsing.
- If I edit data/mock.json and reload, the entire UI must change accordingly. Treat that as the
  acceptance test.

Create data/mock.json with exactly this shape and fill it with realistic seed content: 6 events
(one nearly full, one completely full, one draft, one cancelled, one in the past), 14
registrations spread across them with a mix of statuses, and 10 webhook log entries covering all
four log statuses.

{
  "events": [
    {
      "id": 1,
      "name": "",
      "description": "",
      "event_date": "2026-09-14T18:30:00",
      "venue": "",
      "capacity": 120,
      "seats_taken": 96,
      "seats_left": 24,
      "status": "published"          // draft | published | closed | cancelled
    }
  ],
  "registrations": [
    {
      "id": 1,
      "event_id": 1,
      "reference": "EVT-7QK3M2XD",
      "first_name": "",
      "last_name": "",
      "email": "",
      "phone": "",
      "status": "pending",           // pending | confirmed | cancelled
      "ticket_id": null,
      "created_at": "2026-08-11T09:22:00",
      "confirmed_at": null
    }
  ],
  "webhook_events": [
    {
      "id": 1,
      "delivery_id": "whd_9f2a...",
      "event_type": "ticket.confirmed",
      "registration_reference": "EVT-7QK3M2XD",
      "status": "processed",         // processed | duplicate | invalid_signature | failed
      "error_message": null,
      "received_at": "2026-08-11T09:22:14",
      "payload": "{ raw json string }"
    }
  ],
  "stats": {
    "total_events": 6,
    "published_events": 3,
    "total_registrations": 14,
    "pending_registrations": 5,
    "confirmed_registrations": 8,
    "webhooks_last_24h": 10,
    "webhooks_rejected": 2
  }
}

=====================================================================
VISUAL DIRECTION
=====================================================================
Editorial and confident, not another dashboard template. Think a well-designed ticketing
product: generous whitespace, a strong type scale, restrained colour, real hierarchy.

Palette:
- Primary / brand: deep cyan #0FB5C9, used sparingly and with intent (primary actions,
  active states, key data emphasis). Never as a full-bleed gradient background.
- Ink: #0B1220 for headings, #475569 for body, #94A3B8 for meta text.
- Surface: #FAFAFA page background, pure white cards, #E2E8F0 hairline borders.
- Status colours: emerald #059669 confirmed / processed, amber #D97706 pending,
  red #DC2626 invalid or failed, slate #64748B cancelled / duplicate / draft.

Typography:
- Headings: Plus Jakarta Sans, tight tracking, weights 600 and 700. Page titles large, 32 to
  40px desktop, real presence.
- Body and UI: Inter, 15px base, 1.6 line height.
- All numbers in tables and stat cards use tabular figures so columns align.

Craft details that matter:
- 12px card radius, 8px on inputs and buttons. Consistent everywhere.
- Depth from hairline borders and one very soft shadow, not layered heavy shadows.
- 4px spacing grid throughout.
- Every interactive element has hover, focus-visible, active, and disabled states designed.
- Transitions 150 to 200ms ease-out. Subtle. Nothing bounces.
- Line icons only, 1.5px stroke, consistent set. No emoji as icons.

Explicitly avoid: purple-to-blue gradient heroes, glassmorphism, neon glows, oversized rounded
pill cards, generic Bootstrap look, centered hero with an abstract blob, drop shadows on
everything, decorative stock photography.

=====================================================================
PUBLIC SCREENS
=====================================================================

1. EVENTS LIST
   Compact header with wordmark and a single "Admin" text link, right aligned.
   Short page title and one line of supporting copy.
   Filter chips: All, Upcoming, Almost full.
   Responsive card grid, 3 up on desktop, 2 on tablet, 1 on mobile.
   Each card shows: date block (day number large, month above), event name, two-line truncated
   description, venue, a capacity bar with "24 of 120 seats left", and a status badge.
   Cards for full, draft, cancelled, or past events are visually muted with a disabled button
   reading "Sold out", "Registration closed", or "Cancelled". Do not hide them.
   Hover raises the card very slightly and shifts the border to brand cyan.

2. EVENT DETAIL AND REGISTRATION
   Two-column on desktop: event information left, sticky registration form card right.
   Single column on mobile, form below the details, with a sticky bottom bar holding the
   primary "Register" button.
   Form fields: First name, Last name, Email, Phone. Floating or top-aligned labels, clear
   required indicators, helper text under phone showing the expected format.
   Design the validation error state explicitly: red border, 13px red message under the field,
   error summary is not needed but the first invalid field is focused.
   Design the submit button in all four states: default, hover, loading with a spinner and
   "Registering...", and disabled.
   Design the two failure banners: "This event is now full" and "This email is already
   registered for this event".

3. REGISTRATION SUCCESS
   Calm confirmation, not a confetti explosion. Centered column, restrained check mark.
   The reference number is the hero of this screen: large, monospaced, on a bordered surface,
   with a copy-to-clipboard button and a "Copied" toast.
   Below it, a short "What happens next" three-step explanation.
   Primary button: "Track my registration".

4. REGISTRATION STATUS
   Shows the reference, event summary, and a status timeline with three steps: Registration
   received, Awaiting ticket confirmation, Confirmed. Completed steps in emerald, the current
   step in amber with a soft pulsing indicator, future steps in grey.
   Design both terminal states: still Pending, and Confirmed showing the ticket ID and
   confirmation timestamp.
   Design the transition moment: when status flips to confirmed, the timeline step animates and
   a success banner slides in.

   Below the timeline, a visually separated panel titled "Simulate ticketing system", clearly
   marked as a demo tool with a dashed border and a "Demo only" tag. Three buttons:
   "Send valid webhook", "Send with invalid signature", "Send duplicate webhook".
   Under them a small live result log showing the last few attempts with coloured status chips.

=====================================================================
ADMIN SCREENS
=====================================================================

5. ADMIN LOGIN
   Minimal centered card. Single field labelled "Admin access token", masked, with a show/hide
   toggle. Error state for an invalid token. No sign-up, no forgot-password, no social buttons.

6. ADMIN SHELL
   Persistent left sidebar on desktop: wordmark, nav items for Dashboard, Events, Registrations,
   Webhook Logs, and a sign-out at the bottom. Active item marked with a cyan left rule and a
   tinted background.
   On mobile the sidebar becomes a slide-in drawer opened from a top bar hamburger.

7. DASHBOARD
   Four stat cards across the top: total events, total registrations, pending confirmations,
   webhooks rejected in the last 24 hours. Each with a label, a large tabular number, and a
   small trend or context line. The rejected-webhooks card turns red-tinted when the value is
   above zero.
   Below: a "Recent registrations" table and a "Recent webhook activity" list side by side on
   desktop, stacked on mobile.

8. EVENTS MANAGEMENT
   Page header with title and a primary "Create event" button.
   Data table: name, date, venue, capacity as a mini progress bar with "96 / 120", status badge,
   and a row actions menu with Edit and View registrations.
   Search field and a status filter dropdown above the table.
   Create and edit both open the same right-side slide-over panel, not a centered modal. Fields:
   name, description textarea with character count, date and time picker, venue, capacity number
   input with stepper, status select. Footer with Cancel and Save, Save shows a loading state.
   Design the capacity warning inline: reducing capacity below current registrations shows an
   amber inline warning, it does not silently allow it.

9. REGISTRATIONS
   Filterable table: reference in monospace, name, email, phone, event name, status badge,
   registered date, ticket ID. Filters for event and status. Clicking a row opens a detail
   slide-over with the full record and its related webhook deliveries.

10. WEBHOOK LOGS
    This screen is the proof that the integration works, design it with care.
    Table: received time, event type, delivery ID truncated in monospace with a copy button,
    registration reference, and a status chip coloured emerald, slate, red, or orange.
    A row expands inline to reveal the raw JSON payload in a monospaced code block with syntax
    colouring, plus the error message when present.
    Filter chips across the top by status, each showing a count.

=====================================================================
UNIVERSAL STATES
=====================================================================
Design all of these, they are part of the deliverable:
- Loading: skeleton placeholders matching the real layout, not centered spinners.
- Empty: an illustrated-lite empty state with a line icon, a headline, one line of guidance,
  and where relevant a primary action.
- Error: inline retry card with a short plain-language message.
- Toasts: bottom-right on desktop, top on mobile, success and error variants, auto-dismiss.
- 404 page.

=====================================================================
RESPONSIVE
=====================================================================
Design mobile at 390px, tablet at 768px, desktop at 1440px. Mobile is not an afterthought:
- Tables become stacked cards, never horizontally scrolling tables.
- Slide-over panels become full-height bottom sheets with a drag handle.
- Primary actions become sticky bottom bars.
- Minimum 44px touch targets, 16px minimum font size on inputs to stop iOS zoom.
- Test that the registration form and the webhook log payload viewer both work at 390px.

=====================================================================
ACCESSIBILITY
=====================================================================
WCAG AA contrast on all text including badges and muted meta text. Visible focus rings.
Status is never communicated by colour alone, always colour plus text label. Semantic headings.
Labelled form fields with associated error messages.
```

