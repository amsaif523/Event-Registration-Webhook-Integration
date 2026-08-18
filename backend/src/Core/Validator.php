<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Exceptions\ValidationException;

/**
 * Rule-based validation returning field-level errors.
 *
 * Rules are strings so a controller reads as a specification of its input:
 *   ['email' => 'required|email|max:255']
 *
 * The first failing rule per field wins; reporting six problems about one
 * empty box helps nobody.
 */
final class Validator
{
    /** @var array<string, string> */
    private array $errors = [];

    /** @var array<string, mixed> */
    private array $valid = [];

    /**
     * @param array<string, mixed>  $data
     * @param array<string, string> $rules
     */
    public function __construct(
        private readonly array $data,
        private readonly array $rules,
        /** @var array<string, string> */
        private readonly array $labels = [],
    ) {
        $this->run();
    }

    /**
     * @param array<string, mixed>  $data
     * @param array<string, string> $rules
     * @param array<string, string> $labels
     *
     * @return array<string, mixed> the validated subset
     *
     * @throws ValidationException
     */
    public static function validate(array $data, array $rules, array $labels = []): array
    {
        $validator = new self($data, $rules, $labels);

        if ($validator->fails()) {
            throw new ValidationException($validator->errors());
        }

        return $validator->validated();
    }

    public function fails(): bool
    {
        return $this->errors !== [];
    }

    /** @return array<string, string> */
    public function errors(): array
    {
        return $this->errors;
    }

    /** @return array<string, mixed> */
    public function validated(): array
    {
        return $this->valid;
    }

    private function run(): void
    {
        foreach ($this->rules as $field => $ruleString) {
            $value = $this->data[$field] ?? null;
            $rules = explode('|', $ruleString);
            $optional = !in_array('required', $rules, true);

            if ($this->isEmpty($value)) {
                if ($optional) {
                    // Absent optional fields are simply not in the output, so a
                    // partial update does not overwrite columns with null.
                    if (array_key_exists($field, $this->data)) {
                        $this->valid[$field] = $value;
                    }

                    continue;
                }

                $this->errors[$field] = sprintf('%s is required.', $this->label($field));

                continue;
            }

            foreach ($rules as $rule) {
                $message = $this->check($field, $value, $rule);
                if ($message !== null) {
                    $this->errors[$field] = $message;

                    continue 2;
                }
            }

            $this->valid[$field] = is_string($value) ? trim($value) : $value;
        }
    }

    private function isEmpty(mixed $value): bool
    {
        return $value === null || (is_string($value) && trim($value) === '');
    }

    private function check(string $field, mixed $value, string $rule): ?string
    {
        [$name, $parameter] = array_pad(explode(':', $rule, 2), 2, null);
        $label = $this->label($field);

        return match ($name) {
            'required' => null,
            'string' => is_string($value) ? null : sprintf('%s must be text.', $label),
            'email' => filter_var((string) $value, FILTER_VALIDATE_EMAIL)
                ? null
                : 'Enter a valid email address.',
            'min' => mb_strlen(trim((string) $value)) >= (int) $parameter
                ? null
                : sprintf('%s must be at least %d characters.', $label, (int) $parameter),
            'max' => mb_strlen(trim((string) $value)) <= (int) $parameter
                ? null
                : sprintf('%s must be %d characters or fewer.', $label, (int) $parameter),
            'integer' => filter_var($value, FILTER_VALIDATE_INT) !== false
                ? null
                : sprintf('%s must be a whole number.', $label),
            'atleast' => (int) $value >= (int) $parameter
                ? null
                : sprintf('%s must be at least %d.', $label, (int) $parameter),
            'atmost' => (int) $value <= (int) $parameter
                ? null
                : sprintf('%s must be %d or less.', $label, (int) $parameter),
            'phone' => preg_match('/^\+?[1-9]\d{7,14}$/', preg_replace('/[\s()-]/', '', (string) $value) ?? '')
                ? null
                : 'Enter a valid phone number, including the country code.',
            'datetime' => $this->isDateTime((string) $value)
                ? null
                : sprintf('%s must be a valid date and time.', $label),
            'in' => in_array((string) $value, explode(',', (string) $parameter), true)
                ? null
                : sprintf('%s must be one of: %s.', $label, str_replace(',', ', ', (string) $parameter)),
            // Case-insensitive: people type their reference in from a
            // screenshot or read it off a phone, and the controller uppercases
            // it anyway. Rejecting lowercase here would fail them before the
            // normalisation they never knew about could run.
            'reference' => preg_match('/^EVT-[A-Z0-9]{8}$/i', (string) $value)
                ? null
                : 'That does not look like a reference number.',
            default => null,
        };
    }

    private function isDateTime(string $value): bool
    {
        foreach (['Y-m-d H:i:s', 'Y-m-d\TH:i:s', 'Y-m-d\TH:i', 'Y-m-d H:i'] as $format) {
            $parsed = \DateTimeImmutable::createFromFormat($format, $value);
            if ($parsed instanceof \DateTimeImmutable && $parsed->format($format) === $value) {
                return true;
            }
        }

        return false;
    }

    private function label(string $field): string
    {
        return $this->labels[$field] ?? ucfirst(str_replace('_', ' ', $field));
    }
}
