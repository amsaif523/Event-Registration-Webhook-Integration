<?php

declare(strict_types=1);

/**
 * Front controller. Every request enters here.
 *
 * Its whole job: build a Request, dispatch it, and turn whatever comes back —
 * including a thrown exception — into one JSON envelope. Controllers never
 * build an error response by hand and nothing else in the app writes output.
 */

use App\Core\Env;
use App\Core\Exceptions\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

$root = require dirname(__DIR__) . '/bootstrap.php';

$debug = Env::bool('APP_DEBUG', false);

// Errors are reported as JSON, never rendered into the response body, or a
// stray warning would corrupt the payload the client is trying to parse.
ini_set('display_errors', '0');
error_reporting(E_ALL);

$request = Request::fromGlobals();

// Optional access log, off unless EVENTIDE_ACCESS_LOG points somewhere. Used to
// count what the browser actually asks for.
if (($accessLog = getenv('EVENTIDE_ACCESS_LOG')) !== false && $accessLog !== '') {
    file_put_contents(
        $accessLog,
        sprintf("%s %s %s\n", date('H:i:s'), $request->method(), $request->path()),
        FILE_APPEND,
    );
}

try {
    /** @var Router $router */
    $router = require $root . '/src/routes.php';

    $response = $router->dispatch($request);
} catch (HttpException $e) {
    // Expected failures: validation, auth, conflicts, not-found. These are part
    // of the API's contract, so they carry a stable code the frontend switches on.
    $response = Response::error($e->status(), $e->errorCode(), $e->getMessage(), $e->fields());
} catch (PDOException $e) {
    error_log('[eventide] database error: ' . $e->getMessage());

    $response = Response::error(
        500,
        'DATABASE_ERROR',
        $debug
            ? $e->getMessage()
            : 'The database is not reachable right now. Please try again.',
    );
} catch (Throwable $e) {
    // Unexpected. Log everything, tell the client nothing: a stack trace in a
    // response is a map of the application for whoever is probing it.
    error_log(sprintf(
        '[eventide] %s: %s in %s:%d',
        $e::class,
        $e->getMessage(),
        $e->getFile(),
        $e->getLine(),
    ));

    $response = Response::error(
        500,
        'SERVER_ERROR',
        $debug ? $e->getMessage() : 'Something went wrong on our end.',
    );
}

$response->send();
