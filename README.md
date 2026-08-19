# Eventide — Event Registration & Webhook Integration

A small event registration app built for a full-stack technical assignment. Someone registers for
an event, gets a reference number back, and a simulated ticketing system fires a signed webhook a
few seconds later that flips their registration from `pending` to `confirmed` — live, no page
refresh.

Backend is plain PHP 8.2 (no framework, PDO only). Frontend is React 18 + Vite + Tailwind. Database
is MySQL/MariaDB. The reasoning behind the stack, and every non-obvious decision in it, is in
[`docs/architecture.md`](docs/architecture.md); the reasoning behind how it *looks* — palette, type,
every screen's states, spacing, responsive and accessibility rules — is in
[`figma-ui-prompt.md`](figma-ui-prompt.md). This file is about getting it running.

> **AI disclosure:** this project was built with heavy use of Claude (Anthropic's Claude Code) as
> a coding assistant. What it was asked to do, what got kept, and what got overridden and why is in
> [`AI.md`](AI.md).

---

## Live demo

| | |
|---|---|
| **URL** | [https://eventtide.amsaifinfotech.com](https://eventtide.amsaifinfotech.com) |
| **Admin login** | `admin@eventide.test` / `ChangeMe123!!` |



## Technologies used

| Layer | Choice |
|---|---|
| Backend | PHP 8.2+, no framework — routing, validation, sessions, all hand-written |
| DB access | PDO, prepared statements only, no ORM |
| Database | MySQL 8 or MariaDB 10.4+ (the schema deliberately avoids MySQL-8-only features, since XAMPP ships MariaDB) |
| Frontend | React 18, Vite, Tailwind CSS |
| Auth | Hand-rolled HS256 JWT (access token) + database-backed refresh tokens, both in `HttpOnly` cookies |
| Testing | PHPUnit 10 |
| Local server | PHP's built-in server (fastest to get running) or XAMPP/Apache (closer to a real deploy) |

Composer exists only for PSR-4 autoloading and PHPUnit — it's not a framework. If it's missing,
`backend/bootstrap.php` falls back to a plain `spl_autoload_register` and the app still boots.

### Where the UI design comes from

The frontend wasn't improvised screen-by-screen — [`figma-ui-prompt.md`](figma-ui-prompt.md) at the
repo root is the actual design brief it was built against: exact palette hex values, the type
pairing (Plus Jakarta Sans for headings, Inter for body/UI, tabular figures in every table and stat
card), the 12px/8px radius and 4px spacing grid, and a screen-by-screen spec for all ten screens —
including states most specs skip, like what an oversold-event card looks like, the four button
states on the registration form, and the loading/empty/error/404 states the assignment's usability
scoring actually checks for.

If you're extending the UI, check that file before inventing a new visual pattern — the existing
components (`Badge`, `Button`, `CapacityBar`, `StatusTimeline`, the admin `DataTable`/`SlideOver`)
already implement what it specifies, so a new screen usually means reusing one of those rather than
writing new CSS.

---

## Prerequisites

You need four things installed before step 1: **PHP 8.2+** (with the `pdo_mysql`, `json`,
`openssl`, and `mbstring` extensions — all on by default in XAMPP and most Linux/macOS package
builds, but a standalone Windows PHP zip often ships with `mbstring` commented out in `php.ini` and
needs it turned on by hand — see below), **MySQL 8+ or MariaDB 10.4+**, **Node.js 18+** with npm,
and **Composer**. Composer is technically optional — `bootstrap.php` falls back to a plain
autoloader without it — but you'll need it to pull in PHPUnit and run the test suite, so install it
anyway.

If you don't already have these, pick your OS:

<details>
<summary><strong>Windows</strong></summary>

The single-install option is **[XAMPP](https://www.apachefriends.org/)** — it bundles PHP, Apache,
and MariaDB together, which is what this project's original setup targeted. After installing it,
add PHP to your `PATH` so you can run `php` from any terminal, not just inside the XAMPP control
panel:

```powershell
$env:Path += ";C:\xampp\php"
```

That only lasts for the current terminal session. To make it permanent: Windows Settings → search
"environment variables" → **Edit the system environment variables** → **Environment Variables** →
under "System variables" find `Path` → **Edit** → **New** → add `C:\xampp\php` → OK everywhere,
then open a fresh terminal.

Composer: download and run the installer from
[getcomposer.org](https://getcomposer.org/download/) — it detects XAMPP's PHP automatically.

Node: install from [nodejs.org](https://nodejs.org/) (LTS build) — the installer adds it to `PATH`
for you.

If you're using a standalone PHP zip instead of XAMPP (XAMPP itself ships `mbstring` already on),
open `php.ini` in the PHP install folder and uncomment this line — remove the leading `;`:

```ini
extension=mbstring
```

Then confirm it with `php -m | findstr mbstring` (PowerShell) — no output means it's still off.

</details>

<details>
<summary><strong>macOS</strong></summary>

```bash
brew install php@8.2 composer node mysql
brew services start mysql
```

If `brew install php@8.2` isn't linked as your default `php`, either `brew link php@8.2 --force` or
add it to your shell's `PATH` (Homebrew prints the exact line to add after install).

</details>

<details>
<summary><strong>Linux (Debian/Ubuntu)</strong></summary>

```bash
sudo apt update
sudo apt install php8.2-cli php8.2-pdo php8.2-mysql php8.2-mbstring php8.2-xml composer mysql-server nodejs npm
sudo systemctl start mysql
```

Distro-packaged Node on Debian/Ubuntu is often old — if `node -v` comes back under 18, use
[nodesource](https://github.com/nodesource/distributions) or `nvm` instead of the `apt` package.

</details>

### Confirm everything's actually on your PATH

Before going any further, run these in the terminal you'll actually use for the rest of this guide
— a fresh install not being on `PATH` yet is the single most common setup failure, and this catches
it in ten seconds instead of an hour into `composer install`:

```bash
php -v
composer -V
node -v
npm -v
mysql --version
```

Every one of those should print a version, not "command not found" / "is not recognized." If PHP or
Composer fail on Windows, it's almost always the `PATH` step above.

---

## 1. Clone the repository

```bash
git clone https://github.com/amsaif523/Event-Registration-Webhook-Integration.git
cd eventide
```

---

## 2. Backend setup

```bash
cd backend
composer install
cp .env.example .env
```

### Environment variables

Open `.env` and fill these in. Every one of them is read by `App\Core\Env`, and a missing required
one fails loudly at boot rather than silently doing the wrong thing.

| Variable | What it's for |
|---|---|
| `APP_ENV` | `local` or `production` — informational, doesn't gate behavior on its own |
| `APP_DEBUG` | `true` shows real exception messages in API error responses. **Must be `false` on anything public** — a stack trace in a JSON response is free reconnaissance |
| `APP_URL` | Used only to decide whether cookies get the `Secure` flag (on for `https://`, off for local `http://`) |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | Your MySQL/MariaDB connection. XAMPP defaults are `127.0.0.1`, `3306`, `root`, empty password |
| `DB_TEST_DATABASE` | A second database, used only by the test suite — dropped/rebuilt automatically, never touches your dev data |
| `SEED_ADMIN_PASSWORD` | The password `scripts/seed.php` gives the demo admin account. Change it before deploying anywhere real |
| `JWT_SECRET` | Signs admin session tokens. Generate one with `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"` — must be at least 32 random characters, and the app refuses to boot on the placeholder value |
| `JWT_ISSUER` | Just a label embedded in the token; `eventide` is fine to leave as-is |
| `ACCESS_TOKEN_TTL` | Access token lifetime in seconds (default 900 = 15 min) |
| `REFRESH_TOKEN_TTL` | Refresh token lifetime in seconds (default 2592000 = 30 days) |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_SECONDS` | Failed-login lockout: how many tries, how long the lock lasts |
| `WEBHOOK_SECRET` | The HMAC key the ticketing webhook is signed with. Same rule as `JWT_SECRET`: 16+ random characters, not the placeholder |
| `WEBHOOK_TOLERANCE_SECONDS` | How old a webhook's timestamp can be before it's rejected as a replay (default 300 = 5 min) |
| `DEMO_MODE` | `true` exposes `POST /api/dev/simulate-webhook`, which is what lets a reviewer trigger the webhook flow from the browser. Leave it `true` for the live demo; it's the whole point of that URL existing |

There's no real third-party service to register for anywhere in this project — the "ticketing
system" is simulated end to end, on purpose, so a reviewer never needs an external API key to see
the full flow work.

### Database

Create the database and apply the schema:

```bash
php scripts/migrate.php
php scripts/seed.php
```

`migrate.php` creates the database if it doesn't exist yet, tracks what's already applied in a
`migrations` table, and only runs what's new — safe to run again after pulling changes. `seed.php`
loads demo events (including one that's one seat from full and one that's completely full, so you
can hit the capacity rule immediately) and creates the demo admin account, printing the password it
used to the terminal.

Add `--fresh` to `migrate.php` to drop and rebuild from nothing:

```bash
php scripts/migrate.php --fresh
php scripts/seed.php
```

### Start the backend

Fastest option — PHP's built-in server, no Apache config needed:

```bash
php -S 127.0.0.1:8080 -t public public/index.php
```

Check it: `http://127.0.0.1:8080/api/health` should return
`{"success":true,"data":{"status":"ok","db":"connected",...}}`.

Alternative — XAMPP/Apache, closer to how this would actually run in production: point a virtual
host's `DocumentRoot` at `backend/public` (`mod_rewrite` must be on — `.htaccess` is already there
and handles routing everything through `index.php`). IIS works too; `backend/public/web.config` has
the equivalent rewrite rule, and PHP needs to be wired up via FastCGI.

---

## 3. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
```

`frontend/.env` has two variables:

| Variable | What it's for |
|---|---|
| `VITE_API_BASE_URL` | Leave empty for local dev — the Vite dev server proxies `/api/*` straight to the backend (see `vite.config.js`), so the browser only ever talks to one origin |
| `VITE_USE_MOCK` | `true` runs the whole UI against a static `public/data/mock.json` with no backend at all — useful for pure UI work, not what you want for actually testing the registration/webhook flow |

Start it:

```bash
npm run dev
```

By default the dev proxy forwards to `http://127.0.0.1:8080`, matching the built-in PHP server from
step 2 — **if you started the backend that way, there's nothing to configure here, just run
`npm run dev` as-is.**

Only if you're running the backend through an Apache/XAMPP vhost at some other address instead, set
`PROXY_TARGET` to wherever that vhost actually serves `backend/public` from, before starting Vite.
The syntax for setting an env var for one command differs by shell:

macOS / Linux / Git Bash:
```bash
PROXY_TARGET=http://localhost/your-vhost-path npm run dev
```

Windows PowerShell:
```powershell
$env:PROXY_TARGET = "http://localhost/your-vhost-path"
npm run dev
```

Windows cmd.exe:
```cmd
set PROXY_TARGET=http://localhost/your-vhost-path
npm run dev
```

---

## 4. Access the application locally

| What | URL |
|---|---|
| Frontend (the actual app) | `http://localhost:5173` |
| Backend API root | `http://127.0.0.1:8080/api/*` (or your Apache vhost) |
| Health check | `http://127.0.0.1:8080/api/health` |
| Admin panel | `http://localhost:5173` → the "Admin" link in the footer |

Sign in to the admin panel with whatever `seed.php` printed (`admin@eventide.test` /
`$SEED_ADMIN_PASSWORD`).

---

## 5. Running the tests

```bash
cd backend
composer test
```

This runs the full PHPUnit suite against `DB_TEST_DATABASE`, not your dev database —
`tests/bootstrap.php` creates it and applies migrations automatically on every run, so there's no
separate setup step. It covers the six scenarios the brief asks for and a handful more:

- a successful registration, and that it returns a properly-shaped reference
- validation failures (missing/malformed fields) — and that nothing gets written when they happen
- an event refusing registration once it's at capacity, refusing a duplicate email, refusing a
  draft or already-past event
- a correctly signed webhook confirming a `pending` registration
- an invalid signature being rejected *and* logged, without touching the registration
- a repeated delivery id being accepted (200) but changing nothing
- a webhook outside the replay-tolerance window being rejected as stale
- a cancellation webhook, and that a late confirmation can't resurrect an already-cancelled
  registration
- HMAC signing/verification as a pure unit test — including the exact "re-encoded JSON breaks the
  signature" mistake described in `docs/architecture.md`

One thing worth knowing if you're reading the test code: the test base class resets the database by
truncating tables before every test, not by wrapping each test in a transaction and rolling it
back. The transaction approach is the more obvious one and was the original plan, but it doesn't
actually work here — `RegistrationService` and `WebhookService` each open their own transaction
under test, and PDO doesn't support nested transactions on one connection. Truncating gives the
same "every test starts clean" guarantee without fighting the app's own transaction boundaries.
This is written up as a real example of a decision that changed mid-build in
[`AI.md`](AI.md).

---

## Webhook security & duplicate handling

The brief specifically asks this to be explained here, so, briefly (the full version with code is
in `docs/architecture.md`):

Every request to `POST /api/webhooks/ticketing` has to carry an `X-Signature` header —
`sha256=<hmac-sha256 of "{timestamp}.{raw request body}" using WEBHOOK_SECRET>` — computed over the
**raw** bytes of the request, before anything decodes the JSON. It's compared with `hash_equals()`,
not `==`/`===`, so the comparison can't be timed to leak how much of a forged signature was
correct. The timestamp (`X-Timestamp`) is signed as part of that same string, not just sent
alongside it, and anything older than `WEBHOOK_TOLERANCE_SECONDS` (5 minutes by default) in either
direction is rejected — that's what stops a captured, valid request from being replayed later.

For duplicates: every delivery is expected to carry an `X-Webhook-Id` (or one is derived from a
hash of the body if it's missing), and that id has a `UNIQUE` index on it in the `webhook_events`
table. The handler **inserts first** — if the insert hits that unique constraint, this is a repeat,
full stop, and it's logged and answered with `200 OK` rather than an error. That's deliberate: most
webhook senders retry anything that looks like a failure, and answering "already handled" with 200
is what actually makes the retries stop. The registration's own state transition is additionally
guarded in SQL (`UPDATE ... WHERE status = 'pending'`), so even a duplicate that somehow got past
the id check couldn't undo a cancellation or re-confirm something twice.

Every inbound delivery is logged to `webhook_events` — accepted or rejected, and why. That table is
the audit trail, and `POST /api/webhooks/list` (admin) reads it back.

---

## API documentation

Full endpoint reference: [`docs/api.md`](docs/api.md). Every request/response shape, every field
validation rule, every error code the API can return.

Since every endpoint but `GET /api/health` is a `POST` to a fixed path with no URL parameters (see
`docs/architecture.md` for why), you can't poke this API from a browser address bar. Import
[`docs/postman_collection.json`](docs/postman_collection.json) instead — it has a ready-to-run
request for every endpoint, including the failing webhook cases (bad signature, duplicate, stale).

---

## Architecture & technical decisions

All in [`docs/architecture.md`](docs/architecture.md): the request lifecycle, the reasoning behind
having no identifiers in any URL anywhere in the app, the two places this codebase has to defend
against a real race condition (registration capacity and webhook idempotency) with the actual code
for both, the session/auth model, and the data model.

---

## Known limitations

- **Test coverage stops at registrations, events, and webhooks.** `composer test` covers the six
  scenarios the brief requires plus several more, but the admin write endpoints
  (`events/create`, `events/update`, auth login/refresh/logout) aren't exercised by an automated
  test yet, only by hand.
- **No rate limiting on public endpoints.** Login has its own lockout after repeated failures, but
  `/api/registrations/create` and `/api/webhooks/ticketing` accept requests as fast as they arrive.
- **Single database, no read replicas, no cache.** Every read hits MySQL directly, including the
  event list on every page load.
- **The row lock on capacity serializes registration attempts for a given event through one row.**
  Fine at the scale this app runs at; the first thing to change under real load (see below).
- **`APP_DEBUG` is a single global switch** rather than something scoped per-environment beyond the
  `.env` file — it must stay `false` on anything public.
- **The admin role is a single flat `role = 'admin'` value**, with no read-only or per-permission
  tier.

---

## If this had thousands of concurrent users

The full answer with reasoning is in `docs/architecture.md`; the short version, roughly in the
order I'd actually do them:

1. **Move webhook processing off the request thread.** Right now the endpoint verifies, logs, and
   applies the state transition all inside the HTTP request the ticketing provider is waiting on.
   At real volume I'd have it verify-and-log-only, hand off to a queue, and return fast — a slow
   downstream write shouldn't be able to make the provider's delivery time out.
2. **Replace the row lock on event capacity with a reserved-seats counter, and cache the
   read-heavy event list.** The `SELECT ... FOR UPDATE` is correct and simple, but it serializes
   every registration attempt for one event through a single row — fine for a talk with 40 seats,
   not fine for something selling out in the first minute.
3. **The operational basics**: rate limiting on the public endpoints, read replicas so registration
   writes aren't fighting dashboard reads for the same connections, and real structured
   logging/monitoring instead of `error_log()` lines.

---

## Test / demo credentials

| | |
|---|---|
| Live admin login | `admin@eventide.test` / `ChangeMe123!!` — confirmed working against the live URL above |
| Local / any fresh environment | `admin@eventide.test` / whatever `SEED_ADMIN_PASSWORD` is set to in that environment's `.env` — `scripts/seed.php` prints it to the terminal when it runs |

No other account or third-party credential is needed anywhere in this project.

---

## Troubleshooting

**`composer install` fails with `ext-mbstring ... is missing from your system`.** `mbstring` is off
in `php.ini`. Uncomment `extension=mbstring` (see the Windows section under Prerequisites above),
then confirm with `php -m` before retrying — this is required by the app itself (`Validator.php`
uses `mb_strlen()` for field-length rules), not just by PHPUnit.

**`php`, `composer`, or `mysql` is "not recognized as an internal or external command" (Windows).**
The install added the program but not to your `PATH`, so the shell can't find the executable by
name. See the `PATH` fix under Prerequisites → Windows above. This bites people on a fresh XAMPP
install specifically — the XAMPP control panel can start PHP/MySQL fine without `PATH` ever being
set, so it's easy not to notice until you try to run `php` from an ordinary terminal.

**`/api/*` returns a plain 404 from Apache, not the app's JSON 404.** `mod_rewrite` isn't enabled,
or the vhost's `AllowOverride` isn't set to allow `.htaccess` to take effect. Enable
`mod_rewrite` in `httpd.conf`, make sure the vhost has `AllowOverride All` for `backend/public`,
and restart Apache.

**Port 80 is already in use (IIS, Skype, or another service on Windows).** Either stop whatever's
holding it, or run Apache on a different port and adjust the vhost/URL you use accordingly. This
doesn't affect the built-in-PHP-server path at all, since that runs on 8080.

**A migration fails with a syntax or type error.** You're very likely on real MySQL 8 with
something enabled that MariaDB doesn't have, or vice-versa — the schema is deliberately written to
the intersection of both (no `JSON` columns, no window functions, no functional indexes), so this
usually means a stray copy-paste from somewhere else got into a migration file. Check what actually
changed.

**Webhook signature verification fails even though you're sure the secret matches.** By far the
most common cause: something re-encoded or re-formatted the JSON body between generating it and
sending it (a text editor adding a trailing newline, a proxy pretty-printing it, copy-pasting from
somewhere that reformats whitespace). The signature is computed over the *exact* bytes of the
body — see the section above. Use `scripts/send_webhook.php` to generate a request from PHP
directly if you want a known-good example to compare against.

**`composer test` fails immediately with a message about `WEBHOOK_SECRET` or `JWT_SECRET`.** Those
two still have their placeholder values (anything starting with `change_me`) in `.env` — the app
refuses to boot with either one, on purpose, so this can't accidentally ship. Generate real values
as described in the environment variables table above.

**The frontend loads but every API call fails as a network error.** The backend isn't running, or
`PROXY_TARGET` doesn't point at where it's actually listening. Confirm
`http://127.0.0.1:8080/api/health` (or your Apache vhost's equivalent) works directly in a browser
first.

**Vite's proxy doesn't seem to be picking up backend changes / still hitting the old target.**
Restart `npm run dev` after changing `PROXY_TARGET` — Vite reads it once at startup, not on every
request.

---

## Project layout

```
backend/              plain PHP API — see docs/architecture.md for the request lifecycle through it
frontend/             React + Vite admin/public UI
docs/                 api.md, architecture.md, postman_collection.json
CLAUDE.md             the working design doc this project was built from
figma-ui-prompt.md    the UI/UX design brief — palette, type, every screen's states and behavior
AI.md                 how AI was used building this, and what got overridden
```

---

## Deliverables checklist

- [x] Events API — create, list, view, update, with admin auth on the write endpoints
- [x] Registration frontend — browse, select, register, see the reference number
- [x] Backend validation + capacity enforcement (race-safe, under a row lock)
- [x] `POST /api/webhooks/ticketing` — HMAC-signed, idempotent, updates registration status
- [x] Frontend demonstrates the full flow, including the live status change
- [x] Webhook security (HMAC-SHA256) + duplicate handling, explained above
- [x] Relational DB — events, registrations, webhook_events, with FKs/unique constraints/indexes
- [x] `AI.md`
- [x] Automated tests covering all six required scenarios plus extras
- [x] API documentation (`docs/api.md` + Postman collection)
- [x] Architecture/decisions/known-limitations/scaling answer
- [x] `.env.example` for both backend and frontend, `.env` never committed
- [x] Migrations + seed/demo data
- [x] Live HTTPS URL, confirmed reachable
- [x] Test/admin credentials sent outside the repo, in the submission message
