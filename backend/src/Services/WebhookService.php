<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Database;
use App\Core\Request;
use App\Repositories\RegistrationRepository;
use App\Repositories\WebhookEventRepository;

/**
 * Processing an inbound ticketing webhook.
 *
 * The order of operations is the design, and it is deliberate:
 *
 *   1. Work out a delivery id (from the header, or a hash of the body).
 *   2. Verify the signature over the RAW body. Reject and log if it fails.
 *   3. Check the timestamp is inside the replay window.
 *   4. Claim the delivery id by INSERT. A duplicate-key error here means this
 *      is a repeat delivery — log it and return 200.
 *   5. Apply the state transition, guarded so only pending -> confirmed works.
 *
 * Every outcome is written to webhook_events, including the rejections. That
 * log is the audit trail, and being able to show why a signature failed is
 * worth as much as showing one that succeeded.
 *
 * A duplicate returns 200, not an error. Telling the sender "already handled"
 * is what stops it retrying forever; a 4xx would look like a failure worth
 * repeating.
 */
final class WebhookService
{
    public function __construct(
        private readonly WebhookEventRepository $log = new WebhookEventRepository(),
        private readonly RegistrationRepository $registrations = new RegistrationRepository(),
    ) {
    }

    /**
     * @return array{status: int, outcome: string, message: string, delivery_id: string}
     */
    public function handle(Request $request): array
    {
        $rawBody = $request->rawBody();
        $signature = $request->header('x-signature');
        $timestamp = $request->header('x-timestamp');

        $payload = json_decode($rawBody, true);
        $payload = is_array($payload) ? $payload : [];

        $eventType = (string) ($payload['event'] ?? $payload['event_type'] ?? 'unknown');

        /**
         * The assignment specifies `registration_reference`; that is the field
         * a real provider sends and it is read first. `reference` is accepted
         * as well because we cannot dictate the shape of somebody else's
         * payload, and a webhook receiver that rejects a delivery over a field
         * name it could have understood is a receiver that loses tickets.
         */
        $rawReference = $payload['registration_reference'] ?? $payload['reference'] ?? null;
        $reference = $rawReference === null ? null : strtoupper(trim((string) $rawReference));

        // Fall back to a hash of the body so a sender that omits the header
        // still gets idempotency, keyed on the content itself.
        $deliveryId = $request->header('x-webhook-id') ?: 'sha256_' . hash('sha256', $rawBody);

        /* -------------------------------------------------- 1. signature */

        if (!SignatureService::verify($rawBody, $signature, $timestamp)) {
            $this->log->log(
                $deliveryId,
                $eventType,
                $reference,
                $rawBody,
                $signature,
                'invalid_signature',
                'Computed HMAC-SHA256 does not match the X-Signature header.',
            );

            return [
                'status' => 401,
                'outcome' => 'invalid_signature',
                'message' => 'Signature verification failed.',
                'delivery_id' => $deliveryId,
            ];
        }

        /* ------------------------------------------------- 2. replay window */

        if ($timestamp !== null && !SignatureService::timestampWithinTolerance($timestamp)) {
            $this->log->log(
                $deliveryId,
                $eventType,
                $reference,
                $rawBody,
                $signature,
                'failed',
                'Timestamp is outside the accepted window; treated as a replay.',
            );

            return [
                'status' => 401,
                'outcome' => 'stale',
                'message' => 'Timestamp is outside the accepted window.',
                'delivery_id' => $deliveryId,
            ];
        }

        /* --------------------------------------------------- 3. idempotency */

        if (!$this->log->claim($deliveryId, $eventType, $reference, $rawBody, $signature)) {
            $this->log->log(
                $deliveryId . '_dup_' . bin2hex(random_bytes(4)),
                $eventType,
                $reference,
                $rawBody,
                $signature,
                'duplicate',
                null,
            );

            return [
                'status' => 200,
                'outcome' => 'duplicate',
                'message' => 'This delivery has already been processed.',
                'delivery_id' => $deliveryId,
            ];
        }

        /* ---------------------------------------------------- 4. transition */

        if ($reference === null) {
            $this->log->markFailed($deliveryId, 'Payload did not include a registration reference.');

            return [
                'status' => 422,
                'outcome' => 'failed',
                'message' => 'The payload did not include a registration reference.',
                'delivery_id' => $deliveryId,
            ];
        }

        try {
            $result = Database::transaction(function () use ($reference, $payload, $eventType) {
                $registration = $this->registrations->findByReferenceForUpdate($reference);

                if ($registration === null) {
                    return ['ok' => false, 'error' => sprintf('No registration found for reference %s.', $reference)];
                }

                /**
                 * The assignment's payload carries both an `event` name and a
                 * `status`. Either may say the ticket was cancelled, so honour
                 * whichever does rather than insisting on one.
                 */
                $declaredStatus = strtolower((string) ($payload['status'] ?? ''));

                if ($eventType === 'ticket.cancelled' || $declaredStatus === 'cancelled') {
                    $this->registrations->cancel($reference);

                    return ['ok' => true];
                }

                $ticketId = (string) ($payload['ticket_id'] ?? '');
                if ($ticketId === '') {
                    return ['ok' => false, 'error' => 'Payload did not include a ticket_id.'];
                }

                // Guarded in SQL: only pending -> confirmed. A late duplicate
                // cannot resurrect a cancelled registration.
                if (!$this->registrations->confirm($reference, $ticketId)) {
                    return [
                        'ok' => false,
                        'error' => sprintf(
                            'Registration is not pending, refusing transition from %s to confirmed.',
                            $registration['status'],
                        ),
                    ];
                }

                return ['ok' => true];
            });
        } catch (\Throwable $e) {
            $this->log->markFailed($deliveryId, $e->getMessage());

            throw $e;
        }

        if ($result['ok'] === false) {
            $this->log->markFailed($deliveryId, $result['error']);

            return [
                'status' => 422,
                'outcome' => 'failed',
                'message' => $result['error'],
                'delivery_id' => $deliveryId,
            ];
        }

        $this->log->markProcessed($deliveryId);

        return [
            'status' => 200,
            'outcome' => 'processed',
            'message' => 'Registration updated.',
            'delivery_id' => $deliveryId,
        ];
    }
}
