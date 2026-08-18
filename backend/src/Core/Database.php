<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

/**
 * PDO connection, shared for the life of the request.
 *
 * Emulated prepares are off so the driver sends real prepared statements and
 * integers bind as integers, which matters for LIMIT/OFFSET.
 */
final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        self::$connection = self::connect(Env::require('DB_DATABASE'));

        return self::$connection;
    }

    public static function connect(string $database): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            Env::get('DB_HOST', '127.0.0.1'),
            Env::get('DB_PORT', '3306'),
            $database,
        );

        return new PDO($dsn, Env::get('DB_USERNAME', 'root'), Env::get('DB_PASSWORD', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
    }

    /** Connect without selecting a database, so one can be created. */
    public static function serverConnection(): PDO
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;charset=utf8mb4',
            Env::get('DB_HOST', '127.0.0.1'),
            Env::get('DB_PORT', '3306'),
        );

        return new PDO($dsn, Env::get('DB_USERNAME', 'root'), Env::get('DB_PASSWORD', ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
    }

    /** Tests swap in their own connection so everything runs against the test database. */
    public static function swap(?PDO $connection): void
    {
        self::$connection = $connection;
    }

    /** Run a closure inside a transaction, rolling back on any throwable. */
    public static function transaction(callable $callback): mixed
    {
        $pdo = self::connection();
        $pdo->beginTransaction();

        try {
            $result = $callback($pdo);
            $pdo->commit();

            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $e;
        }
    }
}
