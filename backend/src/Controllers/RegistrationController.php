<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Exceptions\NotFoundException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Repositories\RegistrationRepository;
use App\Services\RegistrationService;

final class RegistrationController
{
    public function __construct(
        private readonly RegistrationService $service = new RegistrationService(),
        private readonly RegistrationRepository $registrations = new RegistrationRepository(),
    ) {
    }

    /** POST /api/registrations/create — public. */
    public function create(Request $request): Response
    {
        $data = Validator::validate($request->body(), [
            'event_id' => 'required|integer|atleast:1',
            'first_name' => 'required|string|min:2|max:100',
            'last_name' => 'required|string|min:2|max:100',
            'email' => 'required|email|max:255',
            'phone' => 'required|phone|max:30',
        ], [
            'first_name' => 'First name',
            'last_name' => 'Last name',
            'email' => 'Email address',
            'phone' => 'Phone number',
            'event_id' => 'Event',
        ]);

        return Response::created(['registration' => $this->service->register($data)]);
    }

    /**
     * POST /api/registrations/status — public, keyed by the reference.
     *
     * The reference is the only credential. That is why it is random and why it
     * never appears in a URL: it is a bearer token for one person's data.
     */
    public function status(Request $request): Response
    {
        $data = Validator::validate($request->body(), [
            'reference' => 'required|reference',
        ], ['reference' => 'Reference number']);

        $registration = $this->registrations->findByReference(strtoupper((string) $data['reference']));

        if ($registration === null) {
            throw new NotFoundException(
                'We could not find a registration with that reference.',
                'REGISTRATION_NOT_FOUND',
            );
        }

        return Response::success(['registration' => $registration]);
    }

    /**
     * POST /api/registrations/list — admin only.
     *
     * Behind authentication because it returns every registrant's name, email
     * and phone number. An unauthenticated list endpoint here would be a data
     * breach, not a missing feature.
     */
    public function list(Request $request): Response
    {
        return Response::success($this->registrations->paginate($request->body()));
    }
}
