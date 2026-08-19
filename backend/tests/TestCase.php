<?php

declare(strict_types=1);

namespace Tests;

use App\Core\Database;
use App\Core\Exceptions\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\EventRepository;
use PHPUnit\Framework\TestCase as BaseTestCase;

/**
 * Base for every feature test: a clean database per test, plus a way to fire
 * a request through the real router without a web server involved.
 *
 * That last part isn't a testing trick bolted on afterwards — it's the reason
 * Request is a plain object controllers read from instead of touching
 * $_SERVER/$_GET/$_POST directly (see Core/Request.php). Build one by hand,
 * hand it to the router, and you get exactly the same code path a live HTTP
 * request would take, signature verification and all.
 */
abstract class TestCase extends BaseTestCase
{
    protected EventRepository $events;

    protected function setUp(): void
    {
        parent::setUp();
        $this->events = new EventRepository();
        $this->resetDatabase();
    }

    /**
     * Truncate every table instead of wrapping the test in a transaction that
     * gets rolled back in tearDown().
     *
     * The transaction-rollback approach is the more obvious one, and it's what
     * CLAUDE.md's original test plan called for — but it doesn't actually work
     * against this codebase. RegistrationService and WebhookService each open
     * their own transaction via Database::transaction() while under test, and
     * PDO does not support nested transactions: a second beginTransaction() on
     * a connection that already has one open throws. Wrapping the whole test in
     * an outer transaction would break the very first test that registers
     * anyone or processes a webhook.
     *
     * Truncating a dedicated test database before every test gives the same
     * guarantee — nothing carries over between tests — without fighting the
     * app's own transaction boundaries.
     */
    private function resetDatabase(): void
    {
        $pdo = Database::connection();
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach (['webhook_events', 'registrations', 'refresh_tokens', 'events', 'users'] as $table) {
            $pdo->exec("TRUNCATE TABLE {$table}");
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    /**
     * A published event, ten days out, with room for ten. Override whatever
     * a given test actually cares about.
     *
     * @param array<string, mixed> $overrides
     *
     * @return array<string, mixed>
     */
    protected function createEvent(array $overrides = []): array
    {
        $id = $this->events->create(array_merge([
            'name' => 'Test Event',
            'description' => 'An event created for a test.',
            'event_date' => date('Y-m-d H:i:s', strtotime('+30 days')),
            'venue' => 'Test Venue',
            'capacity' => 10,
            'status' => 'published',
        ], $overrides));

        $event = $this->events->find($id);
        if ($event === null) {
            throw new \RuntimeException('Just-created test event could not be read back.');
        }

        return $event;
    }

    /**
     * Dispatches a request through the real route table, replicating only the
     * exception-to-Response mapping public/index.php does for a typed
     * HttpException. Anything else is left to escape and fail the test with
     * its real stack trace, rather than being swallowed into a generic 500 the
     * way production behaves — in a test that difference is exactly what you
     * want to see.
     *
     * @param array<string, string> $headers header names, any case
     */
    protected function dispatch(string $method, string $path, string $rawBody, array $headers = []): Response
    {
        $normalized = ['content-type' => 'application/json'];
        foreach ($headers as $key => $value) {
            $normalized[strtolower($key)] = $value;
        }

        $request = new Request($method, $path, $normalized, $rawBody, [], '127.0.0.1');
        $router = require dirname(__DIR__) . '/src/routes.php';

        try {
            return $router->dispatch($request);
        } catch (HttpException $e) {
            return Response::error($e->status(), $e->errorCode(), $e->getMessage(), $e->fields());
        }
    }

    /**
     * @param array<string, mixed>  $body
     * @param array<string, string> $headers
     */
    protected function post(string $path, array $body, array $headers = []): Response
    {
        return $this->dispatch(
            'POST',
            $path,
            json_encode($body, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            $headers,
        );
    }

    /** Reads a webhook_events row straight from the database, for assertions the API never exposes publicly. */
    protected function fetchWebhookEvent(string $deliveryId): ?array
    {
        $statement = Database::connection()->prepare('SELECT * FROM webhook_events WHERE delivery_id = ?');
        $statement->execute([$deliveryId]);
        $row = $statement->fetch();

        return $row === false ? null : $row;
    }
}
