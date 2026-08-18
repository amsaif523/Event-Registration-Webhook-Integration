<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Exceptions\HttpException;
use App\Core\Request;

/**
 * Requires Content-Type: application/json on state-changing requests.
 *
 * This is CSRF defence in depth. SameSite=Strict on the auth cookies already
 * means a browser will not attach them to a cross-site request, but a form
 * post from another origin can only send text/plain, multipart/form-data or
 * application/x-www-form-urlencoded. Insisting on application/json means such a
 * request cannot reach a handler at all, and a fetch that does set the header
 * has to pass a CORS preflight we never answer.
 */
final class RequireJson
{
    public function __invoke(Request $request): Request
    {
        if ($request->method() !== 'GET' && !$request->isJson()) {
            throw new HttpException(
                415,
                'UNSUPPORTED_MEDIA_TYPE',
                'Requests must be sent with Content-Type: application/json.',
            );
        }

        return $request;
    }
}
