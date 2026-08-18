<?php

declare(strict_types=1);

/**
 * Shared boot for the web front controller, the CLI scripts and the tests.
 * Composer is used only for PSR-4 autoloading and PHPUnit; if it has not been
 * installed, fall back to a plain require-based autoloader so the app still
 * runs from a clean checkout.
 */

use App\Core\Env;

$root = __DIR__;

if (is_file($root . '/vendor/autoload.php')) {
    require $root . '/vendor/autoload.php';
} else {
    spl_autoload_register(static function (string $class) use ($root): void {
        if (!str_starts_with($class, 'App\\')) {
            return;
        }

        $path = $root . '/src/' . str_replace('\\', '/', substr($class, 4)) . '.php';
        if (is_file($path)) {
            require $path;
        }
    });
}

Env::load($root . '/.env');

date_default_timezone_set(Env::get('APP_TIMEZONE', 'UTC') ?? 'UTC');

return $root;
