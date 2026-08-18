<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Env;

/**
 * HMAC-SHA256 signing and verification for the ticketing webhook.
 *
 * Two details here are the ones that actually matter:
 *
 * 1. The signature is computed over the **raw request body**, byte for byte.
 *    Decoding the JSON and re-encoding it changes whitespace, key order and
 *    unicode escaping, so the bytes no longer match and every signature fails.
 *    Request keeps the raw body for exactly this reason.
 *
 * 2. Comparison is hash_equals, not ===. String comparison short-circuits on
 *    the first differing byte, so how long it takes leaks how much of a guessed
 *    signature was right — enough to forge one a byte at a time.
 */
final class SignatureService
{
    private const PREFIX = 'sha256=';

    /**
     * The timestamp is part of the signed material, not just a header.
     *
     * Signing the body alone would let anyone who captured one valid request
     * replay it forever. Binding the timestamp into the signature means a
     * replay has to keep the original timestamp, which then falls outside the
     * tolerance window and is rejected.
     */
    public static function payloadToSign(string $rawBody, ?string $timestamp): string
    {
        return $timestamp === null || $timestamp === ''
            ? $rawBody
            : $timestamp . '.' . $rawBody;
    }

    public static function sign(string $rawBody, ?string $timestamp = null, ?string $secret = null): string
    {
        return self::PREFIX . hash_hmac(
            'sha256',
            self::payloadToSign($rawBody, $timestamp),
            $secret ?? self::secret(),
        );
    }

    public static function verify(
        string $rawBody,
        ?string $providedSignature,
        ?string $timestamp = null,
        ?string $secret = null,
    ): bool {
        if ($providedSignature === null || $providedSignature === '') {
            return false;
        }

        return hash_equals(
            self::sign($rawBody, $timestamp, $secret),
            trim($providedSignature),
        );
    }

    /**
     * Rejects a timestamp outside the tolerance window, in either direction.
     * Too old is a replay; too far in the future is a clock that cannot be
     * trusted to make "too old" mean anything.
     */
    public static function timestampWithinTolerance(?string $timestamp, ?int $tolerance = null): bool
    {
        if ($timestamp === null || $timestamp === '') {
            return false;
        }

        $tolerance ??= Env::int('WEBHOOK_TOLERANCE_SECONDS', 300);
        $sent = is_numeric($timestamp) ? (int) $timestamp : strtotime($timestamp);

        if ($sent === false || $sent === 0) {
            return false;
        }

        return abs(time() - $sent) <= $tolerance;
    }

    private static function secret(): string
    {
        $secret = Env::require('WEBHOOK_SECRET');

        if (strlen($secret) < 16 || str_starts_with($secret, 'change_me')) {
            throw new \RuntimeException(
                'WEBHOOK_SECRET must be a random string of at least 16 characters.',
            );
        }

        return $secret;
    }
}
