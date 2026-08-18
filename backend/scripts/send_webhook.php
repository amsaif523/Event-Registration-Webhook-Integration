<?php

declare(strict_types=1);

/**
 * Fires a correctly signed webhook at the running app, from the command line.
 *
 * The counterpart to the in-app simulator, for when you would rather see the
 * raw HTTP. It signs with WEBHOOK_SECRET from .env, so it proves the same path
 * a real ticketing provider would take.
 *
 * Usage:
 *   php scripts/send_webhook.php EVT-7QK3M2XD
 *   php scripts/send_webhook.php EVT-7QK3M2XD --mode=bad_signature
 *   php scripts/send_webhook.php EVT-7QK3M2XD --mode=duplicate --url=http://localhost/api/webhooks/ticketing
 *
 * Modes: valid (default), bad_signature, duplicate, stale, cancel
 */

use App\Core\Env;
use App\Services\SignatureService;

require dirname(__DIR__) . '/bootstrap.php';

$reference = null;
$mode = 'valid';
$url = 'http://127.0.0.1:8080/api/webhooks/ticketing';

foreach (array_slice($argv, 1) as $argument) {
    if (str_starts_with($argument, '--mode=')) {
        $mode = substr($argument, 7);
    } elseif (str_starts_with($argument, '--url=')) {
        $url = substr($argument, 6);
    } elseif (!str_starts_with($argument, '--')) {
        $reference = strtoupper($argument);
    }
}

if ($reference === null) {
    fwrite(STDERR, "Usage: php scripts/send_webhook.php <REFERENCE> [--mode=valid|bad_signature|duplicate|stale|cancel] [--url=...]\n");
    exit(1);
}

$eventType = $mode === 'cancel' ? 'ticket.cancelled' : 'ticket.confirmed';

// The payload shape the assignment specifies, field names included.
$body = json_encode([
    'event' => $eventType,
    'registration_reference' => $reference,
    'ticket_id' => sprintf('TKT-%04d-%s', random_int(1000, 9999), strtoupper(bin2hex(random_bytes(2)))),
    'status' => $mode === 'cancel' ? 'cancelled' : 'confirmed',
    'confirmed_at' => date('c'),
], JSON_UNESCAPED_SLASHES);

$tolerance = Env::int('WEBHOOK_TOLERANCE_SECONDS', 300);
$timestamp = (string) ($mode === 'stale' ? time() - $tolerance - 300 : time());

$signature = $mode === 'bad_signature'
    ? SignatureService::sign($body, $timestamp, 'deliberately-the-wrong-secret')
    : SignatureService::sign($body, $timestamp);

// A duplicate reuses a fixed delivery id, so the second run collides on the
// unique index — which is the mechanism being demonstrated.
$deliveryId = $mode === 'duplicate'
    ? 'whd_cli_' . strtolower($reference)
    : 'whd_cli_' . bin2hex(random_bytes(10));

echo "POST {$url}\n";
echo "  mode         {$mode}\n";
echo "  delivery id  {$deliveryId}\n";
echo "  timestamp    {$timestamp}" . ($mode === 'stale' ? "  (deliberately outside the window)\n" : "\n");
echo "  signature    " . substr($signature, 0, 24) . "...\n";
echo "  body         {$body}\n\n";

$handle = curl_init($url);
curl_setopt_array($handle, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'X-Signature: ' . $signature,
        'X-Timestamp: ' . $timestamp,
        'X-Webhook-Id: ' . $deliveryId,
    ],
]);

$response = curl_exec($handle);

if ($response === false) {
    fwrite(STDERR, 'Request failed: ' . curl_error($handle) . "\n");
    fwrite(STDERR, "Is the server running? Try: php -S 127.0.0.1:8080 -t public public/index.php\n");
    exit(1);
}

$status = curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
// No curl_close(): it has done nothing since PHP 8.0 and is deprecated in 8.5.
// The handle is released when it goes out of scope.
unset($handle);

echo "HTTP {$status}\n";
echo json_encode(json_decode((string) $response, true), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";

// A rejected delivery should exit non-zero so this is usable in a script.
exit($status >= 200 && $status < 300 ? 0 : 1);
