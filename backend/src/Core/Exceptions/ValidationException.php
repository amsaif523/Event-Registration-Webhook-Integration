<?php

declare(strict_types=1);

namespace App\Core\Exceptions;

final class ValidationException extends HttpException
{
    /** @param array<string, string> $fields */
    public function __construct(array $fields, string $message = 'The submitted data is not valid.')
    {
        parent::__construct(422, 'VALIDATION_ERROR', $message, $fields);
    }
}
