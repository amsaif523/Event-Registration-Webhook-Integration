<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Exceptions\UnauthorizedException;
use App\Core\Jwt;
use App\Core\Request;
use App\Repositories\RefreshTokenRepository;
use App\Services\AuthService;

/**
 * Guards the admin endpoints.
 *
 * Reads the access token from its HttpOnly cookie and verifies it. Nothing is
 * read from an Authorization header: the token is never in JavaScript's hands,
 * so it cannot be put there.
 *
 * Two checks, not one:
 *
 *  1. The signature and validity window, which is pure computation.
 *  2. That the token's session is still live.
 *
 * The second check is the important one, and it is a deliberate departure from
 * the usual stateless-JWT posture. A signature-only check means a token stays
 * valid until it expires no matter what happens in between — so signing out,
 * or discovering a token has been stolen, would leave an attacker with a
 * working credential for the rest of its lifetime. Cookies being cleared does
 * nothing to someone who already copied the value.
 *
 * So every access token carries the id of the session that minted it, and this
 * asks the database whether that session still has a live refresh token. Sign
 * out revokes the whole family, and the next request with the stolen token is
 * refused immediately.
 *
 * The cost is one indexed lookup per authenticated request, which gives up the
 * "no database round trip" property people choose JWTs for. That is the right
 * trade here: being able to revoke a session now is worth more than saving a
 * primary-key hit, and the alternative — very short token lifetimes and hoping
 * — is not really a security control.
 */
final class Authenticate
{
    public function __construct(
        private readonly RefreshTokenRepository $sessions = new RefreshTokenRepository(),
    ) {
    }

    public function __invoke(Request $request): Request
    {
        $token = $request->cookie(AuthService::ACCESS_COOKIE);

        if ($token === null || $token === '') {
            throw new UnauthorizedException('You need to sign in to do that.', 'UNAUTHENTICATED');
        }

        // Throws with a specific code; TOKEN_EXPIRED is the one the frontend
        // reacts to by calling /api/auth/refresh instead of bouncing to login.
        $claims = Jwt::decode($token);

        $userId = (int) ($claims['sub'] ?? 0);
        if ($userId <= 0) {
            throw new UnauthorizedException('That token is not usable.', 'TOKEN_SUBJECT');
        }

        $sessionId = (string) ($claims['sid'] ?? '');
        if ($sessionId === '') {
            // Issued before sessions were bound into the token. Treat as
            // untrustworthy rather than waving it through.
            throw new UnauthorizedException('Please sign in again.', 'SESSION_UNKNOWN');
        }

        if (!$this->sessions->familyIsActive($sessionId)) {
            throw new UnauthorizedException(
                'This session has ended. Please sign in again.',
                'SESSION_REVOKED',
            );
        }

        return $request
            ->withAttribute('user_id', $userId)
            ->withAttribute('user_role', (string) ($claims['role'] ?? 'admin'))
            ->withAttribute('user_name', (string) ($claims['name'] ?? ''))
            ->withAttribute('session_id', $sessionId);
    }
}
