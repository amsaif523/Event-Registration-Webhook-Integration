<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Exceptions\UnauthorizedException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Repositories\UserRepository;
use App\Services\AuthService;

/**
 * Sign in, refresh, sign out, and "who am I".
 *
 * No endpoint here returns a token in its body. The pair goes out as HttpOnly
 * cookies and the response carries only the user, so there is nothing for the
 * frontend to store and nothing for a script on the page to steal.
 */
final class AuthController
{
    public function __construct(
        private readonly AuthService $auth = new AuthService(),
        private readonly UserRepository $users = new UserRepository(),
    ) {
    }

    /** POST /api/auth/login */
    public function login(Request $request): Response
    {
        $data = Validator::validate($request->body(), [
            'username' => 'required|string|max:255',
            'password' => 'required|string|max:255',
        ], [
            'username' => 'Username or email',
            'password' => 'Password',
        ]);

        $result = $this->auth->login((string) $data['username'], (string) $data['password'], $request);

        $response = Response::success(['user' => $result['user']]);
        foreach ($result['cookies'] as $cookie) {
            $response->withCookie($cookie);
        }

        return $response;
    }

    /** POST /api/auth/refresh */
    public function refresh(Request $request): Response
    {
        $result = $this->auth->refresh($request);

        $response = Response::success(['user' => $result['user']]);
        foreach ($result['cookies'] as $cookie) {
            $response->withCookie($cookie);
        }

        return $response;
    }

    /** POST /api/auth/logout */
    public function logout(Request $request): Response
    {
        $response = Response::success(['signed_out' => true]);
        foreach ($this->auth->logout($request) as $cookie) {
            $response->withCookie($cookie);
        }

        return $response;
    }

    /** POST /api/auth/logout-everywhere — ends every session on every device. */
    public function logoutEverywhere(Request $request): Response
    {
        $response = Response::success(['signed_out' => true]);
        foreach ($this->auth->logoutEverywhere((int) $request->attribute('user_id')) as $cookie) {
            $response->withCookie($cookie);
        }

        return $response;
    }

    /**
     * POST /api/auth/me
     *
     * Lets the frontend restore a session on page load without keeping any
     * state of its own: the cookie is either valid or it is not.
     */
    public function me(Request $request): Response
    {
        $user = $this->users->findById((int) $request->attribute('user_id'));

        if ($user === null) {
            throw new UnauthorizedException('That account no longer exists.', 'USER_GONE');
        }

        return Response::success(['user' => UserRepository::publicShape($user)]);
    }
}
