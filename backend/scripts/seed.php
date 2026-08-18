<?php

declare(strict_types=1);

/**
 * Loads demo data. Safe to re-run: every seed file is written to be idempotent.
 *
 * Usage:  php scripts/seed.php [--test]
 */

use App\Core\Database;
use App\Core\Env;

$root = require dirname(__DIR__) . '/bootstrap.php';

$useTestDatabase = in_array('--test', $argv, true);
$database = $useTestDatabase ? Env::require('DB_TEST_DATABASE') : Env::require('DB_DATABASE');

try {
    $pdo = Database::connect($database);
} catch (PDOException $e) {
    fwrite(STDERR, "Could not connect to `{$database}`: {$e->getMessage()}\n");
    fwrite(STDERR, "Run `php scripts/migrate.php` first.\n");
    exit(1);
}

Database::swap($pdo);

$files = glob($root . '/database/seeds/*.sql') ?: [];
sort($files);

foreach ($files as $file) {
    echo '  seeding ' . basename($file) . "\n";
    $sql = file_get_contents($file);
    if ($sql !== false && trim($sql) !== '') {
        $pdo->exec($sql);
    }
}

// The admin password is hashed here rather than in SQL, because MySQL has no
// bcrypt and a hash committed to a .sql file is a published credential.
$password = Env::get('SEED_ADMIN_PASSWORD', 'ChangeMe123!');
$hash = password_hash($password, PASSWORD_DEFAULT);

$statement = $pdo->prepare(
    'INSERT INTO users (name, username, email, password_hash, role)
     VALUES (:name, :username, :email, :hash, :role)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), name = VALUES(name)',
);
$statement->execute([
    'name' => 'Demo Admin',
    'username' => 'admin',
    'email' => 'admin@eventide.test',
    'hash' => $hash,
    'role' => 'admin',
]);

echo "\nSeeded `{$database}`.\n";
echo "Admin sign-in:  admin@eventide.test  /  {$password}\n";
echo "Change it with SEED_ADMIN_PASSWORD in .env before deploying anywhere real.\n";
