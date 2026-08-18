<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\RegistrationRepository;
use App\Repositories\WebhookEventRepository;
use PDO;

/**
 * Everything the dashboard needs, in one request.
 *
 * Deliberately one endpoint rather than five. The dashboard polls, and five
 * polled endpoints is five times the connections, five round trips before the
 * screen agrees with itself, and five chances for one to fail and leave the
 * page half-stale. The counts are cheap aggregates over indexed columns.
 */
final class DashboardController
{
    private const RECENT_LIMIT = 8;

    private function db(): PDO
    {
        return Database::connection();
    }

    /** POST /api/dashboard/summary — admin. */
    public function summary(Request $request): Response
    {
        return Response::success([
            'stats' => $this->stats(),
            'recent_registrations' => $this->recentRegistrations(),
            'recent_webhooks' => $this->recentWebhooks(),
            // The client compares this against its previous poll to work out
            // what is new. Taken from the database, not the browser, so a
            // clock skewed by a few minutes cannot hide arrivals.
            'server_time' => date('Y-m-d H:i:s'),
        ]);
    }

    /** @return array<string, int> */
    private function stats(): array
    {
        $one = fn (string $sql): int => (int) $this->db()->query($sql)->fetchColumn();

        return [
            'total_events' => $one('SELECT COUNT(*) FROM events'),
            'published_events' => $one("SELECT COUNT(*) FROM events WHERE status = 'published'"),
            'total_registrations' => $one('SELECT COUNT(*) FROM registrations'),
            'pending_registrations' => $one("SELECT COUNT(*) FROM registrations WHERE status = 'pending'"),
            'confirmed_registrations' => $one("SELECT COUNT(*) FROM registrations WHERE status = 'confirmed'"),
            'registrations_last_24h' => $one(
                'SELECT COUNT(*) FROM registrations WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)',
            ),
            'webhooks_last_24h' => $one(
                'SELECT COUNT(*) FROM webhook_events WHERE received_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)',
            ),
            // Duplicates are not failures — they are the idempotency guard
            // doing its job — so they are not counted as rejected.
            'webhooks_rejected' => $one(
                "SELECT COUNT(*) FROM webhook_events
                  WHERE received_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
                    AND status IN ('invalid_signature', 'failed')",
            ),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function recentRegistrations(): array
    {
        $statement = $this->db()->prepare(
            'SELECT r.*, e.name AS event_name, e.event_date, e.venue
               FROM registrations r
               INNER JOIN events e ON e.id = r.event_id
              ORDER BY r.created_at DESC, r.id DESC
              LIMIT :limit',
        );
        $statement->bindValue(':limit', self::RECENT_LIMIT, PDO::PARAM_INT);
        $statement->execute();

        return array_map(RegistrationRepository::shape(...), $statement->fetchAll());
    }

    /** @return list<array<string, mixed>> */
    private function recentWebhooks(): array
    {
        $statement = $this->db()->prepare(
            'SELECT * FROM webhook_events ORDER BY received_at DESC, id DESC LIMIT :limit',
        );
        $statement->bindValue(':limit', self::RECENT_LIMIT, PDO::PARAM_INT);
        $statement->execute();

        return array_map(WebhookEventRepository::shape(...), $statement->fetchAll());
    }
}
