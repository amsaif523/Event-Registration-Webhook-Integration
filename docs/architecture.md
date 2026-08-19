# Architecture

This is the "why does it look like this" document. If you just want endpoint shapes, that's
`docs/api.md`. This one's about the decisions underneath them — what the request lifecycle
actually is, where the two race conditions in this app get closed, how sessions work, and the
answer to "how would this hold up at real scale."

## Stack, and why each piece

| Layer | Choice | Why |
|---|---|---|
| Backend | Plain PHP 8.2, no framework | The assignment is really asking "can you build routing, validation, sessions and a webhook pipeline yourself, or do you only know how to configure a framework that does it for you." Using Laravel would have answered a different question. |
| DB access | PDO, prepared statements, no ORM | Every query in the repo is one you can read top to bottom. Nothing generated, nothing that needs `->toSql()` to debug. |
| Database | MySQL 8 / MariaDB 10.4+ | XAMPP — the local dev setup most people reaching for a PHP assignment already have — ships MariaDB, so the schema deliberately avoids anything MySQL-8-only (no JSON columns, no window functions, no functional indexes). Plain `TEXT` for the webhook payload column keeps both engines equally happy. |
| Frontend | React 18 + Vite + Tailwind | Nothing unusual here — fast dev server, no build ceremony, and Tailwind means the UI states (loading/empty/error, which the assignment explicitly grades) don't turn into a separate CSS file to maintain. |
| Auth | Hand-rolled JWT + DB-backed refresh tokens | Covered in its own section below — this is the one place the build went past what the brief asked for. |

Explicitly not used: Docker, an ORM, Redis, queues, a Node backend. Composer is here purely for
PSR-4 autoloading and PHPUnit — if it's missing, `bootstrap.php` falls back to a plain
`spl_autoload_register`, so the app still boots on a machine that's never run `composer install`.

Everything above is about how the app *behaves*. How it *looks* is a separate, equally deliberate
decision, specified in [`figma-ui-prompt.md`](../figma-ui-prompt.md) at the repo root — exact
palette, the Plus Jakarta Sans / Inter type pairing, spacing grid, and a screen-by-screen behavior
spec (every button state, every empty/loading/error state, mobile breakpoints down to 390px). It's
the reason the frontend has one consistent visual system instead of each screen inventing its own —
`components/ui/*` implements what that brief specifies once, and every page composes from those
rather than writing new CSS per screen.

## The request lifecycle

Every request — one GET aside — goes through the same eight hops, and once you know this you can
answer "how does endpoint X work" for any endpoint without having read that specific controller:

```
public/index.php                    ← Apache/nginx rewrites everything here
  → bootstrap.php                   ← autoload, load .env, set timezone
  → Request::fromGlobals()          ← method, path, headers, the RAW body, cookies
  → routes.php                      ← builds the Router with every route registered
  → Router::dispatch()
        exact-match "METHOD path"   ← no regex, no {id} extraction, ever
        run middleware left→right   ← RequireJson, Authenticate
        call the controller
              Validator::validate() ← throws 422 with per-field errors on failure
              a Service              ← business logic, and any DB transaction
              a Repository            ← the actual SQL, prepared statements only
        returns a Response
  → Response::send()                ← the only place anything is echoed, anywhere
```

`index.php` is also the only place exceptions get caught. Controllers never build an error
response by hand — they throw a typed exception (`ValidationException`, `NotFoundException`,
`ConflictException`, and so on) and the front controller maps it to a status code and a stable
`error.code` string the frontend can switch on. A raw `PDOException` gets logged with
`error_log()` and shown to the client as a generic message; the real SQL error only appears if
`APP_DEBUG=true`, which should never be true on the live URL — a stack trace in a JSON body is
free reconnaissance for whoever's poking at it.

Because controllers only ever read from an injected `Request` object — never `$_GET`, `$_POST`,
or `$_SERVER` directly — a test can build one of these objects by hand and hand it straight to the
router. No HTTP server involved. The webhook simulator (see below) uses this same trick to fire a
fully verified webhook without a second process making a real network call.

