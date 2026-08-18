<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Database;
use App\Core\Request;
use App\Core\Response;

/**
 * The one GET in the application. It carries no identifiers, so it does not
 * break the "nothing in the URL" rule, and being a GET means a browser or an
 * uptime check can hit it without ceremony.
 */
final class HealthController
{
    public function __invoke(Request $request): Response
    {
        $database = 'connected';

        try {
            Database::connection()->query('SELECT 1');
        } catch (\Throwable $e) {
            $database = 'unavailable';
        }

        return Response::success([
            'status' => $database === 'connected' ? 'ok' : 'degraded',
            'db' => $database,
            'time' => date('c'),
        ], $database === 'connected' ? 200 : 503);
    }
}
