<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\SignatureService;
use PHPUnit\Framework\TestCase;

/**
 * A true unit test — no database, no router. Just the HMAC math, which is the
 * part of the webhook pipeline that actually needs to be provably correct
 * rather than merely observed to work in a feature test.
 *
 * Relies on tests/bootstrap.php having already loaded .env (so WEBHOOK_SECRET
 * is available) before PHPUnit runs any test class.
 */
final class SignatureServiceTest extends TestCase
{
    public function test_a_signature_verifies_against_the_exact_body_and_timestamp_it_was_made_for(): void
    {
        $body = json_encode(['event' => 'ticket.confirmed', 'registration_reference' => 'EVT-TESTTEST']);
        $timestamp = (string) time();

        $signature = SignatureService::sign($body, $timestamp);

        $this->assertTrue(SignatureService::verify($body, $signature, $timestamp));
    }

    public function test_a_signature_does_not_verify_against_a_different_body(): void
    {
        $timestamp = (string) time();
        $signature = SignatureService::sign('{"a":1}', $timestamp);

        $this->assertFalse(SignatureService::verify('{"a":2}', $signature, $timestamp));
    }

    public function test_a_signature_does_not_verify_against_a_different_timestamp(): void
    {
        // The timestamp is part of the signed string, not just a header sitting
        // beside the signature — this is what stops a captured request being
        // replayed later with its timestamp bumped forward to slip back inside
        // the tolerance window.
        $body = '{"event":"ticket.confirmed"}';
        $signature = SignatureService::sign($body, '1700000000');

        $this->assertFalse(SignatureService::verify($body, $signature, '1700000001'));
    }

    public function test_a_signature_made_with_a_different_secret_does_not_verify(): void
    {
        $body = '{"event":"ticket.confirmed"}';
        $timestamp = (string) time();
        $signature = SignatureService::sign($body, $timestamp, 'a-completely-different-secret-value');

        $this->assertFalse(SignatureService::verify($body, $signature, $timestamp));
    }

    public function test_a_missing_or_empty_signature_never_verifies(): void
    {
        $this->assertFalse(SignatureService::verify('{}', null, (string) time()));
        $this->assertFalse(SignatureService::verify('{}', '', (string) time()));
    }

    public function test_re_encoding_the_body_before_signing_produces_a_different_signature(): void
    {
        // This is the mistake the codebase's comments warn about repeatedly:
        // decode then re-encode changes whitespace even when the data is
        // otherwise "the same" — spaced-out JSON like a formatter would
        // produce comes back compact once it's round-tripped through PHP's
        // decoder and re-encoded with default options.
        $original = '{"event": "ticket.confirmed", "registration_reference": "EVT-ABC12345"}';
        $reencoded = json_encode(json_decode($original, true));
        $timestamp = (string) time();

        $signature = SignatureService::sign($original, $timestamp);

        $this->assertNotSame($original, $reencoded, 'the fixture should actually change shape when re-encoded');
        $this->assertFalse(SignatureService::verify($reencoded, $signature, $timestamp));
    }

    public function test_a_timestamp_inside_the_tolerance_window_passes(): void
    {
        $this->assertTrue(SignatureService::timestampWithinTolerance((string) (time() - 100), 300));
    }

    public function test_a_timestamp_outside_the_tolerance_window_fails_in_either_direction(): void
    {
        $this->assertFalse(SignatureService::timestampWithinTolerance((string) (time() - 400), 300));
        $this->assertFalse(SignatureService::timestampWithinTolerance((string) (time() + 400), 300));
    }

    public function test_a_missing_timestamp_fails_the_tolerance_check(): void
    {
        $this->assertFalse(SignatureService::timestampWithinTolerance(null, 300));
        $this->assertFalse(SignatureService::timestampWithinTolerance('', 300));
    }

    public function test_a_non_numeric_unparsable_timestamp_fails_the_tolerance_check(): void
    {
        $this->assertFalse(SignatureService::timestampWithinTolerance('zzz-not-a-real-date-zzz', 300));
    }
}