## No identifiers in URLs — anywhere

Every endpoint but `GET /api/health` is `POST` to a literal, fixed path. There's no `/events/12`,
no `?status=published`, nothing. Every id, filter and reference travels in the JSON body, and this
rule holds on the frontend too — there's no React Router, and the selected event or the open
registration reference live in component state, mirrored into `sessionStorage` only so a page
refresh doesn't lose them.

The reasoning, in order of how much it actually matters:

1. **URLs get logged, everywhere, by default.** Apache access logs, browser history, bookmarks,
   and — worse — the `Referer` header sent to any third-party script or image on the page. A
   registration reference is effectively a bearer token for one person's name, email and phone
   number. Putting it in a URL means it ends up in plaintext somewhere outside my control.
2. **One request shape for everything.** Validation and — for the webhook — signing both work on
   "the body," full stop. There's no special path for "this one has a path param."
3. **References are the actual defense against guessing, not the URL rule.** Keeping the
   reference out of URLs stops it leaking into logs, but it doesn't stop someone incrementing a
   number. That's why references are random 8-character strings, not sequential ids — see the
   registration section below.

I'm not going to pretend this is free. HTTP caching is gone — every read is a POST, so a browser
or CDN can't cache `/api/events/list` the way it could cache a GET. And `POST /api/events/view` is
not idempotent by HTTP semantics even though it's read-only in practice; nothing about the HTTP
verb itself protects it from being retried by something that assumes POST means "changed
something." Those are real costs. I decided the leakage risk was worse.

## The two race conditions this app has to get right

There are exactly two places in this codebase where two requests arriving at the same instant can
produce a wrong result if you're not careful, and both are handled the same way: lock a row, do
the read *inside* the lock, and let the second request block instead of racing.

### 1. Registration capacity

The obvious implementation — count existing registrations, compare to capacity, insert if there's
room — has a race. Two requests for the last seat both count 49 of 50, both conclude there's room,
both insert, and the event is now oversold at 51. Nothing in either request's code is visibly
wrong; the bug only exists in the gap between them.

`RegistrationService::register()` fixes this by opening a transaction and immediately taking a row
lock on the event:

```php
$event = $this->events->findForUpdate($eventId);   // SELECT ... FOR UPDATE
// a concurrent second request now blocks here until this transaction commits

$taken = $this->registrations->countActiveForEvent($eventId);  // read happens INSIDE the lock
if ($taken >= $event['capacity']) { /* 409 EVENT_FULL */ }
```

The second request physically waits for the first to commit, then re-reads and correctly sees
50/50. As a second, independent guard, `registrations` also has a `UNIQUE(event_id, email)`
constraint — even if the application logic above had a bug, the database itself would still refuse
a duplicate and the code catches that specific SQLSTATE (`23000`) and turns it into a clean 409
instead of a 500.

### 2. Webhook delivery idempotency

Same shape of problem, different table. A webhook sender that doesn't get a fast response — or
does and the response gets lost on the way back — will retry. Two copies of the same delivery
arriving close together shouldn't both apply.

The fix here isn't a row lock, it's using the database's own uniqueness guarantee as the decision
point. `webhook_events.delivery_id` is `UNIQUE`, and `WebhookService::handle()` **inserts first**:

```php
// Not check-then-insert — that has the exact same race as the capacity check above.
if (!$this->log->claim($deliveryId, ...)) {   // this is an INSERT; false means duplicate key
    // already seen — log it, return 200, change nothing
}
```

Exactly one `INSERT` can win a unique key; there's no window where two copies both "see nothing
yet" and both proceed. Whichever one loses gets told, correctly, that this is a repeat.

The actual state change — flipping a registration from `pending` to `confirmed` — is guarded the
same way as capacity: the `UPDATE` itself carries the precondition in its `WHERE` clause
(`WHERE reference = ? AND status = 'pending'`), not in an `if` above it. That means a late,
out-of-order duplicate delivery can never un-cancel a cancelled registration — the `WHERE` simply
won't match, and the affected-row count tells the code whether the transition actually happened.

