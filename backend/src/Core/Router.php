<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Exceptions\NotFoundException;

/**
 * Exact-match route table. No regex, no path parameters.
 *
 * Identifiers never appear in a URL (CLAUDE.md sections 6 and 11), so there is
 * nothing to extract from the path. That makes the router a hash lookup.
 */
final class Router
{
    /** @var array<string, array{0: callable, 1: callable[]}> */
    private array $routes = [];

    /** @param callable[] $middleware */
    public function add(string $method, string $path, callable $handler, array $middleware = []): void
    {
        $this->routes[strtoupper($method) . ' ' . $path] = [$handler, $middleware];
    }

    /** @param callable[] $middleware */
    public function post(string $path, callable $handler, array $middleware = []): void
    {
        $this->add('POST', $path, $handler, $middleware);
    }

    /** @param callable[] $middleware */
    public function get(string $path, callable $handler, array $middleware = []): void
    {
        $this->add('GET', $path, $handler, $middleware);
    }

    public function dispatch(Request $request): Response
    {
        $key = $request->method() . ' ' . $request->path();

        if (!isset($this->routes[$key])) {
            // Distinguish "wrong verb" from "no such endpoint": every endpoint
            // here is POST, and a GET against one is a client mistake worth
            // naming rather than a 404 to hunt for.
            foreach (array_keys($this->routes) as $existing) {
                if (str_ends_with($existing, ' ' . $request->path())) {
                    return Response::error(
                        405,
                        'METHOD_NOT_ALLOWED',
                        sprintf('%s is not allowed on %s. Every endpoint except /api/health is POST.', $request->method(), $request->path()),
                    );
                }
            }

            throw new NotFoundException(sprintf('No endpoint at %s.', $request->path()), 'ENDPOINT_NOT_FOUND');
        }

        [$handler, $middleware] = $this->routes[$key];

        foreach ($middleware as $layer) {
            $request = $layer($request);
        }

        return $handler($request);
    }
}
