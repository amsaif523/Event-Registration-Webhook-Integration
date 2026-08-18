<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Exceptions\ConflictException;
use App\Core\Exceptions\NotFoundException;
use App\Repositories\EventRepository;
use App\Repositories\RegistrationRepository;
use PDOException;

/**
 * Creating a registration, safely.
 *
 * This is the part of the system most worth probing, because the obvious
 * implementation is wrong. Counting registrations, deciding there is room, and
 * then inserting is a race: two requests arriving together both read 49 of 50,
 * both conclude there is a seat, and both insert. The event is now oversold and
 * nothing in the code did anything visibly wrong.
 *
 * The fix is to make the two requests take turns. Everything below happens
 * inside one transaction that begins by taking a row lock on the event
 * (SELECT ... FOR UPDATE). The second request blocks on that lock until the
 * first commits, then re-reads the count and sees 50. It is refused, correctly,
 * without either request having to know the other existed.
 *
 * The unique index on (event_id, email) is a second, independent guard: even if
 * the logic above were wrong, the database would still refuse a duplicate.
 * Belt and braces, because the failure mode here is silent.
 */
final class RegistrationService
{
    /**
     * Deliberately excludes O/0 and I/1/L. References get read aloud, typed
     * from a screenshot, and dictated over the phone.
     */
    private const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    private const REFERENCE_LENGTH = 8;

    private const MAX_REFERENCE_ATTEMPTS = 5;

    public function __construct(
        private readonly EventRepository $events = new EventRepository(),
        private readonly RegistrationRepository $registrations = new RegistrationRepository(),
    ) {
    }

    /**
     * @param array<string, mixed> $input
     *
     * @return array<string, mixed> the created registration
     */
    public function register(array $input): array
    {
        $eventId = (int) $input['event_id'];
        $email = strtolower(trim((string) $input['email']));

        $reference = Database::transaction(function () use ($eventId, $email, $input): string {
            // Everything from here to commit is serialised per event.
            $event = $this->events->findForUpdate($eventId);

            if ($event === null) {
                throw new NotFoundException('That event does not exist.', 'EVENT_NOT_FOUND');
            }

            if ($event['status'] !== 'published') {
                throw new ConflictException(
                    match ($event['status']) {
                        'cancelled' => 'This event has been cancelled.',
                        'draft' => 'This event is not open for registration yet.',
                        default => 'Registration for this event is closed.',
                    },
                    'EVENT_NOT_OPEN',
                );
            }

            if (strtotime((string) $event['event_date']) <= time()) {
                throw new ConflictException('This event has already taken place.', 'EVENT_PASSED');
            }

            // Read inside the lock. Reading it before would defeat the point.
            $taken = $this->registrations->countActiveForEvent($eventId);
            if ($taken >= (int) $event['capacity']) {
                throw new ConflictException('This event is now full.', 'EVENT_FULL');
            }

            if ($this->registrations->existsForEmail($eventId, $email)) {
                throw new ConflictException(
                    'This email is already registered for this event.',
                    'ALREADY_REGISTERED',
                );
            }

            $reference = $this->generateReference();

            try {
                $this->registrations->create([
                    'event_id' => $eventId,
                    'reference' => $reference,
                    'first_name' => trim((string) $input['first_name']),
                    'last_name' => trim((string) $input['last_name']),
                    'email' => $email,
                    'phone' => self::normalisePhone((string) $input['phone']),
                    'status' => 'pending',
                ]);
            } catch (PDOException $e) {
                // 23000 is an integrity constraint violation. The only one
                // reachable here is the unique (event_id, email) index, which
                // means a duplicate slipped past the check above — report it as
                // what it is rather than as a server error.
                if ($e->getCode() === '23000') {
                    throw new ConflictException(
                        'This email is already registered for this event.',
                        'ALREADY_REGISTERED',
                    );
                }

                throw $e;
            }

            return $reference;
        });

        $created = $this->registrations->findByReference($reference);
        if ($created === null) {
            throw new NotFoundException('The registration could not be read back.', 'REGISTRATION_NOT_FOUND');
        }

        return $created;
    }

    /**
     * Random, not sequential.
     *
     * Keeping references out of URLs stops them leaking into logs, but it does
     * not stop guessing. Sequential references would let anyone walk the entire
     * registration list by incrementing a number in a request body; randomness
     * is what actually defends the lookup endpoint.
     *
     * 31^8 is about 850 billion, so a collision is vanishingly unlikely — but
     * "unlikely" is not "impossible", and the unique index would reject one, so
     * it retries rather than failing someone's registration over a coin flip.
     */
    private function generateReference(): string
    {
        for ($attempt = 0; $attempt < self::MAX_REFERENCE_ATTEMPTS; ++$attempt) {
            $candidate = 'EVT-';
            for ($i = 0; $i < self::REFERENCE_LENGTH; ++$i) {
                // random_int, not rand: this is a credential.
                $candidate .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
            }

            if (!$this->registrations->referenceExists($candidate)) {
                return $candidate;
            }
        }

        throw new \RuntimeException('Could not generate a unique reference number.');
    }

    /** Store one canonical shape so search and display are predictable. */
    public static function normalisePhone(string $phone): string
    {
        $compact = preg_replace('/[\s()\-.]/', '', trim($phone)) ?? '';

        return str_starts_with($compact, '+') ? $compact : $compact;
    }
}
