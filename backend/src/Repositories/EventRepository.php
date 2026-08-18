<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

/**
 * Events, including the list query the admin tables depend on.
 *
 * `seats_taken` is derived from the registrations table rather than kept as a
 * counter column. A denormalised counter is one more thing that can drift out
 * of step with reality, and at this scale the subquery costs nothing. When it
 * does start to cost something, that is the moment to add the counter and a
 * trigger — noted in the scaling answer, not pre-empted here.
 */
final class EventRepository
{
    /**
     * Columns the client is allowed to sort by.
     *
     * An allow-list, because identifiers cannot be bound as parameters: a
     * sort column interpolated straight from the request body is an SQL
     * injection, and this is the standard way to close it.
     */
    private const SORTABLE = [
        'name' => 'e.name',
        'event_date' => 'e.event_date',
        'venue' => 'e.venue',
        'capacity' => 'e.capacity',
        'seats_taken' => 'seats_taken',
        'status' => 'e.status',
        'created_at' => 'e.created_at',
    ];

    private const SELECT = 'SELECT e.*,
            (SELECT COUNT(*) FROM registrations r
              WHERE r.event_id = e.id AND r.status <> \'cancelled\') AS seats_taken
          FROM events e';

    private function db(): PDO
    {
        return Database::connection();
    }

    /** @return array<string, mixed>|null */
    public function find(int $id): ?array
    {
        $statement = $this->db()->prepare(self::SELECT . ' WHERE e.id = ? LIMIT 1');
        $statement->execute([$id]);
        $row = $statement->fetch();

        return $row === false ? null : self::shape($row);
    }

    /**
     * Locks the event row for the duration of the surrounding transaction.
     *
     * This is the capacity check's whole defence. Counting registrations and
     * then inserting is a race: two requests both read 49 of 50 and both
     * insert. Taking a row lock on the event serialises them, so the second
     * waits, re-reads 50, and is refused.
     *
     * @return array<string, mixed>|null
     */
    public function findForUpdate(int $id): ?array
    {
        $statement = $this->db()->prepare(self::SELECT . ' WHERE e.id = ? FOR UPDATE');
        $statement->execute([$id]);
        $row = $statement->fetch();

        return $row === false ? null : self::shape($row);
    }

    /**
     * The list query: filter, search, count, sort, paginate — in that order.
     *
     * The order matters and is not interchangeable. Counting before pagination
     * is what lets the client know how many pages exist; searching before
     * pagination is what stops the search seeing only the current page.
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
            $conditions[] = 'e.status = :status';
            $bindings['status'] = $status;
        }

        // The public list only ever sees published events; the admin list sees
        // everything. The caller decides, not the client.
        if (($query['published_only'] ?? false) === true) {
            $conditions[] = "e.status = 'published'";
        }

        $search = trim((string) ($query['search'] ?? ''));
        if ($search !== '') {
            $conditions[] = '(e.name LIKE :search_name OR e.venue LIKE :search_venue OR e.description LIKE :search_description)';
            $like = '%' . self::escapeLike($search) . '%';
            $bindings['search_name'] = $like;
            $bindings['search_venue'] = $like;
            $bindings['search_description'] = $like;
        }

        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);

        $countStatement = $this->db()->prepare('SELECT COUNT(*) FROM events e' . $where);
        $countStatement->execute($bindings);
        $total = (int) $countStatement->fetchColumn();

        [$column, $direction] = self::resolveSort($query);
        [$limit, $offset, $page, $perPage, $totalPages] = self::resolvePage($query, $total);

        $sql = self::SELECT . $where . sprintf(' ORDER BY %s %s, e.id DESC', $column, $direction);
        if ($limit !== null) {
            $sql .= ' LIMIT :limit OFFSET :offset';
        }

        $statement = $this->db()->prepare($sql);
        foreach ($bindings as $key => $value) {
            $statement->bindValue(':' . $key, $value, PDO::PARAM_STR);
        }
        if ($limit !== null) {
            // Bound as integers: with emulated prepares off, LIMIT will not
            // accept a quoted string.
            $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
            $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
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

    /** @param array<string, mixed> $data */
    public function create(array $data): int
    {
        $statement = $this->db()->prepare(
            'INSERT INTO events (name, description, event_date, venue, capacity, status)
             VALUES (:name, :description, :event_date, :venue, :capacity, :status)',
        );
        $statement->execute([
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'event_date' => $data['event_date'],
            'venue' => $data['venue'],
            'capacity' => (int) $data['capacity'],
            'status' => $data['status'] ?? 'draft',
        ]);

        return (int) $this->db()->lastInsertId();
    }

    /**
     * Partial update: only the columns actually supplied are touched, so
     * sending {id, status} does not blank the description.
     *
     * @param array<string, mixed> $data
     */
    public function update(int $id, array $data): void
    {
        $allowed = ['name', 'description', 'event_date', 'venue', 'capacity', 'status'];
        $sets = [];
        $bindings = ['id' => $id];

        foreach ($allowed as $column) {
            if (array_key_exists($column, $data)) {
                $sets[] = "{$column} = :{$column}";
                $bindings[$column] = $column === 'capacity' ? (int) $data[$column] : $data[$column];
            }
        }

        if ($sets === []) {
            return;
        }

        $statement = $this->db()->prepare(
            'UPDATE events SET ' . implode(', ', $sets) . ' WHERE id = :id',
        );
        $statement->execute($bindings);
    }

    /**
     * Normalise a row for the API: real types, and the derived seat figures the
     * frontend renders.
     *
     * @param array<string, mixed> $row
     *
     * @return array<string, mixed>
     */
    public static function shape(array $row): array
    {
        $capacity = (int) $row['capacity'];
        $taken = (int) ($row['seats_taken'] ?? 0);

        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'description' => $row['description'],
            'event_date' => $row['event_date'],
            'venue' => $row['venue'],
            'capacity' => $capacity,
            'seats_taken' => $taken,
            'seats_left' => max($capacity - $taken, 0),
            'status' => $row['status'],
            'created_at' => $row['created_at'] ?? null,
            'updated_at' => $row['updated_at'] ?? null,
        ];
    }

    /** @return array{0: string, 1: string} */
    private static function resolveSort(array $query): array
    {
        $requested = (string) ($query['sort_by'] ?? 'event_date');
        $column = self::SORTABLE[$requested] ?? self::SORTABLE['event_date'];
        $direction = strtolower((string) ($query['sort_dir'] ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';

        return [$column, $direction];
    }

    /**
     * @return array{0: int|null, 1: int, 2: int, 3: mixed, 4: int}
     */
    private static function resolvePage(array $query, int $total): array
    {
        $perPage = $query['per_page'] ?? 10;

        // 'all' or 0 means no pagination, matching the "Show all" option.
        if ($perPage === 'all' || (int) $perPage === 0) {
            return [null, 0, 1, $perPage, 1];
        }

        $size = max(1, min((int) $perPage, 200));
        $totalPages = max((int) ceil($total / $size), 1);
        $page = max(1, min((int) ($query['page'] ?? 1), $totalPages));

        return [$size, ($page - 1) * $size, $page, $size, $totalPages];
    }

    /** LIKE treats % and _ as wildcards; a search for "50%" should mean "50%". */
    private static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $value);
    }
}
