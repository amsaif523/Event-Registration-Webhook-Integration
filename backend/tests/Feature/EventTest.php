<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class EventTest extends TestCase
{
    public function test_the_public_list_only_shows_published_events(): void
    {
        $this->createEvent(['name' => 'Draft Admins Only', 'status' => 'draft']);
        $this->createEvent(['name' => 'Published And Visible', 'status' => 'published']);
        $this->createEvent(['name' => 'Cancelled And Hidden', 'status' => 'cancelled']);

        $response = $this->post('/api/events/list', ['per_page' => 'all']);

        $this->assertSame(200, $response->status());
        $names = array_column($response->payload()['data']['items'], 'name');

        $this->assertContains('Published And Visible', $names);
        $this->assertNotContains('Draft Admins Only', $names);
        $this->assertNotContains('Cancelled And Hidden', $names);
    }

    public function test_a_status_filter_sent_to_the_public_endpoint_is_ignored(): void
    {
        // publicList() forces published_only = true and strips any status the
        // caller sends — asking the public endpoint for drafts must not work
        // even by passing "status": "draft" directly.
        $this->createEvent(['name' => 'Secret Draft', 'status' => 'draft']);

        $response = $this->post('/api/events/list', ['status' => 'draft', 'per_page' => 'all']);

        $names = array_column($response->payload()['data']['items'], 'name');
        $this->assertNotContains('Secret Draft', $names);
    }

    public function test_viewing_a_draft_event_publicly_returns_not_found(): void
    {
        $event = $this->createEvent(['status' => 'draft']);

        $response = $this->post('/api/events/view', ['id' => $event['id']]);

        $this->assertSame(404, $response->status());
        $this->assertSame('EVENT_NOT_FOUND', $response->payload()['error']['code']);
    }

    public function test_viewing_an_unknown_event_returns_not_found(): void
    {
        $response = $this->post('/api/events/view', ['id' => 999999]);

        $this->assertSame(404, $response->status());
    }

    public function test_viewing_a_published_event_reports_seats_left(): void
    {
        $event = $this->createEvent(['capacity' => 5]);

        $response = $this->post('/api/events/view', ['id' => $event['id']]);

        $this->assertSame(200, $response->status());
        $data = $response->payload()['data']['event'];
        $this->assertSame(5, $data['capacity']);
        $this->assertSame(0, $data['seats_taken']);
        $this->assertSame(5, $data['seats_left']);
    }

    public function test_seats_left_drops_as_registrations_come_in(): void
    {
        $event = $this->createEvent(['capacity' => 3]);

        $this->post('/api/registrations/create', [
            'event_id' => $event['id'],
            'first_name' => 'Asma',
            'last_name' => 'Madhvaswala',
            'email' => 'seats@example.test',
            'phone' => '+919876543210',
        ]);

        $response = $this->post('/api/events/view', ['id' => $event['id']]);
        $data = $response->payload()['data']['event'];

        $this->assertSame(1, $data['seats_taken']);
        $this->assertSame(2, $data['seats_left']);
    }
}
