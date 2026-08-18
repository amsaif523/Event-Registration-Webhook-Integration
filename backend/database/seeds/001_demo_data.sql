-- Demo data. Deliberately includes an event that is one seat from full and one
-- that is completely full, so the capacity rule can be exercised immediately
-- without setting anything up.
--
-- Re-runnable: fixed ids with ON DUPLICATE KEY UPDATE rather than plain inserts.

INSERT INTO events (id, name, description, event_date, venue, capacity, status) VALUES
(1, 'Signal & Noise: A Product Design Summit',
    'A one-day summit on designing for clarity. Eight talks from practitioners who ship, plus two hands-on critique sessions where you bring your own work and leave with notes you can act on.',
    '2026-09-14 18:30:00', 'Nehru Centre Auditorium, Worli, Mumbai', 120, 'published'),
(2, 'The Backend Room: Scaling PHP in 2026',
    'Deep-dive evening for backend engineers. Connection pooling, row locking under contention, idempotent webhook design, and what actually breaks first when traffic multiplies.',
    '2026-10-02 10:00:00', 'WeWork Enam Sambhav, BKC, Mumbai', 4, 'published'),
(3, 'Founders'' Table: Bootstrapping in Public',
    'An intimate evening with four founders who grew without outside capital. Revenue numbers on screen, honest failure stories, and a long unstructured Q&A over dinner.',
    '2026-11-07 17:00:00', 'The Quorum, Whitefield, Bengaluru', 60, 'published'),
(4, 'Type & Grid: An Editorial Workshop',
    'Two days on typographic systems for the web. Scale, rhythm, measure, and the discipline of a grid you can actually hold to across a real product.',
    '2026-12-05 11:00:00', 'Studio 44, Lower Parel, Mumbai', 40, 'draft'),
(5, 'Midnight Deploy: An SRE Night',
    'Incident war stories told by the people who were paged. Postmortems read aloud, blameless and unedited, followed by a live tabletop exercise.',
    '2026-09-27 20:00:00', 'Phoenix Marketcity Arena, Viman Nagar, Pune', 150, 'cancelled'),
(6, 'Ship It: Summer Demo Day',
    'Twenty teams, five minutes each, no slides allowed. Working software only, demoed live in front of a room that asks hard questions.',
    '2026-07-19 16:00:00', 'Jio World Convention Centre, BKC, Mumbai', 200, 'closed')
ON DUPLICATE KEY UPDATE
    name = VALUES(name), description = VALUES(description), event_date = VALUES(event_date),
    venue = VALUES(venue), capacity = VALUES(capacity), status = VALUES(status);

-- Event 2 has capacity 4 and four confirmed registrations: it is full, so a
-- registration attempt returns 409 straight away.
INSERT INTO registrations
    (id, event_id, reference, first_name, last_name, email, phone, status, ticket_id, confirmed_at, created_at) VALUES
(1, 1, 'EVT-7QK3M2XD', 'Ananya', 'Krishnan', 'ananya.krishnan@mailhaven.co', '+919820041277',
    'confirmed', 'TKT-4471-88A2', '2026-08-11 09:22:14', '2026-08-11 09:22:00'),
(2, 1, 'EVT-H4N9RTPW', 'Rohan', 'Mehta', 'rohan.mehta@brightloop.io', '+919967420518',
    'pending', NULL, NULL, '2026-08-16 14:05:00'),
(3, 1, 'EVT-C8JM5VQ2', 'Priya', 'Sundaram', 'priya.s@northgate.dev', '+919867633019',
    'confirmed', 'TKT-4471-88B7', '2026-08-09 11:40:22', '2026-08-09 11:40:00'),
(4, 2, 'EVT-M6PT2NDR', 'Meera', 'Iyer', 'meera.iyer@stackhaus.in', '+919004577213',
    'confirmed', 'TKT-5520-31D4', '2026-08-05 19:02:09', '2026-08-05 19:02:00'),
(5, 2, 'EVT-9VBK4HSQ', 'Arjun', 'Rao', 'arjun.rao@perigee.tech', '+918879610432',
    'confirmed', 'TKT-5520-31E2', '2026-08-17 10:48:20', '2026-08-17 10:48:00'),
(6, 2, 'EVT-T2GD8MXR', 'Sofia', 'Almeida', 'sofia.almeida@vireo.pt', '+351912445018',
    'confirmed', 'TKT-5520-31E9', '2026-08-06 13:27:18', '2026-08-06 13:27:00'),
(7, 2, 'EVT-K5RN3WQZ', 'Vikram', 'Shetty', 'vikram.shetty@handoff.dev', '+919702588104',
    'confirmed', 'TKT-5520-32A0', '2026-08-07 09:14:52', '2026-08-07 09:11:00'),
(8, 3, 'EVT-P9HC6TJM', 'Neha', 'Bhatt', 'neha.bhatt@orbitcraft.co', '+919987320641',
    'pending', NULL, NULL, '2026-08-18 07:36:00'),
(9, 3, 'EVT-W4ZQ8KDN', 'Karan', 'Desai', 'karan@desaistudio.in', '+919825361190',
    'confirmed', 'TKT-6103-77F2', '2026-08-14 16:20:31', '2026-08-14 16:20:00'),
(10, 6, 'EVT-R8TN4XCM', 'Farah', 'Qureshi', 'farah.qureshi@sabledesk.com', '+919819544720',
    'confirmed', 'TKT-2288-19B5', '2026-07-10 12:03:26', '2026-07-10 12:03:00')
ON DUPLICATE KEY UPDATE
    status = VALUES(status), ticket_id = VALUES(ticket_id), confirmed_at = VALUES(confirmed_at);

-- A delivery log covering all four outcomes, so the audit trail is not empty
-- on a fresh install.
INSERT INTO webhook_events
    (id, delivery_id, event_type, registration_reference, payload, status, error_message, received_at, processed_at) VALUES
(1, 'whd_d6e39b1470ca4c02af18', 'ticket.confirmed', 'EVT-7QK3M2XD',
    '{"event":"ticket.confirmed","reference":"EVT-7QK3M2XD","ticket_id":"TKT-4471-88A2"}',
    'processed', NULL, '2026-08-11 09:22:14', '2026-08-11 09:22:14'),
(2, 'whd_71bd0c6e8a4f49129e55', 'ticket.confirmed', 'EVT-7QK3M2XD',
    '{"event":"ticket.confirmed","reference":"EVT-7QK3M2XD","ticket_id":"TKT-4471-88A2"}',
    'duplicate', NULL, '2026-08-11 09:23:02', NULL),
(3, 'whd_c47d18a9f0b24e3c9d77', 'ticket.confirmed', 'EVT-H4N9RTPW',
    '{"event":"ticket.confirmed","reference":"EVT-H4N9RTPW","ticket_id":"TKT-4471-9001"}',
    'invalid_signature', 'Computed HMAC-SHA256 does not match the X-Signature header.',
    '2026-08-18 11:12:44', NULL),
(4, 'whd_9f2a41c7be8340d5a1e6', 'ticket.confirmed', 'EVT-Q7YB3NKF',
    '{"event":"ticket.confirmed","reference":"EVT-Q7YB3NKF","ticket_id":"TKT-6103-7810"}',
    'failed', 'No registration found for reference EVT-Q7YB3NKF.', '2026-08-18 12:41:07', NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status), error_message = VALUES(error_message);
