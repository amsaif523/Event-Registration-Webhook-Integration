<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Repositories\WebhookEventRepository;
use App\Services\WebhookService;

final class WebhookController
{
    public function __construct(
        private readonly WebhookService $service = new WebhookService(),
        private readonly WebhookEventRepository $log = new WebhookEventRepository(),
    ) {
    }

    /**
     * POST /api/webhooks/ticketing
     *
     * The one endpoint whose path is fixed by the assignment. Unauthenticated
     * by design: the caller is another server, which proves itself with the
     * HMAC signature rather than a session cookie.
     */
    public function ticketing(Request $request): Response
    {
        $result = $this->service->handle($request);

        // A rejected delivery must not come back as success: true with a 401.
        // Only an accepted delivery, and a duplicate of one, are successes —
        // the duplicate deliberately so, because 200 is what stops the sender
        // retrying something we have already handled.
        if (!in_array($result['outcome'], ['processed', 'duplicate'], true)) {
            return Response::error(
                $result['status'],
                strtoupper($result['outcome']),
                $result['message'],
            );
        }

        return Response::success([
            'outcome' => $result['outcome'],
            'delivery_id' => $result['delivery_id'],
            'message' => $result['message'],
        ], $result['status']);
    }

    /** POST /api/webhooks/list — admin only. The audit trail. */
    public function list(Request $request): Response
    {
        return Response::success($this->log->paginate($request->body()));
    }
}
