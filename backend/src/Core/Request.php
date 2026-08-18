<?php

declare(strict_types=1);

namespace App\Core;

/**
 * The request as a plain object.
 *
 * Controllers never touch $_SERVER, $_GET, $_POST or $_COOKIE. That is what
 * lets PHPUnit dispatch a request without an HTTP server: the test builds one
 * of these and hands it to the router.
 *
 * The raw body is captured verbatim and kept. The webhook signature is computed
 * over those exact bytes, and re-encoding decoded JSON changes them.
 */
final class Request
{
    /** @var array<string, mixed> */
    private array $attributes = [];

    /**
     * @param array<string, string> $headers  lower-cased keys
     * @param array<string, string> $cookies
     */
    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $headers,
        private readonly string $rawBody,
        private readonly array $cookies = [],
        private readonly string $ip = '',
    ) {
    }

    public static function fromGlobals(): self
    {
        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (str_starts_with($key, 'HTTP_')) {
                $name = strtolower(str_replace('_', '-', substr($key, 5)));
                $headers[$name] = (string) $value;
            }
        }
        // Not prefixed with HTTP_ by PHP, but still request headers.
        foreach (['CONTENT_TYPE' => 'content-type', 'CONTENT_LENGTH' => 'content-length'] as $key => $name) {
            if (isset($_SERVER[$key])) {
                $headers[$name] = (string) $_SERVER[$key];
            }
        }

        $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/';

        return new self(
            strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')),
            '/' . trim($path, '/'),
            $headers,
            (string) file_get_contents('php://input'),
            array_map('strval', $_COOKIE),
            (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
        );
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function rawBody(): string
    {
        return $this->rawBody;
    }

    public function header(string $name, ?string $default = null): ?string
    {
        return $this->headers[strtolower($name)] ?? $default;
    }

    public function cookie(string $name, ?string $default = null): ?string
    {
        return $this->cookies[$name] ?? $default;
    }

    public function ip(): string
    {
        return $this->ip;
    }

    public function userAgent(): string
    {
        return substr($this->header('user-agent', '') ?? '', 0, 255);
    }

    /**
     * The decoded JSON body: the single source of input for every endpoint.
     *
     * @return array<string, mixed>
     */
    public function body(): array
    {
        if ($this->rawBody === '') {
            return [];
        }

        $decoded = json_decode($this->rawBody, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body()[$key] ?? $default;
    }

    public function isJson(): bool
    {
        return str_contains(strtolower($this->header('content-type', '') ?? ''), 'application/json');
    }

    /** Request-scoped state, e.g. the authenticated user set by middleware. */
    public function withAttribute(string $key, mixed $value): self
    {
        $clone = clone $this;
        $clone->attributes[$key] = $value;

        return $clone;
    }

    public function attribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }
}
