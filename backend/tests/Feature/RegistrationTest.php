<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class RegistrationTest extends TestCase
{
    public function test_a_valid_registration_succeeds_and_returns_a_reference(): void
    {
        $event = $this->createEvent(['capacity' => 10]);

        $response = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'asma@example.test',
            'phone' => '+919876543210',
        ]);

        $this->assertSame(201, $response->status());
        $payload = $response->payload();
        $this->assertTrue($payload['success']);
        $this->assertSame('pending', $payload['data']['registration']['status']);
        $this->assertNull($payload['data']['registration']['ticket_id']);
        // EVT- plus eight characters from the ambiguity-free alphabet — see
        // RegistrationService::generateReference() for why O/0/I/1/L are out.
        $this->assertMatchesRegularExpression(
            '/^EVT-[A-HJ-NP-Z2-9]{8}$/',
            $payload['data']['registration']['reference'],
        );
    }

    public function test_missing_and_malformed_fields_fail_validation(): void
    {
        $event = $this->createEvent();

        $response = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => '',
            'last_name' => 'Rao',
            'email' => 'not-an-email',
            'phone' => '123',
        ]);

        $this->assertSame(422, $response->status());
        $payload = $response->payload();
        $this->assertFalse($payload['success']);
        $this->assertSame('VALIDATION_ERROR', $payload['error']['code']);
        $this->assertArrayHasKey('first_name', $payload['error']['fields']);
        $this->assertArrayHasKey('email', $payload['error']['fields']);
        $this->assertArrayHasKey('phone', $payload['error']['fields']);

        // A rejected registration must not have been written at all.
        $this->assertSame(
            0,
            (int) $this->events->find($event['id'])['seats_taken'],
        );
    }

    public function test_registration_is_refused_once_the_event_is_full(): void
    {
        $event = $this->createEvent(['capacity' => 1]);

        $first = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'first@example.test',
            'phone' => '+919876543210',
        ]);
        $this->assertSame(201, $first->status());

        $second = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Zoya',
            'last_name' => 'Khan',
            'email' => 'second@example.test',
            'phone' => '+919876543211',
        ]);

        $this->assertSame(409, $second->status());
        $this->assertSame('EVENT_FULL', $second->payload()['error']['code']);

        // Still exactly one seat taken — the refused attempt did not sneak in.
        $this->assertSame(1, (int) $this->events->find($event['id'])['seats_taken']);
    }

    public function test_the_same_email_cannot_register_twice_for_one_event(): void
    {
        $event = $this->createEvent(['capacity' => 10]);
        $body = [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'dup@example.test',
            'phone' => '+919876543210',
        ];

        $this->assertSame(201, $this->post('/api/registrations/create', $body)->status());

        $second = $this->post('/api/registrations/create', $body);
        $this->assertSame(409, $second->status());
        $this->assertSame('ALREADY_REGISTERED', $second->payload()['error']['code']);
    }

    public function test_registration_is_refused_for_an_event_that_is_not_published(): void
    {
        $event = $this->createEvent(['status' => 'draft']);

        $response = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'draft@example.test',
            'phone' => '+919876543210',
        ]);

        $this->assertSame(409, $response->status());
        $this->assertSame('EVENT_NOT_OPEN', $response->payload()['error']['code']);
    }

    public function test_registration_is_refused_for_an_event_that_has_already_happened(): void
    {
        $event = $this->createEvent(['event_date' => date('Y-m-d H:i:s', strtotime('-1 day'))]);

        $response = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'past@example.test',
            'phone' => '+919876543210',
        ]);

        $this->assertSame(409, $response->status());
        $this->assertSame('EVENT_PASSED', $response->payload()['error']['code']);
    }

    public function test_registering_for_an_event_that_does_not_exist_returns_not_found(): void
    {
        $response = $this->post('/api/registrations/create', [
            'event_id' => 999999,
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'ghost@example.test',
            'phone' => '+919876543210',
        ]);

        $this->assertSame(404, $response->status());
        $this->assertSame('EVENT_NOT_FOUND', $response->payload()['error']['code']);
    }

    public function test_status_lookup_is_case_insensitive_on_the_reference(): void
    {
        $event = $this->createEvent();
        $created = $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'lookup@example.test',
            'phone' => '+919876543210',
        ])->payload()['data']['registration'];

        $response = $this->post('/api/registrations/status', [
            'reference' => strtolower($created['reference']),
        ]);

        $this->assertSame(200, $response->status());
        $this->assertSame($created['reference'], $response->payload()['data']['registration']['reference']);
    }

    public function test_looking_up_an_unknown_reference_returns_not_found(): void
    {
        $response = $this->post('/api/registrations/status', ['reference' => 'EVT-ZZZZZZZZ']);

        $this->assertSame(404, $response->status());
        $this->assertSame('REGISTRATION_NOT_FOUND', $response->payload()['error']['code']);
    }

    public function test_a_reference_in_the_wrong_shape_fails_validation_before_any_lookup(): void
    {
        $response = $this->post('/api/registrations/status', ['reference' => 'not-a-reference']);

        $this->assertSame(422, $response->status());
        $this->assertSame('VALIDATION_ERROR', $response->payload()['error']['code']);
    }
}
