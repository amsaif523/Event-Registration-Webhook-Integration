<?php

declare(strict_types=1);

namespace App\Core\Exceptions;

/** 409: the request was understood and valid, but the current state refuses it. */
final class ConflictException extends HttpException
{
    public function __construct(string $message, string $code = 'CONFLICT')
    {
        parent::__construct(409, $code, $message);
    }
}
