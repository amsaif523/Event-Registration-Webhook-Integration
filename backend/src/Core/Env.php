<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Minimal .env reader. No dependency, because the only thing we need from a
 * dotenv library is "parse KEY=VALUE, ignore comments".
 */
final class Env
{
    /** @var array<string, string> */
    private static array $values = [];

    private static bool $loaded = false;

    public static function load(string $path): void
    {
        self::$values = [];
        self::$loaded = true;

        if (!is_readable($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            $parts = explode('=', $line, 2);
            if (count($parts) !== 2) {
                continue;
            }

            $key = trim($parts[0]);
            $value = trim($parts[1]);

            // Strip a trailing inline comment, but only when the value is not
            // quoted: secrets legitimately contain '#'.
            if ($value === '' || ($value[0] !== '"' && $value[0] !== "'")) {
                $hash = strpos($value, ' #');
                if ($hash !== false) {
                    $value = rtrim(substr($value, 0, $hash));
                }
            }

            $value = trim($value);
            if (strlen($value) >= 2) {
                $first = $value[0];
                $last = $value[strlen($value) - 1];
                if (($first === '"' && $last === '"') || ($first === "'" && $last === "'")) {
                    $value = substr($value, 1, -1);
                }
            }

            self::$values[$key] = $value;
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $value = self::$values[$key] ?? $default;

        return $value === '' ? $default : $value;
    }

    /** Missing configuration should fail loudly at boot, not silently at runtime. */
    public static function require(string $key): string
    {
        $value = self::get($key);
        if ($value === null) {
            throw new \RuntimeException("Missing required environment variable: {$key}");
        }

        return $value;
    }

    public static function int(string $key, int $default): int
    {
        $value = self::get($key);

        return $value === null ? $default : (int) $value;
    }

    public static function bool(string $key, bool $default = false): bool
    {
        $value = self::get($key);
        if ($value === null) {
            return $default;
        }

        return in_array(strtolower($value), ['1', 'true', 'yes', 'on'], true);
    }

    public static function set(string $key, string $value): void
    {
        self::$loaded = true;
        self::$values[$key] = $value;
    }

    public static function loaded(): bool
    {
        return self::$loaded;
    }
}
