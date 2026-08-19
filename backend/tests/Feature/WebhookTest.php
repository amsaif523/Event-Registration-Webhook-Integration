<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Core\Response;
use App\Services\SignatureService;
use Tests\TestCase;

final class WebhookTest extends TestCase
{
    private function registerAndGetReference(int $capacity = 10, string $email = 'webhook-test@example.test'): string
    {
        $event = $this->createEvent(['capacity' => $capacity]);

        $response = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => $email,
            'phone' => '+919876543210',
        ]);

        return $response->payload()['data']['registration']['reference'];
    }

    private function sendWebhook(string $rawBody, ?string $signature, ?string $timestamp, ?string $deliveryId = null): Response
    {
        $headers = [];
        if ($signature !== null) {
            $headers['x-signature'] = $signature;
        }
        if ($timestamp !== null) {
            $headers['x-timestamp'] = $timestamp;
        }
        if ($deliveryId !== null) {
            $headers['x-webhook-id'] = $deliveryId;
        }

        return $this->dispatch('POST', '/api/webhooks/ticketing', $rawBody, $headers);
    }

    private function newDeliveryId(): string
    {
        return 'whd_test_' . bin2hex(random_bytes(6));
    }

    public function test_a_correctly_signed_webhook_confirms_the_registration(): void
    {
        $reference = $this->registerAndGetReference();

        $body = json_encode([
            'event' => 'ticket.confirmed',
            'registration_reference' => $reference,
            'ticket_id' => 'TKT-0001-TEST',
            'status' => 'confirmed',
        ]);
        $timestamp = (string) time();
        $signature = SignatureService::sign($body, $timestamp);
        $deliveryId = $this->newDeliveryId();

        $response = $this->sendWebhook($body, $signature, $timestamp, $deliveryId);

        $this->assertSame(200, $response->status());
        $payload = $response->payload();
        $this->assertTrue($payload['success']);
        $this->assertSame('processed', $payload['data']['outcome']);

        $status = $this->post('/api/registrations/status', ['reference' => $reference]);
        $registration = $status->payload()['data']['registration'];
        $this->assertSame('confirmed', $registration['status']);
        $this->assertSame('TKT-0001-TEST', $registration['ticket_id']);
        $this->assertNotNull($registration['confirmed_at']);

        $logged = $this->fetchWebhookEvent($deliveryId);
        $this->assertNotNull($logged);
        $this->assertSame('processed', $logged['status']);
    }

    public function test_a_webhook_with_an_invalid_signature_is_rejected_and_changes_nothing(): void
    {
        $reference = $this->registerAndGetReference();

        $body = json_encode([
            'event' => 'ticket.confirmed',
            'registration_reference' => $reference,
            'ticket_id' => 'TKT-0002-TEST',
            'status' => 'confirmed',
        ]);
        $timestamp = (string) time();
        // Signed with the wrong key — a genuinely invalid signature, not just
        // a malformed string, which is the case actually worth testing.
        $signature = SignatureService::sign($body, $timestamp, 'the-wrong-secret-entirely');
        $deliveryId = $this->newDeliveryId();

        $response = $this->sendWebhook($body, $signature, $timestamp, $deliveryId);

        $this->assertSame(401, $response->status());
        $this->assertSame('INVALID_SIGNATURE', $response->payload()['error']['code']);

        $status = $this->post('/api/registrations/status', ['reference' => $reference]);
        $this->assertSame('pending', $status->payload()['data']['registration']['status']);

        // Rejected deliveries are logged too — the audit trail is the point.
        $logged = $this->fetchWebhookEvent($deliveryId);
        $this->assertNotNull($logged);
        $this->assertSame('invalid_signature', $logged['status']);
    }

    public function test_a_webhook_with_no_signature_at_all_is_rejected(): void
    {
        $reference = $this->registerAndGetReference();
        $body = json_encode(['event' => 'ticket.confirmed', 'registration_reference' => $reference, 'ticket_id' => 'TKT-X']);

        $response = $this->sendWebhook($body, null, (string) time(), $this->newDeliveryId());

        $this->assertSame(401, $response->status());
        $this->assertSame('INVALID_SIGNATURE', $response->payload()['error']['code']);
    }

    public function test_a_repeated_delivery_id_is_accepted_but_changes_nothing(): void
    {
        $reference = $this->registerAndGetReference();

        $body = json_encode([
            'event' => 'ticket.confirmed',
            'registration_reference' => $reference,
            'ticket_id' => 'TKT-0003-TEST',
            'status' => 'confirmed',
        ]);
        $timestamp = (string) time();
        $signature = SignatureService::sign($body, $timestamp);
        $deliveryId = $this->newDeliveryId();

        $first = $this->sendWebhook($body, $signature, $timestamp, $deliveryId);
        $this->assertSame(200, $first->status());
        $this->assertSame('processed', $first->payload()['data']['outcome']);

        $second = $this->sendWebhook($body, $signature, $timestamp, $deliveryId);
        // A duplicate is a 200, not an error — that's what tells a real sender
        // to stop retrying instead of trying again forever.
        $this->assertSame(200, $second->status());
        $this->assertSame('duplicate', $second->payload()['data']['outcome']);

        $status = $this->post('/api/registrations/status', ['reference' => $reference]);
        $this->assertSame('TKT-0003-TEST', $status->payload()['data']['registration']['ticket_id']);
    }

    public function test_a_webhook_outside_the_replay_window_is_rejected_as_stale(): void
    {
        $reference = $this->registerAndGetReference();

        $body = json_encode([
            'event' => 'ticket.confirmed',
            'registration_reference' => $reference,
            'ticket_id' => 'TKT-0004-TEST',
            'status' => 'confirmed',
        ]);
        // Ten minutes old — outside the default five-minute tolerance window.
        $timestamp = (string) (time() - 600);
        $signature = SignatureService::sign($body, $timestamp);

        $response = $this->sendWebhook($body, $signature, $timestamp, $this->newDeliveryId());

        $this->assertSame(401, $response->status());
        $this->assertSame('STALE', $response->payload()['error']['code']);

        $status = $this->post('/api/registrations/status', ['reference' => $reference]);
        $this->assertSame('pending', $status->payload()['data']['registration']['status']);
    }

    public function test_a_webhook_for_an_unknown_reference_fails_without_touching_anything(): void
    {
        $body = json_encode([
            'event' => 'ticket.confirmed',
            'registration_reference' => 'EVT-NOTREAL1',
            'ticket_id' => 'TKT-0005-TEST',
            'status' => 'confirmed',
        ]);
        $timestamp = (string) time();
        $signature = SignatureService::sign($body, $timestamp);

        $response = $this->sendWebhook($body, $signature, $timestamp, $this->newDeliveryId());

        $this->assertSame(422, $response->status());
        $this->assertSame('FAILED', $response->payload()['error']['code']);
    }

    public function test_a_cancellation_event_cancels_a_pending_registration(): void
    {
        $reference = $this->registerAndGetReference();

        $body = json_encode([
            'event' => 'ticket.cancelled',
            'registration_reference' => $reference,
            'status' => 'cancelled',
        ]);
        $timestamp = (string) time();
        $signature = SignatureService::sign($body, $timestamp);

        $response = $this->sendWebhook($body, $signature, $timestamp, $this->newDeliveryId());

        $this->assertSame(200, $response->status());

        $status = $this->post('/api/registrations/status', ['reference' => $reference]);
        $this->assertSame('cancelled', $status->payload()['data']['registration']['status']);
    }

    public function test_a_confirmation_cannot_be_replayed_onto_an_already_cancelled_registration(): void
    {
        $reference = $this->registerAndGetReference();

        $cancelBody = json_encode(['event' => 'ticket.cancelled', 'registration_reference' => $reference]);
        $cancelTimestamp = (string) time();
        $this->sendWebhook(
            $cancelBody,
            SignatureService::sign($cancelBody, $cancelTimestamp),
            $cancelTimestamp,
            $this->newDeliveryId(),
        );

        // A late-arriving confirmation for the same reference — the guard is
        // "pending -> confirmed" only, so this must not resurrect it.
        $confirmBody = json_encode([
            'event' => 'ticket.confirmed',
            'registration_reference' => $reference,
            'ticket_id' => 'TKT-LATE',
        ]);
        $confirmTimestamp = (string) time();
        $response = $this->sendWebhook(
            $confirmBody,
            SignatureService::sign($confirmBody, $confirmTimestamp),
            $confirmTimestamp,
            $this->newDeliveryId(),
        );

        $this->assertSame(422, $response->status());

        $status = $this->post('/api/registrations/status', ['reference' => $reference]);
        $this->assertSame('cancelled', $status->payload()['data']['registration']['status']);
    }
}
