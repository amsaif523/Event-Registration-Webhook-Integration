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
    '2026-12-05 11:00:00', 'Studio 44, Lower Parel, Mumbai', 40, 'published'),
(5, 'Midnight Deploy: An SRE Night',
    'Incident war stories told by the people who were paged. Postmortems read aloud, blameless and unedited, followed by a live tabletop exercise.',
    '2026-09-27 20:00:00', 'Phoenix Marketcity Arena, Viman Nagar, Pune', 150, 'cancelled'),
(6, 'Ship It: Summer Demo Day',
    'Twenty teams, five minutes each, no slides allowed. Working software only, demoed live in front of a room that asks hard questions.',
    '2026-07-19 16:00:00', 'Jio World Convention Centre, BKC, Mumbai', 200, 'closed')
ON DUPLICATE KEY UPDATE
    name = VALUES(name), description = VALUES(description), event_date = VALUES(event_date),
    venue = VALUES(venue), capacity = VALUES(capacity), status = VALUES(status);

-- The demo admin account is created by scripts/seed.php, not here — a second,
-- conflicting insert here previously made its printed sign-in email wrong.


