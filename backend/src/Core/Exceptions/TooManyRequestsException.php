<?php

declare(strict_types=1);

namespace App\Core\Exceptions;

final class TooManyRequestsException extends HttpException
{
    public function __construct(string $message, string $code = 'TOO_MANY_ATTEMPTS')
    {
        parent::__construct(429, $code, $message);
    }
}
