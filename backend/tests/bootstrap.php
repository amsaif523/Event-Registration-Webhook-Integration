<?php

declare(strict_types=1);

/**
 * Boots the app for PHPUnit, then repoints the shared PDO connection at a
 * separate test database (DB_TEST_DATABASE) and brings its schema up to date.
 *
 * Migrations are (re)applied here, every run, rather than requiring a separate
 * `migrate.php --test` step first. That's the same instinct as bootstrap.php's
 * Composer fallback: a reviewer who clones the repo and runs `composer test`
 * should not need a hidden extra step nobody told them about.
 */

use App\Core\Database;
use App\Core\Env;

$root = require dirname(__DIR__) . '/bootstrap.php';

$testDatabase = Env::require('DB_TEST_DATABASE');

$server = Database::serverConnection();
$server->exec(
    "CREATE DATABASE IF NOT EXISTS `{$testDatabase}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
);

$pdo = Database::connect($testDatabase);
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

foreach ($files as $file) {
    $name = basename($file);
    if (in_array($name, $applied, true)) {
        continue;
    }

    $sql = file_get_contents($file);
    if ($sql === false || trim($sql) === '') {
        continue;
    }

    $pdo->exec($sql);
    $statement = $pdo->prepare('INSERT INTO migrations (migration) VALUES (?)');
    $statement->execute([$name]);
}
