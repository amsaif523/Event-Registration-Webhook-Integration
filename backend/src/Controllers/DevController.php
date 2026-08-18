<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Env;
use App\Core\Exceptions\ForbiddenException;
use App\Core\Exceptions\NotFoundException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Repositories\RegistrationRepository;
use App\Services\SignatureService;
use App\Services\WebhookService;

/**
 * The webhook simulator behind the admin panel's demo button.
 *
 * It exists because a reviewer opens a URL, not a terminal. Without it, the
 * webhook half of the flow is invisible unless you are willing to run curl with
 * a hand-computed HMAC.
 *
 * The signing happens **here, on the server**. The browser sends only a
 * reference and a mode; WEBHOOK_SECRET never leaves the machine. A simulator
 * that signed in the browser would have to ship the secret to it, which would
 * defeat the entire point of having one.
 *
 * Gated twice: DEMO_MODE must be on, and the caller must be signed in.
 */
final class DevController
{
    public function __construct(
        private readonly WebhookService $webhooks = new WebhookService(),
        private readonly RegistrationRepository $registrations = new RegistrationRepository(),
    ) {
    }

    /** POST /api/dev/simulate-webhook */
    public function simulateWebhook(Request $request): Response
    {
        if (!Env::bool('DEMO_MODE', false)) {
            throw new ForbiddenException('The webhook simulator is disabled.', 'DEMO_MODE_OFF');
        }

        $data = Validator::validate($request->body(), [
            'reference' => 'required|reference',
            'mode' => 'in:valid,bad_signature,duplicate,stale,cancel',
        ], ['reference' => 'Reference number']);

        $reference = strtoupper((string) $data['reference']);
        $mode = (string) ($data['mode'] ?? 'valid');

        if ($this->registrations->findByReference($reference) === null) {
            throw new NotFoundException('No registration with that reference.', 'REGISTRATION_NOT_FOUND');
        }

        $eventType = $mode === 'cancel' ? 'ticket.cancelled' : 'ticket.confirmed';

        /**
         * Exactly the payload shape the assignment specifies, field names
         * included. The point of a stand-in is that the real provider can be
         * dropped in without anything else changing, so it has to send what
         * the real one would — not a shape convenient to us.
         */
        $body = json_encode([
            'event' => $eventType,
            'registration_reference' => $reference,
            'ticket_id' => self::ticketId(),
            'status' => $mode === 'cancel' ? 'cancelled' : 'confirmed',
            'confirmed_at' => date('c'),
        ], JSON_UNESCAPED_SLASHES);

        // Deliberately five minutes past the tolerance window, to demonstrate
        // that a captured request cannot simply be replayed later.
        $timestamp = (string) ($mode === 'stale'
            ? time() - Env::int('WEBHOOK_TOLERANCE_SECONDS', 300) - 300
            : time());

        $signature = $mode === 'bad_signature'
            // Signed with the wrong key, so it is a genuinely invalid
            // signature rather than a malformed string.
            ? SignatureService::sign($body, $timestamp, 'this-is-not-the-real-secret')
            : SignatureService::sign($body, $timestamp);

        // A duplicate reuses a fixed delivery id so the second send collides
        // with the first on the unique index, which is the real mechanism.
        $deliveryId = $mode === 'duplicate'
            ? 'whd_sim_' . strtolower($reference)
            : 'whd_sim_' . bin2hex(random_bytes(10));

        // Build the inbound request the ticketing system would have sent and
        // hand it to the very same handler the public endpoint uses. Nothing
        // about the verification path is bypassed.
        $simulated = new Request(
            'POST',
            '/api/webhooks/ticketing',
            [
                'content-type' => 'application/json',
                'x-signature' => $signature,
                'x-timestamp' => $timestamp,
                'x-webhook-id' => $deliveryId,
            ],
            $body,
            [],
            $request->ip(),
        );

        $result = $this->webhooks->handle($simulated);

        return Response::success([
            'mode' => $mode,
            'outcome' => $result['outcome'],
            'status' => $result['status'],
            'message' => $result['message'],
            'delivery_id' => $result['delivery_id'],
            'registration' => $this->registrations->findByReference($reference),
        ]);
    }

    private static function ticketId(): string
    {
        return sprintf('TKT-%04d-%s', random_int(1000, 9999), strtoupper(bin2hex(random_bytes(2))));
    }
}
