<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;
use PDOException;

final class WebhookEventRepository
{
    private const SORTABLE = [
        'received_at' => 'received_at',
        'event_type' => 'event_type',
        'delivery_id' => 'delivery_id',
        'registration_reference' => 'registration_reference',
        'status' => 'status',
    ];

    private function db(): PDO
    {
        return Database::connection();
    }

    /**
     * Claim a delivery id, or report that it was already taken.
     *
     * This is the idempotency mechanism, and it is an INSERT rather than a
     * SELECT-then-INSERT on purpose. Checking first and inserting after has the
     * same race as the capacity check: two copies of the same delivery both
     * look, both see nothing, and both process. Inserting first makes the
     * database's unique index the arbiter — exactly one INSERT can win, and the
     * loser gets a duplicate-key error, which is the answer we wanted.
     *
     * @return bool true when this delivery is new, false when it is a repeat
     */
    public function claim(string $deliveryId, string $eventType, ?string $reference, string $payload, ?string $signature): bool
    {
        try {
            $statement = $this->db()->prepare(
                "INSERT INTO webhook_events
                    (delivery_id, event_type, registration_reference, payload, signature, status)
                 VALUES (:delivery_id, :event_type, :reference, :payload, :signature, 'failed')",
            );
            $statement->execute([
                'delivery_id' => $deliveryId,
                'event_type' => $eventType,
                'reference' => $reference,
                'payload' => $payload,
                'signature' => $signature,
            ]);

            return true;
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                return false;
            }

            throw $e;
        }
    }

    /** Log a delivery that never got as far as claiming an id. */
    public function log(
        string $deliveryId,
        string $eventType,
        ?string $reference,
        string $payload,
        ?string $signature,
        string $status,
        ?string $error = null,
    ): void {
        $statement = $this->db()->prepare(
            'INSERT INTO webhook_events
                (delivery_id, event_type, registration_reference, payload, signature, status, error_message)
             VALUES (:delivery_id, :event_type, :reference, :payload, :signature, :status, :error)
             ON DUPLICATE KEY UPDATE status = VALUES(status), error_message = VALUES(error_message)',
        );
        $statement->execute([
            'delivery_id' => $deliveryId,
            'event_type' => $eventType,
            'reference' => $reference,
            'payload' => $payload,
            'signature' => $signature,
            'status' => $status,
            'error' => $error,
        ]);
    }

    public function markProcessed(string $deliveryId): void
    {
        $statement = $this->db()->prepare(
            "UPDATE webhook_events SET status = 'processed', processed_at = NOW(), error_message = NULL
              WHERE delivery_id = ?",
        );
        $statement->execute([$deliveryId]);
    }

    public function markFailed(string $deliveryId, string $error): void
    {
        $statement = $this->db()->prepare(
            "UPDATE webhook_events SET status = 'failed', error_message = ? WHERE delivery_id = ?",
        );
        $statement->execute([$error, $deliveryId]);
    }

    /** @return array<string, mixed>|null */
    public function findByDeliveryId(string $deliveryId): ?array
    {
        $statement = $this->db()->prepare('SELECT * FROM webhook_events WHERE delivery_id = ? LIMIT 1');
        $statement->execute([$deliveryId]);
        $row = $statement->fetch();

        return $row === false ? null : self::shape($row);
    }

    /**
     * @param array<string, mixed> $query
     *
     * @return array{items: list<array<string, mixed>>, total: int, page: int, per_page: mixed, total_pages: int}
     */
    public function paginate(array $query): array
    {
        $conditions = [];
        $bindings = [];

        $status = $query['status'] ?? null;
        if (is_string($status) && $status !== '' && $status !== 'all') {
            $conditions[] = 'status = :status';
            $bindings['status'] = $status;
        }

        $reference = $query['registration_reference'] ?? null;
        if (is_string($reference) && $reference !== '') {
            $conditions[] = 'registration_reference = :reference';
            $bindings['reference'] = strtoupper($reference);
        }

        $search = trim((string) ($query['search'] ?? ''));
        if ($search !== '') {
            $conditions[] = '(delivery_id LIKE :s_delivery OR registration_reference LIKE :s_ref'
                . ' OR event_type LIKE :s_type OR error_message LIKE :s_error)';
            $like = '%' . str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $search) . '%';
            $bindings['s_delivery'] = $like;
            $bindings['s_ref'] = $like;
            $bindings['s_type'] = $like;
            $bindings['s_error'] = $like;
        }

        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);

        $countStatement = $this->db()->prepare('SELECT COUNT(*) FROM webhook_events' . $where);
        $countStatement->execute($bindings);
        $total = (int) $countStatement->fetchColumn();

        $column = self::SORTABLE[(string) ($query['sort_by'] ?? 'received_at')] ?? 'received_at';
        $direction = strtolower((string) ($query['sort_dir'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';

        $perPage = $query['per_page'] ?? 10;
        $unpaged = $perPage === 'all' || (int) $perPage === 0;
        $size = $unpaged ? null : max(1, min((int) $perPage, 200));
        $totalPages = $unpaged ? 1 : max((int) ceil($total / $size), 1);
        $page = $unpaged ? 1 : max(1, min((int) ($query['page'] ?? 1), $totalPages));

        $sql = 'SELECT * FROM webhook_events' . $where
            . sprintf(' ORDER BY %s %s, id DESC', $column, $direction);
        if (!$unpaged) {
            $sql .= ' LIMIT :limit OFFSET :offset';
        }

        $statement = $this->db()->prepare($sql);
        foreach ($bindings as $key => $value) {
            $statement->bindValue(':' . $key, $value, PDO::PARAM_STR);
        }
        if (!$unpaged) {
            $statement->bindValue(':limit', $size, PDO::PARAM_INT);
            $statement->bindValue(':offset', ($page - 1) * $size, PDO::PARAM_INT);
        }
        $statement->execute();

        return [
            'items' => array_map(self::shape(...), $statement->fetchAll()),
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => $totalPages,
            // Counts for the status filter's options. Computed here because the
            // client only ever holds one page and cannot count what it has not
            // been sent — and they are counts of the whole table, deliberately
            // ignoring the current status filter, or selecting one status would
            // zero out all the others.
            'status_counts' => $this->statusCounts(),
        ];
    }

    /** @return array<string, int> */
    public function statusCounts(): array
    {
        $counts = ['all' => 0];
        foreach ($this->db()->query('SELECT status, COUNT(*) AS c FROM webhook_events GROUP BY status') as $row) {
            $counts[(string) $row['status']] = (int) $row['c'];
            $counts['all'] += (int) $row['c'];
        }

        return $counts;
    }

    /**
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public static function shape(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'delivery_id' => $row['delivery_id'],
            'event_type' => $row['event_type'],
            'registration_reference' => $row['registration_reference'],
            'payload' => $row['payload'],
            'status' => $row['status'],
            'error_message' => $row['error_message'],
            'received_at' => $row['received_at'],
            'processed_at' => $row['processed_at'],
        ];
    }
}
