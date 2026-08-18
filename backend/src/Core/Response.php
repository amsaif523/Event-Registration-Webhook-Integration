<?php

declare(strict_types=1);

namespace App\Core;

/**
 * The one place that writes output. Nothing else in the app echoes.
 *
 * Every response uses the same envelope so the frontend has exactly one shape
 * to handle:
 *   success -> { "success": true,  "data": {...} }
 *   failure -> { "success": false, "error": { code, message, fields } }
 */
final class Response
{
    /** @var Cookie[] */
    private array $cookies = [];

    private function __construct(
        private readonly int $status,
        private readonly array $payload,
    ) {
    }

    public static function success(mixed $data = null, int $status = 200): self
    {
        return new self($status, ['success' => true, 'data' => $data]);
    }

    public static function created(mixed $data = null): self
    {
        return self::success($data, 201);
    }

    /** @param array<string, string> $fields */
    public static function error(int $status, string $code, string $message, array $fields = []): self
    {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) {
            $error['fields'] = $fields;
        }

        return new self($status, ['success' => false, 'error' => $error]);
    }

    public function withCookie(Cookie $cookie): self
    {
        $this->cookies[] = $cookie;

        return $this;
    }

    public function status(): int
    {
        return $this->status;
    }

    /** @return array<string, mixed> */
    public function payload(): array
    {
        return $this->payload;
    }

    /** @return Cookie[] */
    public function cookies(): array
    {
        return $this->cookies;
    }

    public function send(): void
    {
        if (!headers_sent()) {
            http_response_code($this->status);
            header('Content-Type: application/json; charset=utf-8');
            // Responses carry personal data and auth state; never let anything
            // in between keep a copy.
            header('Cache-Control: no-store');
            header('X-Content-Type-Options: nosniff');
            header('Referrer-Policy: no-referrer');

            foreach ($this->cookies as $cookie) {
                $cookie->send();
            }
        }

        echo json_encode($this->payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
