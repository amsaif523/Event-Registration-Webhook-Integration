<?php

declare(strict_types=1);

namespace App\Core\Exceptions;

use RuntimeException;

/**
 * Base for anything the front controller should turn into a JSON error
 * response. Controllers throw; one place decides the status code and shape.
 */
class HttpException extends RuntimeException
{
    /** @param array<string, string> $fields */
    public function __construct(
        private readonly int $status,
        private readonly string $errorCode,
        string $message,
        private readonly array $fields = [],
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    /** @return array<string, string> */
    public function fields(): array
    {
        return $this->fields;
    }
}