## The webhook, as a flow

1. Capture the **raw** request body before anything decodes it — the signature is computed over
   these exact bytes, and re-encoding decoded JSON changes whitespace and key order, which breaks
   the signature for reasons that look like a bug but aren't.
2. Work out a `delivery_id`: the `X-Webhook-Id` header if sent, otherwise a SHA-256 of the raw
   body, so a sender that forgets the header still gets idempotency.
3. Verify `X-Signature` — HMAC-SHA256 over `{timestamp}.{rawBody}` using `WEBHOOK_SECRET`,
   compared with `hash_equals()` rather than `===`. String equality short-circuits on the first
   differing byte, which leaks timing information an attacker can use to forge a signature one
   byte at a time; `hash_equals()` runs in constant time specifically to close that off. Fails →
   log `invalid_signature`, return 401.
4. Check `X-Timestamp` is inside the tolerance window (`WEBHOOK_TOLERANCE_SECONDS`, 300s by
   default), in either direction — too old is a replay, too far in the future means the sender's
   clock can't be trusted to make "too old" mean anything. The timestamp being *inside* the signed
   string, not just a header next to it, is what makes this check actually mean something: a
   captured request can't have its timestamp bumped without invalidating the signature.
5. Claim the delivery id by insert (see above). Duplicate → 200, nothing changes. This is the part
   people expect to be an error and it deliberately isn't — a webhook sender retries anything that
   looks like failure, and answering "already handled" with 200 is what makes it stop.
6. Apply the guarded transition inside its own transaction, locking the registration row first
   (`SELECT ... FOR UPDATE`) so this can't interleave with another delivery for the same reference.

Every outcome — including the rejected ones — gets a row in `webhook_events`. That table is the
audit trail, and being able to show *why* a delivery was rejected is worth as much in a demo as
showing one that succeeded.

### Making this visible to a reviewer who won't run curl

The brief says a reviewer opens a public URL. Without something in the browser to trigger a
webhook, the entire second half of the flow — the part that's actually the point of the assignment
— is invisible. So the status page has a "Simulate ticketing system" panel that posts to
`POST /api/dev/simulate-webhook`, which signs a payload **on the server** and dispatches it through
the exact same `WebhookService::handle()` the real endpoint uses. Two things about that are
deliberate: `WEBHOOK_SECRET` never reaches the browser (a client-side simulator would have to ship
the secret to JavaScript to sign anything, which defeats the entire premise of having a secret),
and nothing about verification is skipped or mocked — it's a real signature checked by the real
code path, only the "who's calling" part is stood in for. It's gated behind `DEMO_MODE=true` and
refuses to run at all otherwise.

## Sessions

The brief's original plan was a single shared `ADMIN_TOKEN` compared with `hash_equals`, which is
fine for a demo but doesn't hold up to "what would a real system need." What's actually in the repo
is a proper two-token session:

- **Access token** — a self-contained JWT (HS256, hand-written against PHP's own `hash_hmac` /
  `hash_equals`, about 140 lines, no dependency), good for 15 minutes. Every request checks it with
  zero database round-trips, but for the same reason it can't be revoked before it expires — that's
  the whole trade with stateless tokens, and it's why the lifetime is short.
- **Refresh token** — a random string, stored as a SHA-256 hash in `refresh_tokens`, good for 30
  days, used only against `/api/auth/refresh`. Being a database row is what makes it revocable, and
  revoking it is what "sign out" actually means.

Both live in `HttpOnly`, `SameSite=Strict` cookies. The frontend's API client never touches a token
value at all — it just sends `credentials: 'same-origin'` and lets the browser attach the cookies.
An XSS on the page can steal a lot of things; it can't steal a cookie it's not allowed to read.
`SameSite=Strict` also does double duty as CSRF defense, backed by a `RequireJson` middleware that
rejects anything not sent as `Content-Type: application/json` — a cross-site `<form>` POST can only
send `multipart/form-data` or `text/plain`, so it can't reach a handler at all, and a `fetch()` that
does set the header has to clear a CORS preflight this API never answers.

