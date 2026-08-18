<?php

declare(strict_types=1);

namespace App\Core;

/**
 * A cookie to be sent with the response.
 *
 * Auth cookies are HttpOnly so JavaScript cannot read them — that is the whole
 * point of putting tokens here rather than in localStorage, where any XSS on
 * the page can walk off with them.
 *
 * SameSite=Strict is viable because the frontend and API are served from one
 * origin (CLAUDE.md section 7, decision 10). It is also the CSRF defence: the
 * browser will not attach these cookies to a request originating from another
 * site at all.
 */
final class Cookie
{
    public function __construct(
        public readonly string $name,
        public readonly string $value,
        public readonly int $expires,
        public readonly string $path = '/',
        public readonly bool $httpOnly = true,
        public readonly string $sameSite = 'Strict',
    ) {
    }

    public static function forget(string $name, string $path = '/'): self
    {
        return new self($name, '', time() - 3600, $path);
    }

    /**
     * Secure is set whenever the site is served over HTTPS. It is deliberately
     * derived rather than configured, so nobody forgets to turn it on in
     * production, and it stays off on plain-HTTP localhost where a Secure
     * cookie would simply never be stored.
     */
    public function isSecure(): bool
    {
        return str_starts_with(strtolower(Env::get('APP_URL', 'http://localhost') ?? ''), 'https://');
    }

    /** @return array<string, mixed> */
    public function options(): array
    {
        return [
            'expires' => $this->expires,
            'path' => $this->path,
            'secure' => $this->isSecure(),
            'httponly' => $this->httpOnly,
            'samesite' => $this->sameSite,
        ];
    }

    public function send(): void
    {
        setcookie($this->name, $this->value, $this->options());
    }
}
