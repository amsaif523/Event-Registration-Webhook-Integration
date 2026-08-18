<?php

declare(strict_types=1);

namespace App\Core\Exceptions;

final class NotFoundException extends HttpException
{
    public function __construct(string $message = 'Resource not found.', string $code = 'NOT_FOUND')
    {
        parent::__construct(404, $code, $message);
    }
}