The part that's a genuine departure from a typical stateless-JWT setup: `Authenticate` middleware
checks two things, not one — the signature and expiry (pure computation), and then whether the
token's session family still has a live refresh token behind it (one indexed database lookup).
Skipping that second check is the usual reason "sign out" on a JWT-based app doesn't actually do
anything until the token happens to expire on its own — a stolen access token just keeps working.
Paying one lookup per authenticated request buys the ability to revoke a session immediately, which
felt like the right trade for something with an admin panel behind it.

Refresh tokens also rotate on every use, and reuse of an already-rotated one is treated as a signal
that something's wrong rather than as an ordinary invalid-token error — the legitimate client
already swapped it and threw it away, so a second presentation means a copy exists somewhere it
shouldn't, and there's no way to tell attacker from victim. The whole token family gets revoked and
the account has to sign in fresh everywhere.

## Data model

Five tables, all InnoDB, all `utf8mb4`. Raw `.sql` migration files, tracked by a `migrations` table
`scripts/migrate.php` maintains — no ORM migration DSL, so anyone can read exactly what's about to
run against their database.

- **`events`** — `status` is `draft/published/closed/cancelled`; only `published` accepts
  registrations. Indexed on `(status, event_date)`, which is exactly the pair the public list
  filters and sorts by.
- **`registrations`** — `UNIQUE(reference)` and `UNIQUE(event_id, email)`. Foreign key to `events`
  with `ON DELETE CASCADE`.
- **`webhook_events`** — `UNIQUE(delivery_id)` is the entire idempotency mechanism described above.
  Every delivery gets a row, accepted or not.
- **`users`** / **`refresh_tokens`** — not in the original plan; added because a real session model
  needed somewhere to live. `refresh_tokens.family_id` is what groups tokens descended from one
  login together for the reuse-detection logic above.

`seats_taken` on an event and `event_name` / `venue` on a registration are computed at read time —
a subquery and a join, respectively — rather than stored as denormalized columns kept in sync by
application code. That's a deliberate small trade: a stored counter is one more thing that can
silently drift from reality, and at the traffic this app will ever see, the subquery costs nothing
worth optimizing away. It's also the first thing I'd change if this needed to handle real load —
see the scaling answer below.

## Scaling this to thousands of concurrent users

Roughly in the order I'd actually do them, because they're not equally urgent:

**Get the webhook endpoint off the request thread first.** Right now, verifying a signature,
claiming idempotency, and applying the state transition all happen synchronously inside the HTTP
request the ticketing provider is waiting on. That's fine at low volume, but a real provider has
retry/backoff SLAs, and the moment this endpoint is slow for any reason — a lock wait, a slow
query, a deploy — deliveries start queuing on their end, not ours. The fix is boring and standard:
the endpoint verifies the signature and idempotency, writes the row, and returns 200 immediately;
a worker picks the row up and does the actual `confirm()`/`cancel()`. The audit trail in
`webhook_events` already has everything a worker would need to pick up where it left off.

**Replace the row lock with a reserved-seats counter, and cache the read-heavy stuff.** The
`SELECT ... FOR UPDATE` on the event row is correct and simple, but it serializes every
registration attempt for one event through a single row — that's the first thing that becomes
visibly slow once an event is popular enough that people are registering in the same second. A
counter column, incremented atomically and decremented on cancellation, removes the lock-and-wait
entirely; the event list itself (read far more often than it's written) is a good candidate for a
short-lived cache in front of it, since every registration re-hits the database today given that
POST responses aren't cacheable by browsers or proxies.

**Then the operational basics that stop mattering less than they sound like they would.** Rate
limiting on the public endpoints, read replicas for the list and status queries so registration
writes aren't competing with dashboard reads for the same connections, and structured logging with
actual monitoring instead of `error_log()` lines someone has to go find on a box. None of this is
exotic — it's the standard playbook for "this now has real traffic" — but it's a genuinely
different set of engineering priorities than what this codebase optimizes for today, which is
"every line is correct and you can read all of it in one sitting."
