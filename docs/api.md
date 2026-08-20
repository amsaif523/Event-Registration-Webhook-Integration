# API reference

Everything here is `POST`, except one endpoint. That's not an oversight — every identifier the
API needs (an event id, a registration reference, a filter, whatever) travels in the JSON body,
never in the URL. `CLAUDE.md` section 6 has the long version of why, but the short version is: a
URL ends up in access logs, browser history, and `Referer` headers, and a registration reference
is basically a bearer token for someone's name, email and phone number. I'd rather it never leaves
the request body.

The practical effect is that you can't poke this API from a browser address bar. That's what
`docs/postman_collection.json` is for — import it and every request below is already built.

## The envelope

Every response, success or failure, comes back in the same shape:

```json
{ "success": true, "data": { "...": "..." } }
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The submitted data is not valid.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

`fields` only shows up on validation errors — it's one message per field, not a list, because
throwing six complaints at someone about one empty box doesn't help them.

## Auth

Two ways to authenticate, and they don't mix.

**Everything under `/api/auth/*` and the admin endpoints** run on cookies. You call
`POST /api/auth/login`, the server sets two `HttpOnly` cookies (an access token and a refresh
token), and every request after that just needs `credentials: 'same-origin'` — there's no header
to attach and nothing for client-side JavaScript to read, which is the point. If you're testing
this outside a browser (curl, Postman), you need to actually persist cookies across requests or
none of the protected endpoints will work. Postman does this automatically once you've logged in
through the collection; curl needs `-c cookies.txt -b cookies.txt`.

**The webhook endpoint** doesn't use cookies at all. It's called by a server, not a browser session,
so it proves itself with an HMAC signature instead.

Endpoints marked **admin** below need a signed-in session. Call `/api/auth/login` first.

---

## Health

### `GET /api/health`

The one GET in the app, and the one endpoint that doesn't need a body — it's meant to be hit by an
uptime checker or a browser, no ceremony. It also actually checks the database rather than just
returning 200 unconditionally: it runs `SELECT 1` and reports `degraded` / HTTP 503 if that fails.

```json
{ "success": true, "data": { "status": "ok", "db": "connected", "time": "2026-08-19T10:00:00+00:00" } }
```

---

## Auth

### `POST /api/auth/login`

```json
{ "username": "admin@eventide.test", "password": "..." }
```

`username` accepts either the username or the email — same box does both, the backend tries both
columns. On success you get the user back and two cookies; nothing you need to store yourself.

```json
{ "success": true, "data": { "user": { "id": 1, "name": "Demo Admin", "username": "admin", "email": "admin@eventide.test", "role": "admin" } } }
```

Wrong password five times in a row (`LOGIN_MAX_ATTEMPTS` in `.env`) and the account locks for
fifteen minutes (`LOGIN_LOCKOUT_SECONDS`) — you'll get a 429 with a message telling you how long is
left. Note the login failure message is identical whether the account doesn't exist or the password
is wrong — that's deliberate, so a failed login can't be used to enumerate which usernames exist.

| Status | Code | When |
|---|---|---|
| 401 | `INVALID_CREDENTIALS` | wrong username or password |
| 429 | `ACCOUNT_LOCKED` | too many recent failures |
| 422 | `VALIDATION_ERROR` | missing username or password |

### `POST /api/auth/refresh`

No body. Reads the refresh cookie, rotates it, sets a fresh pair. This is the one auth endpoint
that's *not* behind `Authenticate` — if it required a valid access token you could never use it to
recover from an expired one, which is the entire reason it exists. The frontend calls this
automatically when it gets a `TOKEN_EXPIRED` response from anything else; you shouldn't normally
need to call it yourself.

Worth knowing if you're debugging session weirdness: refresh tokens are single-use. Presenting an
already-used one isn't just rejected, it revokes every session descended from that login and forces
a fresh sign-in everywhere. That's intentional — a refresh token being reused is what token theft
looks like, and there's no way to tell attacker from victim at that point.

| Status | Code | When |
|---|---|---|
| 401 | `REFRESH_MISSING` | no refresh cookie sent |
| 401 | `REFRESH_UNKNOWN` | cookie doesn't match anything on record |
| 401 | `REFRESH_REUSED` | token was already rotated once — whole session family revoked |
| 401 | `REFRESH_EXPIRED` | past its 30-day lifetime |

### `POST /api/auth/logout`

No body. Revokes the current session's whole token family and clears both cookies. Also not behind
`Authenticate`, on purpose — signing out has to work even with a dead access token.

### `POST /api/auth/logout-everywhere` — admin

No body. Same idea but for every device this account is signed into, not just the one making the
request.

### `POST /api/auth/me` — admin

No body. Returns whoever the access token cookie says you are. The frontend calls this once on
first load of an admin screen to figure out if there's already a session, and nowhere else — it's
not something you need to poll.

---

## Events

### `POST /api/events/list` — public

```json
{ "search": "", "sort_by": "event_date", "sort_dir": "asc", "page": 1, "per_page": 12 }
```

Everything's optional. This always comes back `published` only, no matter what you send — even if
you pass `"status": "draft"` it gets stripped before the query runs, because a client asking the
public endpoint for drafts is either a bug or someone poking at events that haven't been announced.

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": 2, "name": "The Backend Room: Scaling PHP in 2026", "event_date": "2026-10-02 10:00:00",
        "venue": "WeWork Enam Sambhav, BKC, Mumbai", "capacity": 4, "seats_taken": 4, "seats_left": 0,
        "status": "published", "created_at": "...", "updated_at": "..." }
    ],
    "total": 4, "page": 1, "per_page": 12, "total_pages": 1
  }
}
```

`seats_taken` / `seats_left` are computed on every read (counting active registrations against
capacity), not stored — so they're never stale by definition, at the cost of one extra subquery per
row. Fine at this scale; see `docs/architecture.md` for where that stops being fine.

### `POST /api/events/view` — public

```json
{ "id": 2 }
```

A signed-in admin gets the event back regardless of status. Anyone else gets it back only if it's
`published` — ask for a draft's id without being signed in and you get a plain 404, not a 403,
because confirming a draft event *exists* is itself information the public shouldn't have.

| Status | Code | When |
|---|---|---|
| 404 | `EVENT_NOT_FOUND` | doesn't exist, or exists but you're not allowed to see it |
| 422 | `VALIDATION_ERROR` | missing or non-numeric `id` |

### `POST /api/events/admin-list` — admin

Same shape as the public list, but every status comes back, and you can actually filter by one:

```json
{ "status": "draft", "search": "", "sort_by": "created_at", "sort_dir": "desc", "page": 1, "per_page": 20 }
```

### `POST /api/events/create` — admin

```json
{
  "name": "Type & Grid: An Editorial Workshop",
  "description": "Two days on typographic systems for the web.",
  "event_date": "2026-12-05 11:00",
  "venue": "Studio 44, Lower Parel, Mumbai",
  "capacity": 40,
  "status": "draft"
}
```

`status` defaults to `draft` if you leave it out, which is deliberate — an event shouldn't go live
by accident because someone forgot a field. `event_date` accepts a couple of formats
(`Y-m-d H:i`, `Y-m-d\TH:i`, with or without seconds) so both a plain form input and an ISO string
work.

Returns 201 with the created event, shaped exactly like a list item.

### `POST /api/events/update` — admin

```json
{ "id": 4, "capacity": 50 }
```

Partial by design — only the fields you send get touched, so `{ "id": 4, "status": "closed" }`
doesn't wipe the description. One guard worth knowing: you can't set `capacity` below the number of
seats already taken. The admin UI will let you type a lower number and show a warning, but the API
itself refuses it outright, because the API has no way to know whether a human actually read that
warning.

| Status | Code | When |
|---|---|---|
| 404 | `EVENT_NOT_FOUND` | id doesn't exist |
| 422 | `VALIDATION_ERROR` | capacity below seats already taken, or any field fails its rule |

---

## Registrations

### `POST /api/registrations/create` — public

```json
{ "event_id": 2, "first_name": "Asma", "last_name": "Madhvaswala", "email": "asma@example.com", "phone": "+919876543210" }
```

This is the one that has to be race-safe — see `docs/architecture.md` for the row-lock
explanation, this is just the contract. Returns 201 with the full registration, including the
reference number you'll need for everything after this:

```json
{
  "success": true,
  "data": {
    "registration": {
      "id": 41, "event_id": 2, "event_name": "The Backend Room: Scaling PHP in 2026",
      "event_date": "2026-10-02 10:00:00", "venue": "WeWork Enam Sambhav, BKC, Mumbai",
      "reference": "EVT-7QK3M2XD", "first_name": "Asma", "last_name": "Madhvaswala",
      "email": "asma@example.com", "phone": "+919876543210", "status": "pending",
      "ticket_id": null, "created_at": "...", "confirmed_at": null
    }
  }
}
```

| Status | Code | When |
|---|---|---|
| 404 | `EVENT_NOT_FOUND` | `event_id` doesn't exist |
| 409 | `EVENT_NOT_OPEN` | event is `draft`, `closed`, or `cancelled` |
| 409 | `EVENT_PASSED` | `event_date` is in the past |
| 409 | `EVENT_FULL` | no seats left, checked inside the row lock |
| 409 | `ALREADY_REGISTERED` | this email already has a registration for this event |
| 422 | `VALIDATION_ERROR` | a field failed its rule — see the table below |

Field rules, since the error messages don't spell out the exact boundaries:

| Field | Rule |
|---|---|
| `first_name`, `last_name` | required, 2–100 characters |
| `email` | required, valid email, max 255 |
| `phone` | required, digits with optional `+` and separators, 8–15 digits, max 30 chars stored |
| `event_id` | required, integer ≥ 1 |

### `POST /api/registrations/status` — public

```json
{ "reference": "EVT-7QK3M2XD" }
```

Case-insensitive on purpose — people read a reference off a screenshot or have it read to them over
the phone, and the backend uppercases it before comparing, so there's no reason to punish someone
for typing it in lowercase. This is what the status page polls every four seconds while a
registration is `pending`.

| Status | Code | When |
|---|---|---|
| 404 | `REGISTRATION_NOT_FOUND` | no registration with that reference |
| 422 | `VALIDATION_ERROR` | doesn't match the `EVT-XXXXXXXX` shape at all |

### `POST /api/registrations/list` — admin

```json
{ "event_id": 2, "status": "pending", "search": "asma", "sort_by": "created_at", "sort_dir": "desc", "page": 1, "per_page": 20 }
```

All optional, all combinable. This one's behind auth for a reason worth saying out loud: it returns
every registrant's name, email and phone number for whichever event you ask about. Leaving that
open would be a data breach dressed up as a missing feature.

---

## Webhooks

### `POST /api/webhooks/ticketing`

This is the one endpoint whose exact path is fixed by the assignment brief, and the one worth the
most attention. It's unauthenticated in the cookie sense — there's no session, no admin token — but
it's not open. The caller proves itself with a signature over the raw request body.

**Headers**

| Header | Required | What it's for |
|---|---|---|
| `X-Signature` | yes | `sha256=<hex hmac>`, computed over `{timestamp}.{rawBody}` with `WEBHOOK_SECRET` |
| `X-Timestamp` | yes* | unix seconds; part of what gets signed, not just a header sitting next to the signature |
| `X-Webhook-Id` | no | used as the idempotency key; if you omit it, a SHA-256 of the body is used instead |

\* Technically optional in the code, but omitting it means the replay-window check is skipped
entirely, which defeats the point. Always send it.

**Body**

```json
{
  "event": "ticket.confirmed",
  "registration_reference": "EVT-7QK3M2XD",
  "ticket_id": "TKT-4821-A9F3",
  "status": "confirmed",
  "confirmed_at": "2026-08-19T10:32:00+00:00"
}
```

`event` can also be `"ticket.cancelled"` (or just `"status": "cancelled"` — either one is honoured).
`reference` is accepted as an alias for `registration_reference` in case a real provider ever
shipped it that way; there's no reason to bounce a delivery over a field name we could've just read.

**Computing the signature**, if you're building the request by hand:

```
message   = timestamp + "." + rawRequestBody
signature = "sha256=" + hex(hmac_sha256(message, WEBHOOK_SECRET))
```

The important part is *raw*. If you build the JSON, then decode it, then re-encode it before
signing, the bytes won't match what the server received and the whole thing will fail for reasons
that look like a bug in the signature code but are actually a bug in how you handled the string.
`scripts/send_webhook.php` in the backend does this correctly and is worth reading if you want a
working example in PHP; there's a `--mode=` flag on it for trying the failure cases too.

**What comes back**

| Status | Outcome | Meaning |
|---|---|---|
| 200 | `processed` | signature valid, delivery new, registration confirmed (or cancelled) |
| 200 | `duplicate` | this delivery id was already seen — nothing changed, and that's success, not an error |
| 401 | `invalid_signature` | signature didn't match |
| 401 | `stale` | timestamp outside the tolerance window (`WEBHOOK_TOLERANCE_SECONDS`, default 300s) |
| 422 | `failed` | signature and timing were fine, but the payload didn't make sense (reference doesn't exist, wrong starting state, missing `ticket_id`) |

Every single one of these — including the rejections — gets written to `webhook_events`. That table
is the audit trail; `POST /api/webhooks/list` (admin) is how you read it back.

Why 200 on a duplicate instead of an error code: most webhook senders retry anything that looks
like a failure. Answering "already handled" with 200 is what makes the retries stop. A 4xx or 5xx
here would just mean the sender tries again in a minute, forever.

### `POST /api/webhooks/list` — admin

```json
{ "status": "invalid_signature", "search": "", "sort_by": "received_at", "sort_dir": "desc", "page": 1, "per_page": 20 }
```

Also returns a `status_counts` object alongside the page of results — counts across the *whole*
table regardless of the current filter, which is what lets the status filter chips show a number
next to each option without zeroing the others out when one's selected.

---

## Dashboard

### `POST /api/dashboard/summary` — admin

No body. One call, everything the admin dashboard needs: aggregate counts, the most recent
registrations, and the most recent webhook deliveries. It's deliberately one endpoint rather than
four or five — the dashboard polls this, and polling five endpoints instead of one is five times
the requests for a screen that has to agree with itself on one page.

```json
{
  "success": true,
  "data": {
    "stats": {
      "total_events": 6, "published_events": 4, "total_registrations": 41,
      "pending_registrations": 3, "confirmed_registrations": 38,
      "registrations_last_24h": 5, "webhooks_last_24h": 7, "webhooks_rejected": 1
    },
    "recent_registrations": [ "...up to 8..." ],
    "recent_webhooks": [ "...up to 8..." ],
    "server_time": "2026-08-19 10:00:00"
  }
}
```

`webhooks_rejected` counts `invalid_signature` and `failed` only — a `duplicate` isn't a rejection,
it's the idempotency guard doing exactly what it's supposed to, so it doesn't get counted against
the system.

---

## Dev tools

### `POST /api/dev/simulate-webhook` — demo mode only

```json
{ "reference": "EVT-7QK3M2XD", "mode": "valid" }
```

`mode` is one of `valid`, `bad_signature`, `duplicate`, `stale`, `cancel` — the last two aren't
wired up as buttons in the public UI but work fine here or from the CLI script. This exists because
a reviewer opens a URL, not a terminal, and without it the entire webhook side of the flow is
invisible unless they're willing to hand-compute an HMAC. It signs the payload on the server and
sends it through the exact same `WebhookService::handle()` the real endpoint uses — nothing about
verification is skipped or faked, only the "who's sending this" part is simulated.

Refuses to run at all unless `DEMO_MODE=true` is set in the backend's `.env`. Turn that off before
this ever sits somewhere it shouldn't.

| Status | Code | When |
|---|---|---|
| 403 | `DEMO_MODE_OFF` | `DEMO_MODE` isn't `true` |
| 404 | `REGISTRATION_NOT_FOUND` | reference doesn't exist |

---

## Error codes, all in one place

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 422 | one or more fields failed their rule — see `error.fields` |
| `ENDPOINT_NOT_FOUND` | 404 | no route at that path |
| `METHOD_NOT_ALLOWED` | 405 | right path, wrong verb — remember, almost everything is POST |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | missing or wrong `Content-Type`; send `application/json` |
| `UNAUTHENTICATED` | 401 | no access-token cookie present |
| `TOKEN_EXPIRED` | 401 | access token past its 15-minute window — the frontend auto-refreshes on this one specifically |
| `TOKEN_MALFORMED` / `TOKEN_ALGORITHM` / `TOKEN_SIGNATURE` / `TOKEN_NOT_YET_VALID` / `TOKEN_ISSUER` / `TOKEN_SUBJECT` | 401 | token is structurally wrong or tampered with — shouldn't happen outside someone poking at it by hand |
| `SESSION_REVOKED` | 401 | valid token, but the session behind it was signed out or force-revoked |
| `INVALID_CREDENTIALS` | 401 | login failed |
| `ACCOUNT_LOCKED` | 429 | too many failed logins |
| `REFRESH_MISSING` / `REFRESH_UNKNOWN` / `REFRESH_REUSED` / `REFRESH_EXPIRED` | 401 | see the refresh endpoint above |
| `EVENT_NOT_FOUND` / `REGISTRATION_NOT_FOUND` | 404 | doesn't exist, or you're not allowed to know it does |
| `EVENT_NOT_OPEN` / `EVENT_PASSED` / `EVENT_FULL` / `ALREADY_REGISTERED` | 409 | registration refused — the event's or the request's state, not a bug |
| `DEMO_MODE_OFF` | 403 | simulator disabled |
| `DATABASE_ERROR` | 500 | MySQL unreachable — message is generic unless `APP_DEBUG=true` |
| `SERVER_ERROR` | 500 | anything unexpected — logged server-side with the real detail, never shown to the client |

If `APP_DEBUG=true` in `.env`, `DATABASE_ERROR` and `SERVER_ERROR` include the real exception
message. That should never be true on the live URL — a stack trace in a response body is a map of
the app for whoever's poking at it.
