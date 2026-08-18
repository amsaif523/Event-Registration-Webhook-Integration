<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Exceptions\UnauthorizedException;

/**
 * HS256 JSON Web Tokens.
 *
 * Written directly against PHP's crypto primitives rather than pulled in as a
 * dependency. This is not "rolling your own crypto": HS256 is HMAC-SHA256 over
 * "header.payload", and PHP gives us hash_hmac() and hash_equals() for exactly
 * that. The whole implementation is about sixty lines you can read in one
 * sitting, which suits a project whose premise is no framework.
 *
 * What it does NOT do, deliberately:
 *  - no "alg" negotiation. The header is checked against HS256 and nothing
 *    else, which closes the alg=none and RS256-key-confusion classes of attack
 *    that come from trusting the token to name its own algorithm.
 *  - no revocation. Access tokens are self-contained and cannot be withdrawn
 *    before they expire, which is precisely why they are short-lived and why
 *    the long-lived half of the pair is a database-backed refresh token.
 */
final class Jwt
{
    private const ALGORITHM = 'HS256';

    /** Tolerance for clock drift between issuer and verifier. */
    private const LEEWAY_SECONDS = 30;

    /** @param array<string, mixed> $claims */
    public static function encode(array $claims, int $ttlSeconds): string
    {
        $issuedAt = time();
        $payload = array_merge($claims, [
            'iss' => Env::get('JWT_ISSUER', 'eventide'),
            'iat' => $issuedAt,
            'nbf' => $issuedAt,
            'exp' => $issuedAt + $ttlSeconds,
            // A unique id per token, so one can be traced in logs.
            'jti' => bin2hex(random_bytes(8)),
        ]);

        $segments = [
            self::base64UrlEncode(self::json(['alg' => self::ALGORITHM, 'typ' => 'JWT'])),
            self::base64UrlEncode(self::json($payload)),
        ];

        $signature = self::sign(implode('.', $segments));
        $segments[] = self::base64UrlEncode($signature);

        return implode('.', $segments);
    }

    /**
     * @return array<string, mixed>
     *
     * @throws UnauthorizedException when the token is malformed, unsigned by
     *                               us, or outside its validity window
     */
    public static function decode(string $token): array
    {
        $segments = explode('.', $token);
        if (count($segments) !== 3) {
            throw new UnauthorizedException('Malformed token.', 'TOKEN_MALFORMED');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $segments;

        $header = json_decode(self::base64UrlDecode($encodedHeader), true);
        if (!is_array($header) || ($header['alg'] ?? null) !== self::ALGORITHM) {
            // Never take the algorithm from the token itself.
            throw new UnauthorizedException('Unsupported token algorithm.', 'TOKEN_ALGORITHM');
        }

        $expected = self::sign($encodedHeader . '.' . $encodedPayload);
        // Constant-time: a fast/slow comparison leaks how much of a forged
        // signature was correct.
        if (!hash_equals($expected, self::base64UrlDecode($encodedSignature))) {
            throw new UnauthorizedException('Token signature does not match.', 'TOKEN_SIGNATURE');
        }

        $payload = json_decode(self::base64UrlDecode($encodedPayload), true);
        if (!is_array($payload)) {
            throw new UnauthorizedException('Malformed token payload.', 'TOKEN_MALFORMED');
        }

        $now = time();
        if (isset($payload['nbf']) && $now + self::LEEWAY_SECONDS < (int) $payload['nbf']) {
            throw new UnauthorizedException('Token is not valid yet.', 'TOKEN_NOT_YET_VALID');
        }
        if (isset($payload['exp']) && $now - self::LEEWAY_SECONDS >= (int) $payload['exp']) {
            // Its own code, because the frontend reacts to this one by asking
            // for a refresh rather than by bouncing to the login screen.
            throw new UnauthorizedException('Token has expired.', 'TOKEN_EXPIRED');
        }

        $issuer = Env::get('JWT_ISSUER', 'eventide');
        if (isset($payload['iss']) && !hash_equals((string) $issuer, (string) $payload['iss'])) {
            throw new UnauthorizedException('Token was issued by someone else.', 'TOKEN_ISSUER');
        }

        return $payload;
    }

    private static function sign(string $message): string
    {
        return hash_hmac('sha256', $message, self::secret(), true);
    }

    private static function secret(): string
    {
        $secret = Env::require('JWT_SECRET');

        if (strlen($secret) < 32 || str_starts_with($secret, 'change_me')) {
            throw new \RuntimeException(
                'JWT_SECRET must be a random string of at least 32 characters. '
                . 'Generate one with: php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"',
            );
        }

        return $secret;
    }

    private static function json(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    public static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    public static function base64UrlDecode(string $value): string
    {
        $padded = str_pad(strtr($value, '-_', '+/'), (int) (ceil(strlen($value) / 4) * 4), '=');

        return (string) base64_decode($padded, true);
    }
}
