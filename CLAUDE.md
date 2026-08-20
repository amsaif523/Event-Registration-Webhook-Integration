# CLAUDE.md

Working context for this project. Read this before touching any code.

---

## 1. What we are building

A small **Event Registration & Webhook Integration** application, submitted as a technical
assignment for a Full-Stack Developer role.

The flow the reviewer must be able to see end to end:

1. User opens the site and sees a list of available events.
2. User selects an event and submits a registration form.
3. Backend validates the data, enforces event capacity, creates the registration with status
   `pending` and returns a unique reference number (e.g. `EVT-7QK3M2XD`).
4. An external ticketing system (simulated) POSTs a signed webhook to
   `POST /api/webhooks/ticketing`.
5. Backend verifies the signature, rejects duplicates, and flips the registration to
   `confirmed` with a ticket id.
6. Frontend shows the updated status without a manual refresh.

The reviewer will open a public URL and test this without setting anything up locally, and will
also try to clone the repo and run it from the README alone.

---

## 2. Tech stack (locked, do not change)

| Layer | Choice |
|---|---|
| Backend | **Plain PHP 8.2+**, no framework |
| Autoloading | Composer PSR-4 (`App\` -> `backend/src/`) |
| Database | **MySQL 8 / MariaDB 10.4+** (XAMPP default is MariaDB) |
| DB access | **PDO** with prepared statements only |
| Frontend | **React 18 + Vite**, plain JavaScript (or TypeScript if we decide in Phase 5) |
| Styling | Tailwind CSS |
| Tests | **PHPUnit 10** (dev dependency only) |
| Local server | **XAMPP** (Apache) primary, IIS supported as alternative |
| Deployment | Shared hosting / VPS with Apache + PHP 8.2 + MySQL |

Explicitly **not** used: Laravel, Docker, Node backend, ORM, Redis, queues.

Composer is used only for PSR-4 autoloading and PHPUnit. It is not a framework and does not
break the "plain PHP" constraint. If the reviewer's environment has no Composer, the README will
document a fallback `require`-based autoloader.

---

## 3. Hard requirements checklist (from the assignment PDF)

Tick these off before submission.

- [x] Events API: create, list, view, update
- [x] Event fields: name, description, date, capacity, status
- [x] Registration frontend: view events, select, submit form, see reference number
- [x] Registration fields: first name, last name, email, phone
- [x] Backend validation + capacity cannot be exceeded
- [x] `POST /api/webhooks/ticketing` updates registration status
- [x] Frontend demonstrates the full flow including the status change
- [x] Webhook security: shared secret / HMAC signature
- [x] Duplicate webhook handling + approach explained in README
- [x] Relational DB with tables for events, registrations, webhook events/logs
- [x] Relationships, indexes, unique constraints
- [x] `AI.md` documenting where AI was used, accepted, rejected, and why
- [x] Tests: successful registration, validation failure, capacity, successful webhook,
      invalid signature, duplicate webhook
- [x] Public working HTTPS URL, live throughout evaluation
- [ ] Test/admin credentials provided (outside the repo)
- [x] Full local setup instructions in README
- [x] Migrations + seed/demo data
- [x] API documentation
- [x] Architecture/flow explanation, technical decisions, known limitations
- [x] `.env.example` committed, `.env` never committed
- [x] Answer to the "thousands of users" question

---

## 4. Folder structure

```
event-registration/
├── backend/
│   ├── public/                     # Apache DocumentRoot points here
│   │   ├── index.php               # single front controller, all requests enter here
│   │   ├── .htaccess               # rewrite everything to index.php (Apache)
│   │   └── web.config              # same rewrite for IIS
│   ├── src/
│   │   ├── Core/
│   │   │   ├── Env.php             # .env parser, no external dependency
│   │   │   ├── Database.php        # PDO singleton, UTF8MB4, exceptions on
│   │   │   ├── Request.php         # wraps method, path, headers, raw body, JSON body
│   │   │   ├── Response.php        # JSON envelope + status codes
│   │   │   ├── Router.php          # exact path -> handler, no path params anywhere
│   │   │   ├── Validator.php       # rule-based validation, returns field errors
│   │   │   └── Exceptions/         # ValidationException, NotFoundException, etc.
│   │   ├── Controllers/
│   │   │   ├── EventController.php
│   │   │   ├── RegistrationController.php
│   │   │   ├── WebhookController.php
│   │   │   └── DevController.php   # webhook simulator, demo only
│   │   ├── Repositories/
│   │   │   ├── EventRepository.php
│   │   │   ├── RegistrationRepository.php
│   │   │   └── WebhookEventRepository.php
│   │   ├── Services/
│   │   │   ├── RegistrationService.php   # capacity logic, reference generation
│   │   │   ├── WebhookService.php        # signature verify, idempotency, status transition
│   │   │   └── SignatureService.php      # HMAC sign + verify
│   │   ├── Middleware/
│   │   │   └── AdminAuth.php       # protects event write endpoints
│   │   └── routes.php              # route table, read by index.php
│   ├── database/
│   │   ├── migrations/
│   │   │   ├── 001_create_events.sql
│   │   │   ├── 002_create_registrations.sql
│   │   │   └── 003_create_webhook_events.sql
│   │   └── seeds/
│   │       └── 001_demo_data.sql
│   ├── scripts/
│   │   ├── migrate.php             # php scripts/migrate.php
│   │   ├── seed.php                # php scripts/seed.php
│   │   └── send_webhook.php        # CLI helper to fire a signed webhook
│   ├── tests/
│   │   ├── bootstrap.php
│   │   ├── TestCase.php            # boots app against test DB, wraps in transaction
│   │   ├── Feature/
│   │   │   ├── RegistrationTest.php
│   │   │   ├── EventTest.php
│   │   │   └── WebhookTest.php
│   │   └── Unit/
│   │       └── SignatureServiceTest.php
│   ├── composer.json
│   ├── phpunit.xml
│   ├── .env.example
│   └── .gitignore
├── frontend/
│   ├── src/
│   │   ├── api/client.js           # fetch wrapper, base URL from env
│   │   ├── components/             # EventCard, RegistrationForm, StatusBadge, Toast
│   │   ├── pages/
│   │   │   ├── EventsPage.jsx
│   │   │   ├── EventDetailPage.jsx
│   │   │   └── RegistrationStatusPage.jsx
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── vite.config.js              # dev proxy /api -> localhost, avoids CORS
│   └── package.json
├── docs/
│   ├── api.md                      # full endpoint reference
│   └── architecture.md             # flow diagrams, decisions, scaling answer
├── README.md
├── AI.md
└── .gitignore
```

---

## 5. Database schema

### `events`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| name | VARCHAR(255) NOT NULL | |
| description | TEXT NULL | |
| event_date | DATETIME NOT NULL | `date` is a reserved-ish word, use `event_date` |
| capacity | INT UNSIGNED NOT NULL | must be >= 1 |
| status | ENUM('draft','published','closed','cancelled') DEFAULT 'draft' | only `published` is registerable |
| created_at / updated_at | TIMESTAMP | |

Indexes: `idx_status_date (status, event_date)`

### `registrations`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| event_id | BIGINT UNSIGNED NOT NULL | FK -> events(id) ON DELETE CASCADE |
| reference | VARCHAR(20) NOT NULL | **UNIQUE**, format `EVT-XXXXXXXX` |
| first_name / last_name | VARCHAR(100) NOT NULL | |
| email | VARCHAR(255) NOT NULL | |
| phone | VARCHAR(30) NOT NULL | |
| status | ENUM('pending','confirmed','cancelled') DEFAULT 'pending' | |
| ticket_id | VARCHAR(64) NULL | filled by webhook |
| confirmed_at | DATETIME NULL | |
| created_at / updated_at | TIMESTAMP | |

Constraints: `UNIQUE (event_id, email)` so the same person cannot register twice for one event.
Indexes: `idx_event_status (event_id, status)`.

### `webhook_events`
| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED PK | |
| delivery_id | VARCHAR(100) NOT NULL | **UNIQUE**, from `X-Webhook-Id` header, or SHA-256 of raw body if absent |
| event_type | VARCHAR(100) NOT NULL | e.g. `ticket.confirmed` |
| registration_reference | VARCHAR(20) NULL | |
| payload | TEXT NOT NULL | raw request body, stored verbatim |
| signature | VARCHAR(255) NULL | |
| status | ENUM('processed','duplicate','invalid_signature','failed') NOT NULL | |
| error_message | TEXT NULL | |
| received_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | |
| processed_at | DATETIME NULL | |

Every inbound webhook is logged, including rejected ones. That log is the audit trail we point at
during the technical discussion.

> MariaDB note: XAMPP ships MariaDB. Avoid MySQL-8-only syntax (no `JSON` column type, no
> functional indexes, no window functions). Plain `TEXT` for payload keeps both engines happy.

---

## 6. API surface

All responses use one envelope.

Success:
```json
{ "success": true, "data": { } }
```
Error:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "fields": { "email": "Invalid email address" } } }
```

### Rule: no identifiers in URLs. Ever.

No path parameters, no query strings. Every id, reference, filter, and flag travels in the JSON
request body. That makes every endpoint a `POST` with a fixed, literal path.

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/health` | none | none (only GET in the app, carries no identifiers) |
| POST | `/api/events/list` | none | `{ "status": "published" }` optional filters |
| POST | `/api/events/view` | none | `{ "id": 12 }` |
| POST | `/api/events/create` | admin token | full event object |
| POST | `/api/events/update` | admin token | `{ "id": 12, ...changed fields }` |
| POST | `/api/registrations/create` | none | `{ "event_id", "first_name", "last_name", "email", "phone" }` |
| POST | `/api/registrations/status` | none | `{ "reference": "EVT-7QK3M2XD" }` |
| POST | `/api/webhooks/ticketing` | HMAC signature | the ticketing payload |
| POST | `/api/dev/simulate-webhook` | admin token | `{ "reference", "mode": "valid\|bad_signature\|duplicate" }` |

`/api/webhooks/ticketing` keeps that exact path because the assignment specifies it verbatim.

Status codes stay meaningful even though the verb is always POST: 200, 201, 400, 401, 404, 409
(capacity full / already registered), 422 (validation), 500.

**Consequences to handle, not ignore:**
- The router is an exact-match map. No regex, no `{id}` extraction. Simpler and faster.
- Reviewers cannot poke endpoints from the browser address bar, so Phase 8 must ship
  `docs/postman_collection.json` alongside `docs/api.md`.
- The frontend must not put ids in its own URLs either. Selected event lives in React state, and
  the reference is kept in `sessionStorage` so a page refresh on the status screen does not lose
  it. No `/events/12` routes.
- POST responses are not cached by browsers or proxies, which is fine here but means the event
  list re-hits the DB every time.

Status codes: 200, 201, 400, 401, 404, 409 (capacity full / already registered), 422 (validation),
500.

Admin auth is real per-admin accounts: `users` + `refresh_tokens` tables, `password_hash()` +
`password_verify()`, a short-lived JWT access token plus a rotating, revocable refresh token, both
in `HttpOnly` cookies. See `AI.md` for why this replaced the single shared `X-Admin-Token` this
section originally specified.

---



## 7. Build phases

Work strictly in order. Each phase ends with something runnable, and gets its own commit(s).

### Phase 0 - Skeleton and plumbing
**Goal:** an empty but correct app that boots.
- Init git repo, `.gitignore` (must include `.env`, `/vendor`, `/node_modules`, `/dist`).
- `composer init`, PSR-4 autoload, PHPUnit as dev dependency.
- Build `Env`, `Database`, `Request`, `Response`, `Router` (exact-match paths only, no param
  extraction; `Request` exposes the decoded JSON body as the single source of input).
- `public/index.php` front controller, `.htaccess` and `web.config` rewrites.
- `GET /api/health` returns `{"success":true,"data":{"status":"ok","db":"connected"}}`.
- Configure XAMPP vhost with DocumentRoot at `backend/public`.

**Done when:** `http://localhost/api/health` returns green in the browser.

### Phase 1 - Database
**Goal:** schema exists and can be rebuilt from scratch by anyone.
- Write the three migration SQL files per section 5.
- `scripts/migrate.php` (creates `migrations` table, runs unapplied files in order).
- `scripts/seed.php` with 4-5 demo events, including one deliberately near capacity and one
  already full, so the reviewer can hit the capacity rule immediately.

**Done when:** dropping the DB and running migrate + seed reproduces everything.

### Phase 2 - Events API
- `EventRepository`, `EventController`, `Validator` rules.
- List (with `seats_left` computed), view, create, update.
- `AdminAuth` middleware on the write endpoints.

**Done when:** all four endpoints work from a REST client and validation errors return 422 with
field-level messages.

### Phase 3 - Registrations API
- `RegistrationService` with the locking transaction and reference generator.
- Validation: names required and length-bounded, email format, phone format, event must exist and
  be `published`, event date must be in the future.
- 409 responses for "event full" and "already registered with this email".
- `POST /api/registrations/status` taking `{ "reference": "..." }` in the body.

**Done when:** capacity cannot be exceeded even when hammered with parallel requests.

### Phase 4 - Webhook endpoint
- `SignatureService` (sign + verify), `WebhookService`, `WebhookController`.
- Insert-first idempotency, signature verification, timestamp window, guarded status transition.
- Every outcome logged to `webhook_events`.
- `scripts/send_webhook.php <reference>` CLI helper for manual testing.

**Done when:** a valid webhook confirms a registration, a tampered one is rejected with 401 and
logged, and a repeat delivery returns 200 without changing anything.

### Phase 5 - React frontend
- Vite scaffold, Tailwind, API client, dev proxy.
- Events list page with seats remaining and a disabled state for full/unpublished events.
- Event detail + registration form with inline validation mirroring the backend rules.
- Success screen showing the reference number prominently.
- Status page that polls `POST /api/registrations/status` every few seconds and animates the
  transition from Pending to Confirmed.
- Navigation is state-driven, not URL-driven: no ids or references in frontend routes either.
  Selected event id lives in React state, the reference is mirrored into `sessionStorage` so a
  refresh on the status screen recovers rather than dead-ends.
- Loading, empty, and error states everywhere. The rubric explicitly scores usability.

**Done when:** the whole flow works in the browser with no console errors.

### Phase 6 - Webhook simulator in the UI
**Why:** the reviewer opens a public URL. They will not run curl. Without this they cannot see
step 4 of the flow, which is the centre of the assignment.
- A clearly labelled "Simulate ticketing system" panel on the status page.
- It calls `POST /api/dev/simulate-webhook`, which signs the payload **server-side** and dispatches
  it to the real webhook endpoint. The secret never reaches the browser.
- Include buttons for the failure paths too: send with a bad signature, send the same delivery
  twice. Showing the rejections is worth as much as showing the happy path.
- Gate it behind the admin token and a `DEMO_MODE` env flag, and say so in the README.

**Done when:** a reviewer can trigger confirm, invalid-signature, and duplicate from the browser
and watch the log update.

### Phase 7 - Tests
Six required scenarios, plus a few extras:
1. Successful registration returns 201 and a unique reference.
2. Validation failure returns 422 with per-field errors.
3. Registration is rejected once capacity is reached.
4. Valid webhook confirms the registration and writes a `processed` log row.
5. Invalid signature returns 401, registration unchanged, `invalid_signature` logged.
6. Duplicate webhook returns 200, registration unchanged, `duplicate` logged.

Extras worth adding: reference uniqueness, duplicate email per event, signature unit test,
registration blocked on an unpublished event.

Use a separate `*_test` database. Each test runs inside a transaction that is rolled back in
`tearDown`.

**Done when:** `composer test` is green from a clean checkout.

### Phase 8 - Deployment and documentation
- Build the frontend, deploy so that `/` serves the React build and `/api/*` hits PHP.
- HTTPS, run migrations and seeds on the live DB, set a strong `WEBHOOK_SECRET` and `ADMIN_TOKEN`
  in the server `.env`.
- `README.md`: every bullet from section 9 and 10 of the assignment. Do not skip the
  troubleshooting section, it is explicitly requested.
- `AI.md`: written honestly and specifically. Name the tool, the task, what was accepted, and at
  least two concrete things that were rejected with the reasoning. Generic AI.md files are
  transparently generic.
- `docs/api.md`, `docs/architecture.md`, and `docs/postman_collection.json`. The collection is not
  optional: with no ids in URLs, a reviewer cannot exercise the API from a browser address bar,
  and every request needs a JSON body. Ship ready-to-run requests for all nine endpoints,
  including the failing webhook cases.
- Final pass: no secrets in git history, live URL working, credentials sent in the submission
  message rather than the repo.

---

## 8. Conventions

- PHP: PSR-12, `declare(strict_types=1)` at the top of every file, typed properties and return
  types everywhere.
- Classes `PascalCase`, methods `camelCase`, DB columns `snake_case`.
- API JSON keys are `snake_case` to match the DB and the webhook example in the assignment.
- Every SQL query goes through PDO prepared statements. No string interpolation into SQL, ever.
- No `echo`/`print` outside `Response`. One place writes output.
- Errors: throw a typed exception, let the front controller map it to a status code. Controllers
  do not build error responses by hand.
- Controllers read input from `$request->body()` only. Never `$_GET`, never a path segment.
- Commit messages: short imperative, one logical change each. The commit history is part of what
  is being evaluated.

---

## 9. Local environment

**XAMPP (primary)**
- PHP 8.2+, Apache with `mod_rewrite` enabled, MariaDB.
- Virtual host with DocumentRoot at `backend/public`, or place the project so that
  `http://localhost/api/...` reaches the front controller.
- Frontend on `http://localhost:5173` with Vite proxying `/api`.

**IIS (alternative)**
- Requires URL Rewrite module; `web.config` provides the same rule as `.htaccess`.
- PHP via FastCGI.

**Env vars** (`backend/.env.example`)
```
APP_ENV=local
APP_DEBUG=true
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=event_registration
DB_USERNAME=root
DB_PASSWORD=
WEBHOOK_SECRET=change_me_to_a_long_random_string
WEBHOOK_TOLERANCE_SECONDS=300
ADMIN_TOKEN=change_me
DEMO_MODE=true
```

---

## 10. Never do

- Put an id, reference, token, email, or filter in a URL path or query string, on the API or the
  frontend. Everything goes in the body.
- Commit `.env`, real secrets, or the admin token.
- Put `WEBHOOK_SECRET` anywhere the frontend can read it.
- JSON-decode the webhook body before computing the signature.
- Trust `capacity` checks done outside a transaction.
- Leave `APP_DEBUG=true` on the live URL.
- Write an `AI.md` that only lists what AI generated.

---

## 11. README contents checklist

The assignment spells these out bullet by bullet in sections 9 and 10. A reviewer is scoring
"ability to explain and reproduce your work", so treat a missing bullet as a lost mark. Tick each
one off against the finished README.

**Setup instructions (section 9):**
- [x] Required PHP / Node / MySQL / Apache versions, stated exactly
- [x] Repository clone command
- [x] Backend dependency install (`composer install`)
- [x] Frontend dependency install (`npm install`)
- [x] Environment configuration, copying `.env.example` to `.env`, every variable explained
- [x] Database creation and configuration
- [x] Migration command and seed command
- [x] How to start the backend (XAMPP vhost setup, plus IIS notes)
- [x] How to start the frontend (`npm run dev`)
- [x] How to run automated tests
- [x] How to access the application locally, with the exact URLs
- [x] Third-party service setup and API keys, using placeholders
- [x] Demo / test credentials
- [x] Troubleshooting for common issues: `mod_rewrite` off, port 80 taken by IIS or Skype,
      MariaDB vs MySQL differences, 404 on `/api/*`, signature mismatch from trailing whitespace,
      Vite proxy not picking up

**Documentation (section 10):**
- [x] Technologies used
- [x] Installation and setup
- [x] Environment variables
- [x] Database setup
- [x] How to run the application
- [x] API documentation
- [x] Architecture / flow explanation
- [x] Important technical decisions
- [x] Known limitations
- [x] Live / staging URL
- [x] Test credentials

The reviewer's stated bar: clone the repo, follow the README, get it running, without contacting
you. Before submitting, delete your local copy, clone fresh into a new folder, and follow your own
instructions literally. Whatever breaks is what the reviewer will hit.

---
