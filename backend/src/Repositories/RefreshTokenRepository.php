<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Core\Database;
use PDO;

final class RefreshTokenRepository
{
    private function db(): PDO
    {
        return Database::connection();
    }

    /** Tokens are stored hashed. A database dump must not yield live sessions. */
    public static function hash(string $token): string
    {
        return hash('sha256', $token);
    }

    public function store(
        int $userId,
        string $token,
        string $familyId,
        int $expiresAt,
        ?string $userAgent,
        ?string $ip,
    ): void {
        $statement = $this->db()->prepare(
            'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
             VALUES (:user_id, :token_hash, :family_id, :expires_at, :user_agent, :ip)',
        );
        $statement->execute([
            'user_id' => $userId,
            'token_hash' => self::hash($token),
            'family_id' => $familyId,
            'expires_at' => date('Y-m-d H:i:s', $expiresAt),
            'user_agent' => $userAgent,
            'ip' => $ip,
        ]);
    }

    /** @return array<string, mixed>|null */
    public function find(string $token): ?array
    {
        $statement = $this->db()->prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1');
        $statement->execute([self::hash($token)]);
        $row = $statement->fetch();

        return $row === false ? null : $row;
    }

    public function markRotated(string $oldToken, string $newToken): void
    {
        $statement = $this->db()->prepare(
            'UPDATE refresh_tokens
                SET revoked_at = NOW(), replaced_by = :new_hash
              WHERE token_hash = :old_hash',
        );
        $statement->execute([
            'new_hash' => self::hash($newToken),
            'old_hash' => self::hash($oldToken),
        ]);
    }

    public function revoke(string $token): void
    {
        $statement = $this->db()->prepare(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL',
        );
        $statement->execute([self::hash($token)]);
    }

    /**
     * Revoke every token descended from one login.
     *
     * Called when an already-rotated token is presented again. Either it was
     * stolen and the thief is using it, or it was stolen and the legitimate
     * user is. There is no way to tell which, so the safe move is to end the
     * whole family and make everyone sign in again.
     */
    public function revokeFamily(string $familyId): int
    {
        $statement = $this->db()->prepare(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL',
        );
        $statement->execute([$familyId]);

        return $statement->rowCount();
    }

    public function revokeAllForUser(int $userId): int
    {
        $statement = $this->db()->prepare(
            'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        );
        $statement->execute([$userId]);

        return $statement->rowCount();
    }

    /**
     * Is this session still alive?
     *
     * A family stays alive while it holds at least one un-revoked, unexpired
     * token. Rotation keeps that true (the old token is revoked in the same
     * breath as the new one is created); logout makes it false by revoking the
     * whole family at once.
     *
     * This is what lets an access token be killed the instant someone signs
     * out, rather than lingering until it expires. See Authenticate.
     */
    public function familyIsActive(string $familyId): bool
    {
        $statement = $this->db()->prepare(
            'SELECT 1 FROM refresh_tokens
              WHERE family_id = ? AND revoked_at IS NULL AND expires_at > NOW()
              LIMIT 1',
        );
        $statement->execute([$familyId]);

        return $statement->fetchColumn() !== false;
    }

    /** @return array<string, mixed>|null */
    public function findFamilyOfToken(string $token): ?array
    {
        $row = $this->find($token);

        return $row === null ? null : $row;
    }

    /** Housekeeping: expired and long-revoked rows have no further use. */
    public function pruneExpired(): int
    {
        return (int) $this->db()->exec(
            'DELETE FROM refresh_tokens
              WHERE expires_at < NOW()
                 OR (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY))',
        );
    }
}
