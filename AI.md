# AI.md

I built this with Claude (Anthropic's Claude Code CLI) as my day-to-day pair programmer, not as a
one-off "generate me an app" prompt. This is an honest account of where it actually helped, what I
kept as-is, and — this is the part generic AI.md files skip — what it got wrong or what I
deliberately overrode, and why.

## Where I used it

- **Planning the architecture before writing code.** `CLAUDE.md` at the repo root is the working
  design doc the whole build followed — folder structure, database schema, API shape, the phase
  order. I worked that out in conversation with Claude before touching a single file, specifically
  so that decisions like "no identifiers in URLs" or "row-lock the capacity check" were made once,
  deliberately, instead of getting improvised differently in five different controllers later.
- **The backend core** — `Request`, `Response`, `Router`, `Validator`, `Database`, the exception
  hierarchy. This is the part of a no-framework project where it's easiest to accidentally
  reinvent something worse than what a framework gives you for free, so I leaned on Claude heavily
  here and then read every line of what came back.
- **The two race conditions** — the capacity check in `RegistrationService` and the idempotency
  claim in `WebhookService`. I asked it directly: "what's wrong with counting registrations and
  then inserting," and "what's wrong with checking if a delivery id exists and then inserting it."
  Both answers (row lock with `FOR UPDATE`; insert-first and let the unique index decide) are now
  load-bearing parts of the app, not just commentary.
- **The auth system.** I asked for a JWT-based admin session, and specifically asked it to explain
  the tradeoff between a pure stateless JWT and something revocable, since the assignment's own
  plan (see below) only asked for a single shared token.
- **The React frontend**, including the admin panel, the webhook simulator panel, and the
  state-driven navigation (no react-router, since the "no ids in URLs" rule applies there too).
- **Documentation** — `docs/api.md`, `docs/architecture.md`, this file, and the README. I asked for
  these to be written from the actual code, not from the plan doc, specifically so they wouldn't
  describe an API that doesn't exist.
- **The test suite.** I asked for coverage of the six scenarios the brief requires (successful
  registration, validation failure, capacity, successful webhook, invalid signature, duplicate
  webhook) plus a few more that seemed worth having (a stale-timestamp rejection, a cancellation
  that can't be un-done by a late duplicate, the raw-body-vs-re-encoded-JSON signature mismatch as
  a unit test).

## What I accepted

Most of the architecture in `CLAUDE.md` section 7 is Claude's reasoning, which I read, agreed with,
and kept: the front-controller-plus-tiny-router pattern; POST-only endpoints with every identifier
in the request body instead of the URL (the reasoning being that URLs end up in access logs,
browser history, and `Referer` headers — a registration reference in a URL is effectively a bearer
token for someone's contact details sitting in plaintext logs); random, non-sequential reference
numbers so the lookup endpoint can't be walked by incrementing an id; HMAC-SHA256 over the raw
request body with the timestamp bound into the signed material, not just sent alongside it;
insert-first idempotency for the webhook instead of check-then-insert; and returning 200 on a
duplicate webhook rather than an error, since a real sender retries anything that looks like
failure.

I also accepted its suggestion to write every SQL migration as raw `.sql` rather than through an
ORM's migration DSL — the assignment is partly about proving I can write correct SQL by hand, and a
generated migration doesn't demonstrate that either way.

## What I changed or rejected, and why

**The admin auth model.** `CLAUDE.md` originally specified a single shared `ADMIN_TOKEN` compared
with `hash_equals`, sent as an `X-Admin-Token` header — simple, and honestly enough for what the
brief asks. I decided that was worth replacing with real accounts once there was an actual admin
panel with a login screen in front of it; a shared token doesn't handle "which admin did this" or
"revoke one compromised session without changing a secret everyone else also needs." What's in the
repo now — `users` and `refresh_tokens` tables, HS256 JWTs, refresh-token rotation, reuse detection
— replaced that plan. The comment at the top of
`backend/database/migrations/004_create_users.sql` says exactly this: *"CLAUDE.md section 6
specified a single shared ADMIN_TOKEN and listed real accounts under known limitations. This
replaces that."* I kept that comment in rather than cleaning it up, because it's an honest record
of the decision changing mid-build, not a mistake to hide.

**How the test suite isolates each test from the last.** The original plan (`CLAUDE.md`'s Phase 7)
was: wrap every test in a database transaction, roll it back in `tearDown()`. That's the standard
pattern and it's what I asked for first. It doesn't actually work against this codebase, though —
`RegistrationService::register()` and `WebhookService::handle()` each open their own transaction
via `Database::transaction()`, and PDO does not support nested transactions on one connection; a
second `beginTransaction()` while one is already open throws. The very first feature test that
registered anyone would have failed with a PDO error that has nothing to do with the thing being
tested. I caught this while writing `backend/tests/TestCase.php` and switched to truncating the
relevant tables before every test instead — same guarantee (every test starts from nothing),
without fighting the app's own transaction boundaries. `TestCase::resetDatabase()` has the full
explanation in its doc comment.

**Raw-body signing, the hard way.** An early pass at the webhook signature code computed the HMAC
over `json_encode($decodedPayload)` rather than the untouched request body — which works fine right
up until the sender's JSON formatting differs even slightly from PHP's default `json_encode`
output (different key order, different whitespace, escaped vs. unescaped slashes), at which point
every signature fails for reasons that look like a secret mismatch but aren't. I pushed back on
this once I understood why, and the fix — capture and sign the raw bytes from
`php://input` *before* anything decodes them, which is why `Request::rawBody()` exists as a
separate thing from `Request::body()` — is called out deliberately in comments in `Request.php`,
`SignatureService.php`, and `WebhookService.php`, and there's a dedicated unit test for exactly
this failure mode in `tests/Unit/SignatureServiceTest.php`
(`test_re_encoding_the_body_before_signing_produces_a_different_signature`). This is the one I'd
point to as the actual "diagnosed and fixed a real problem" story if asked about it in the
interview, per the brief's problem-solving criterion.
