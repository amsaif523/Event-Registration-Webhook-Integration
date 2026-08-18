<?php

declare(strict_types=1);

/**
 * Applies any migration in database/migrations that has not run yet, in
 * filename order, recording each in a `migrations` table.
 *
 * Usage:  php scripts/migrate.php [--fresh] [--test]
 *   --fresh  drop the database and rebuild from nothing
 *   --test   operate on DB_TEST_DATABASE instead of DB_DATABASE
 */

use App\Core\Database;
use App\Core\Env;

$root = require dirname(__DIR__) . '/bootstrap.php';

$fresh = in_array('--fresh', $argv, true);
$useTestDatabase = in_array('--test', $argv, true);

$database = $useTestDatabase
    ? Env::require('DB_TEST_DATABASE')
    : Env::require('DB_DATABASE');

try {
    $server = Database::serverConnection();
} catch (PDOException $e) {
    fwrite(STDERR, "Could not connect to MySQL: {$e->getMessage()}\n");
    fwrite(STDERR, "Check DB_HOST, DB_PORT, DB_USERNAME and DB_PASSWORD in .env\n");
    exit(1);
}

if ($fresh) {
    echo "Dropping database `{$database}`\n";
    $server->exec("DROP DATABASE IF EXISTS `{$database}`");
}

$server->exec(
    "CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
);

$pdo = Database::connect($database);
Database::swap($pdo);

$pdo->exec(
    'CREATE TABLE IF NOT EXISTS migrations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        migration VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_migration (migration)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4',
);

$applied = $pdo->query('SELECT migration FROM migrations')->fetchAll(PDO::FETCH_COLUMN);

$files = glob($root . '/database/migrations/*.sql') ?: [];
sort($files);

$ran = 0;
foreach ($files as $file) {
    $name = basename($file);
    if (in_array($name, $applied, true)) {
        continue;
    }

    $sql = file_get_contents($file);
    if ($sql === false || trim($sql) === '') {
        continue;
    }

    echo "  applying {$name}\n";

    try {
        // DDL cannot be rolled back in MySQL, so a failure part-way through one
        // file leaves it unrecorded and the error is surfaced immediately
        // rather than being half-applied and marked done.
        $pdo->exec($sql);
        $statement = $pdo->prepare('INSERT INTO migrations (migration) VALUES (?)');
        $statement->execute([$name]);
        ++$ran;
    } catch (PDOException $e) {
        fwrite(STDERR, "\nFailed on {$name}: {$e->getMessage()}\n");
        exit(1);
    }
}

echo $ran === 0
    ? "Nothing to migrate; `{$database}` is up to date.\n"
    : "Applied {$ran} migration(s) to `{$database}`.\n";
