<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

final class UserRepository
{
    private function db(): PDO
    {
        return Database::connection();
    }

    /**
     * One field accepts either an email address or a username, because the
     * sign-in form offers one box for both.
     *
     * @return array<string, mixed>|null
     */
    public function findByIdentifier(string $identifier): ?array
    {
        // Two placeholders for one value on purpose: with emulated prepares
        // turned off, the driver sends the statement to MySQL as-is and a named
        // parameter may only appear once.
        $statement = $this->db()->prepare(
            'SELECT * FROM users WHERE email = :email OR username = :username LIMIT 1',
        );
        $statement->execute(['email' => $identifier, 'username' => $identifier]);
        $user = $statement->fetch();

        return $user === false ? null : $user;
    }

    /** @return array<string, mixed>|null */
    public function findById(int $id): ?array
    {
        $statement = $this->db()->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
        $statement->execute([$id]);
        $user = $statement->fetch();

        return $user === false ? null : $user;
    }

    public function registerFailedAttempt(int $userId, int $maxAttempts, int $lockoutSeconds): void
    {
        // Increment and lock in one statement so simultaneous attempts cannot
        // both read the same count and each think they are the first.
        $statement = $this->db()->prepare(
            'UPDATE users
                SET failed_attempts = failed_attempts + 1,
                    locked_until = CASE
                        WHEN failed_attempts + 1 >= :max THEN DATE_ADD(NOW(), INTERVAL :seconds SECOND)
                        ELSE locked_until
                    END
              WHERE id = :id',
        );
        $statement->execute(['max' => $maxAttempts, 'seconds' => $lockoutSeconds, 'id' => $userId]);
    }

    public function registerSuccessfulLogin(int $userId): void
    {
        $statement = $this->db()->prepare(
            'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
        );
        $statement->execute([$userId]);
    }

    public function updatePasswordHash(int $userId, string $hash): void
    {
        $statement = $this->db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
        $statement->execute([$hash, $userId]);
    }

    /**
     * What the API is willing to say about a user. The hash and the lockout
     * bookkeeping never leave the server.
     *
     * @param array<string, mixed> $user
     *
     * @return array<string, mixed>
     */
    public static function publicShape(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role'],
        ];
    }
}
