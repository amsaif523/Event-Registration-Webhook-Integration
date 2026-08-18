<?php

declare(strict_types=1);

/**
 * The route table.
 *
 * Every path is literal and every endpoint except /api/health is POST, because
 * identifiers travel in the body and never in the URL (CLAUDE.md sections 6
 * and 11). The router is therefore an exact-match lookup with no parameter
 * extraction anywhere.
 *
 * Middleware runs left to right and returns the request, so a layer can attach
 * state to it — Authenticate puts the user id on the request for controllers
 * to read.
 */

use App\Controllers\AuthController;
use App\Controllers\DashboardController;
use App\Controllers\DevController;
use App\Controllers\EventController;
use App\Controllers\HealthController;
use App\Controllers\RegistrationController;
use App\Controllers\WebhookController;
use App\Core\Router;
use App\Middleware\Authenticate;
use App\Middleware\RequireJson;

$router = new Router();

$json = new RequireJson();
$auth = new Authenticate();

/** Protected: must be signed in, and must be a JSON request. */
$protected = [$json, $auth];

/* ------------------------------------------------------------------ health */

$router->get('/api/health', new HealthController());

/* -------------------------------------------------------------------- auth */

$authController = new AuthController();

$router->post('/api/auth/login', $authController->login(...), [$json]);
// Deliberately not behind Authenticate: the whole point of refreshing is that
// the access token has expired, so requiring a valid one would deadlock.
$router->post('/api/auth/refresh', $authController->refresh(...), [$json]);
// Also unauthenticated, so signing out still works with a dead access token.
$router->post('/api/auth/logout', $authController->logout(...), [$json]);
$router->post('/api/auth/me', $authController->me(...), $protected);
$router->post('/api/auth/logout-everywhere', $authController->logoutEverywhere(...), $protected);

/* ------------------------------------------------------------------ events */

$events = new EventController();

// Public: published events only, whatever the client asks for.
$router->post('/api/events/list', $events->publicList(...), [$json]);
$router->post('/api/events/view', $events->view(...), [$json]);

// Admin: every status, and the write endpoints.
$router->post('/api/events/admin-list', $events->adminList(...), $protected);
// Same handler as the public view, but reached through Authenticate, so the
// request carries a user and drafts are visible. Without this route the staff
// branch in the controller could never be true.
$router->post('/api/events/admin-view', $events->view(...), $protected);
$router->post('/api/events/create', $events->create(...), $protected);
$router->post('/api/events/update', $events->update(...), $protected);

/* ----------------------------------------------------------- registrations */

$registrations = new RegistrationController();

$router->post('/api/registrations/create', $registrations->create(...), [$json]);
$router->post('/api/registrations/status', $registrations->status(...), [$json]);
// Admin only: this returns every registrant's name, email and phone.
$router->post('/api/registrations/list', $registrations->list(...), $protected);

/* ---------------------------------------------------------------- webhooks */

$webhooks = new WebhookController();

/**
 * Unauthenticated on purpose. The caller is another server, not a browser
 * session, and it proves itself with an HMAC signature over the raw body.
 * RequireJson is not applied either: we do not control what content-type the
 * ticketing provider sends, and the signature is the thing that matters.
 */
$router->post('/api/webhooks/ticketing', $webhooks->ticketing(...));
$router->post('/api/webhooks/list', $webhooks->list(...), $protected);

/* --------------------------------------------------------------- dashboard */

// One call for the whole screen: counts, recent registrations, recent
// deliveries. The dashboard polls it, and polling five endpoints instead of
// one would be five times the traffic for a page that must agree with itself.
$router->post('/api/dashboard/summary', (new DashboardController())->summary(...), $protected);

/* ------------------------------------------------------------------- demo */

$router->post('/api/dev/simulate-webhook', (new DevController())->simulateWebhook(...), $protected);

return $router;
