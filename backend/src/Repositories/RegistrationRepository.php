<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

final class RegistrationRepository
{
    /** Sort allow-list. Identifiers cannot be bound, so they must be whitelisted. */
    private const SORTABLE = [
        'reference' => 'r.reference',
        'first_name' => 'r.first_name',
        'email' => 'r.email',
        'status' => 'r.status',
        'created_at' => 'r.created_at',
        'confirmed_at' => 'r.confirmed_at',
        'ticket_id' => 'r.ticket_id',
        'event_id' => 'e.name',
    ];

    private const SELECT = 'SELECT r.*, e.name AS event_name, e.event_date, e.venue
          FROM registrations r
          INNER JOIN events e ON e.id = r.event_id';

    private function db(): PDO
    {
        return Database::connection();
    }

    /** @return array<string, mixed>|null */
    public function findByReference(string $reference): ?array
    {
        $statement = $this->db()->prepare(self::SELECT . ' WHERE r.reference = ? LIMIT 1');
        $statement->execute([$reference]);
        $row = $statement->fetch();

        return $row === false ? null : self::shape($row);
    }

    /**
     * Locks the registration row so the webhook's read-check-write cannot
     * interleave with another delivery for the same reference.
     *
     * @return array<string, mixed>|null
     */
    public function findByReferenceForUpdate(string $reference): ?array
    {
        $statement = $this->db()->prepare(
            'SELECT * FROM registrations WHERE reference = ? FOR UPDATE',
        );
        $statement->execute([$reference]);
        $row = $statement->fetch();

        return $row === false ? null : $row;
    }

    /** Seats consumed by an event. Cancelled registrations release their seat. */
    public function countActiveForEvent(int $eventId): int
    {
        $statement = $this->db()->prepare(
            "SELECT COUNT(*) FROM registrations WHERE event_id = ? AND status <> 'cancelled'",
        );
        $statement->execute([$eventId]);

        return (int) $statement->fetchColumn();
    }

    public function existsForEmail(int $eventId, string $email): bool
    {
        $statement = $this->db()->prepare(
            'SELECT 1 FROM registrations WHERE event_id = ? AND email = ? LIMIT 1',
        );
        $statement->execute([$eventId, $email]);

        return $statement->fetchColumn() !== false;
    }

    public function referenceExists(string $reference): bool
    {
        $statement = $this->db()->prepare('SELECT 1 FROM registrations WHERE reference = ? LIMIT 1');
        $statement->execute([$reference]);

        return $statement->fetchColumn() !== false;
    }

    /** @param array<string, mixed> $data */
    public function create(array $data): int
    {
        $statement = $this->db()->prepare(
            'INSERT INTO registrations (event_id, reference, first_name, last_name, email, phone, status)
             VALUES (:event_id, :reference, :first_name, :last_name, :email, :phone, :status)',
        );
        $statement->execute([
            'event_id' => (int) $data['event_id'],
            'reference' => $data['reference'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'status' => $data['status'] ?? 'pending',
        ]);

        return (int) $this->db()->lastInsertId();
    }

    /**
     * The confirming write, guarded in SQL rather than in PHP.
     *
     * `AND status = 'pending'` is the guard: only that transition is allowed,
     * so a late duplicate delivery cannot un-cancel a cancelled registration.
     * Putting it in the WHERE clause means the database enforces it, and the
     * affected-row count tells us whether it applied.
     */
    public function confirm(string $reference, string $ticketId): bool
    {
        $statement = $this->db()->prepare(
            "UPDATE registrations
                SET status = 'confirmed', ticket_id = :ticket_id, confirmed_at = NOW()
              WHERE reference = :reference AND status = 'pending'",
        );
        $statement->execute(['ticket_id' => $ticketId, 'reference' => $reference]);

        return $statement->rowCount() === 1;
    }

    public function cancel(string $reference): bool
    {
        $statement = $this->db()->prepare(
            "UPDATE registrations SET status = 'cancelled'
              WHERE reference = :reference AND status <> 'cancelled'",
        );
        $statement->execute(['reference' => $reference]);

        return $statement->rowCount() === 1;
    }

    /**
     * Admin list: filter, search, count, sort, paginate — in that order.
     *
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
            $conditions[] = 'r.status = :status';
            $bindings['status'] = $status;
        }

        $eventId = $query['event_id'] ?? null;
        if ($eventId !== null && $eventId !== '' && $eventId !== 'all') {
            $conditions[] = 'r.event_id = :event_id';
            $bindings['event_id'] = (int) $eventId;
        }

        $search = trim((string) ($query['search'] ?? ''));
        if ($search !== '') {
            $conditions[] = '(r.reference LIKE :s_ref OR r.email LIKE :s_email OR r.phone LIKE :s_phone'
                . ' OR CONCAT(r.first_name, \' \', r.last_name) LIKE :s_name)';
            $like = '%' . self::escapeLike($search) . '%';
            $bindings['s_ref'] = $like;
            $bindings['s_email'] = $like;
            $bindings['s_phone'] = $like;
            $bindings['s_name'] = $like;
        }

        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);

        $countSql = 'SELECT COUNT(*) FROM registrations r INNER JOIN events e ON e.id = r.event_id' . $where;
        $countStatement = $this->db()->prepare($countSql);
        $countStatement->execute($bindings);
        $total = (int) $countStatement->fetchColumn();

        $column = self::SORTABLE[(string) ($query['sort_by'] ?? 'created_at')] ?? self::SORTABLE['created_at'];
        $direction = strtolower((string) ($query['sort_dir'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';

        $perPage = $query['per_page'] ?? 10;
        $unpaged = $perPage === 'all' || (int) $perPage === 0;
        $size = $unpaged ? null : max(1, min((int) $perPage, 200));
        $totalPages = $unpaged ? 1 : max((int) ceil($total / $size), 1);
        $page = $unpaged ? 1 : max(1, min((int) ($query['page'] ?? 1), $totalPages));

        $sql = self::SELECT . $where . sprintf(' ORDER BY %s %s, r.id DESC', $column, $direction);
        if (!$unpaged) {
            $sql .= ' LIMIT :limit OFFSET :offset';
        }

        $statement = $this->db()->prepare($sql);
        foreach ($bindings as $key => $value) {
            $statement->bindValue(
                ':' . $key,
                $value,
                $key === 'event_id' ? PDO::PARAM_INT : PDO::PARAM_STR,
            );
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
        ];
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
            'event_id' => (int) $row['event_id'],
            'event_name' => $row['event_name'] ?? null,
            'event_date' => $row['event_date'] ?? null,
            'venue' => $row['venue'] ?? null,
            'reference' => $row['reference'],
            'first_name' => $row['first_name'],
            'last_name' => $row['last_name'],
            'email' => $row['email'],
            'phone' => $row['phone'],
            'status' => $row['status'],
            'ticket_id' => $row['ticket_id'],
            'created_at' => $row['created_at'],
            'confirmed_at' => $row['confirmed_at'],
        ];
    }

    private static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $value);
    }
}
