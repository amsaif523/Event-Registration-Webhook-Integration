<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Cookie;
use App\Core\Env;
use App\Core\Exceptions\TooManyRequestsException;
use App\Core\Exceptions\UnauthorizedException;
use App\Core\Jwt;
use App\Core\Request;
use App\Repositories\RefreshTokenRepository;
use App\Repositories\UserRepository;

/**
 * Sign-in, token issue, rotation and revocation.
 *
 * The pair, and why it is a pair:
 *
 *  - The **access token** is a short-lived JWT. It is self-contained, so every
 *    request can be authorised without touching the database — but for the same
 *    reason it cannot be withdrawn once issued. Hence fifteen minutes.
 *  - The **refresh token** is a long-lived random string, stored hashed, used
 *    only against /api/auth/refresh. It is a database row, so it can be
 *    revoked, and revoking it is what "sign out" actually does.
 *
 * Both live in HttpOnly cookies. That is the point of the design: JavaScript
 * cannot read them, so an XSS on the page cannot walk off with the session the
 * way it could from localStorage.
 */
final class AuthService
{
    public const ACCESS_COOKIE = 'eventide_access';
    public const REFRESH_COOKIE = 'eventide_refresh';

    /**
     * The refresh cookie is scoped to the one path that consumes it, so it is
     * not attached to every ordinary API call. Fewer requests carrying it means
     * fewer chances to leak it.
     */
    public const REFRESH_PATH = '/api/auth';

    public function __construct(
        private readonly UserRepository $users = new UserRepository(),
        private readonly RefreshTokenRepository $refreshTokens = new RefreshTokenRepository(),
    ) {
    }

    /**
     * @return array{user: array<string, mixed>, cookies: Cookie[]}
     *
     * @throws UnauthorizedException|TooManyRequestsException
     */
    public function login(string $identifier, string $password, Request $request): array
    {
        $user = $this->users->findByIdentifier($identifier);

        if ($user === null) {
            // Spend the time a real verification would, so response timing does
            // not reveal which accounts exist.
            password_verify($password, '$2y$12$usesomesillystringfoeleventysevenletters.pointless');

            throw new UnauthorizedException('Incorrect username or password.', 'INVALID_CREDENTIALS');
        }

        if ($user['locked_until'] !== null && strtotime((string) $user['locked_until']) > time()) {
            $seconds = strtotime((string) $user['locked_until']) - time();

            throw new TooManyRequestsException(
                sprintf('Too many failed attempts. Try again in %d minute(s).', max(1, (int) ceil($seconds / 60))),
                'ACCOUNT_LOCKED',
            );
        }

        if (!password_verify($password, (string) $user['password_hash'])) {
            $this->users->registerFailedAttempt(
                (int) $user['id'],
                Env::int('LOGIN_MAX_ATTEMPTS', 5),
                Env::int('LOGIN_LOCKOUT_SECONDS', 900),
            );

            // Same message either way: never confirm that the account exists.
            throw new UnauthorizedException('Incorrect username or password.', 'INVALID_CREDENTIALS');
        }

        // Opportunistically upgrade the hash if PHP's default has moved on.
        if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
            $this->users->updatePasswordHash((int) $user['id'], password_hash($password, PASSWORD_DEFAULT));
        }

        $this->users->registerSuccessfulLogin((int) $user['id']);

        return [
            'user' => UserRepository::publicShape($user),
            'cookies' => $this->issue($user, bin2hex(random_bytes(16)), $request),
        ];
    }

    /**
     * Exchange a refresh token for a fresh pair, rotating the old one.
     *
     * @return array{user: array<string, mixed>, cookies: Cookie[]}
     */
    public function refresh(Request $request): array
    {
        $token = $request->cookie(self::REFRESH_COOKIE);
        if ($token === null || $token === '') {
            throw new UnauthorizedException('No refresh token was sent.', 'REFRESH_MISSING');
        }

        $record = $this->refreshTokens->find($token);
        if ($record === null) {
            throw new UnauthorizedException('That session is no longer valid.', 'REFRESH_UNKNOWN');
        }

        /**
         * Reuse detection. A token that has already been rotated should never
         * come back: the legitimate client swapped it for a new one and threw
         * it away. Seeing it again means a copy exists somewhere it should not,
         * and there is no way to tell whether the presenter is the thief or the
         * victim. So the entire family from that login is revoked and everyone
         * signs in again.
         */
        if ($record['revoked_at'] !== null) {
            $revoked = $this->refreshTokens->revokeFamily((string) $record['family_id']);

            throw new UnauthorizedException(
                'This session was ended for security reasons. Please sign in again.',
                'REFRESH_REUSED',
            );
        }

        if (strtotime((string) $record['expires_at']) <= time()) {
            throw new UnauthorizedException('That session has expired.', 'REFRESH_EXPIRED');
        }

        $user = $this->users->findById((int) $record['user_id']);
        if ($user === null) {
            throw new UnauthorizedException('That account no longer exists.', 'USER_GONE');
        }

        $cookies = $this->issue($user, (string) $record['family_id'], $request, $token);

        return ['user' => UserRepository::publicShape($user), 'cookies' => $cookies];
    }

    /**
     * Sign out.
     *
     * Revokes the whole token family, not just the refresh token that was
     * presented. That is deliberate and it is what makes signing out mean
     * something: the access token carries this family's id, and Authenticate
     * refuses any token whose family has no live members. Revoking one row
     * would leave a copied access token working until it expired.
     *
     * Clearing the cookies is the smaller half of the job — cookies only bind
     * the browser that asked. Anyone who had already lifted the token would be
     * unaffected by that alone.
     *
     * @return Cookie[]
     */
    public function logout(Request $request): array
    {
        $token = $request->cookie(self::REFRESH_COOKIE);

        if ($token !== null && $token !== '') {
            $record = $this->refreshTokens->find($token);

            if ($record !== null) {
                $this->refreshTokens->revokeFamily((string) $record['family_id']);
            } else {
                $this->refreshTokens->revoke($token);
            }
        }

        return $this->clearCookies();
    }

    /** Ends every session for the user, on every device. */
    public function logoutEverywhere(int $userId): array
    {
        $this->refreshTokens->revokeAllForUser($userId);

        return $this->clearCookies();
    }

    /**
     * Mint a new pair and, when rotating, retire the token being replaced.
     *
     * @param array<string, mixed> $user
     *
     * @return Cookie[]
     */
    private function issue(array $user, string $familyId, Request $request, ?string $rotating = null): array
    {
        $accessTtl = Env::int('ACCESS_TOKEN_TTL', 900);
        $refreshTtl = Env::int('REFRESH_TOKEN_TTL', 2592000);

        $accessToken = Jwt::encode([
            'sub' => (int) $user['id'],
            'name' => $user['name'],
            'username' => $user['username'],
            'role' => $user['role'],
            // The session this token belongs to. Authenticate checks the family
            // is still live, which is what makes sign-out immediate rather than
            // "immediate once the token expires".
            'sid' => $familyId,
        ], $accessTtl);

        $refreshToken = bin2hex(random_bytes(32));
        $refreshExpires = time() + $refreshTtl;

        $this->refreshTokens->store(
            (int) $user['id'],
            $refreshToken,
            $familyId,
            $refreshExpires,
            $request->userAgent(),
            $request->ip(),
        );

        if ($rotating !== null) {
            $this->refreshTokens->markRotated($rotating, $refreshToken);
        }

        return [
            new Cookie(self::ACCESS_COOKIE, $accessToken, time() + $accessTtl, '/'),
            new Cookie(self::REFRESH_COOKIE, $refreshToken, $refreshExpires, self::REFRESH_PATH),
        ];
    }

    /** @return Cookie[] */
    private function clearCookies(): array
    {
        return [
            Cookie::forget(self::ACCESS_COOKIE, '/'),
            Cookie::forget(self::REFRESH_COOKIE, self::REFRESH_PATH),
        ];
    }
}
