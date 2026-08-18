<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Exceptions\NotFoundException;
use App\Core\Exceptions\ValidationException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Repositories\EventRepository;

/**
 * Events: list, view, create, update.
 *
 * Every identifier arrives in the body, so all four are POST to a literal path.
 * `list` and `view` are public; `create` and `update` sit behind Authenticate.
 */
final class EventController
{
    public function __construct(private readonly EventRepository $events = new EventRepository())
    {
    }

    /**
     * POST /api/events/list — public.
     *
     * Forced to published events only. The status filter a client sends is
     * ignored here: letting the public list ask for drafts would expose events
     * that have not been announced.
     */
    public function publicList(Request $request): Response
    {
        $body = $request->body();
        $body['published_only'] = true;
        unset($body['status']);

        return Response::success($this->events->paginate($body));
    }

    /** POST /api/events/admin-list — every status, signed in only. */
    public function adminList(Request $request): Response
    {
        return Response::success($this->events->paginate($request->body()));
    }

    /** POST /api/events/view — public, but a draft is not viewable by the public. */
    public function view(Request $request): Response
    {
        $data = Validator::validate($request->body(), ['id' => 'required|integer|atleast:1']);

        $event = $this->events->find((int) $data['id']);
        if ($event === null) {
            throw new NotFoundException('That event does not exist.', 'EVENT_NOT_FOUND');
        }

        // Signed-in staff can see anything; everyone else only published events.
        $isStaff = $request->attribute('user_id') !== null;
        if (!$isStaff && $event['status'] === 'draft') {
            throw new NotFoundException('That event does not exist.', 'EVENT_NOT_FOUND');
        }

        return Response::success(['event' => $event]);
    }

    /** POST /api/events/create — admin. */
    public function create(Request $request): Response
    {
        $data = Validator::validate($request->body(), [
            'name' => 'required|string|max:255',
            'description' => 'string|max:2000',
            'event_date' => 'required|datetime',
            'venue' => 'required|string|max:255',
            'capacity' => 'required|integer|atleast:1|atmost:100000',
            'status' => 'in:draft,published,closed,cancelled',
        ], [
            'name' => 'Event name',
            'event_date' => 'Date and time',
        ]);

        $id = $this->events->create($data);

        return Response::created(['event' => $this->events->find($id)]);
    }

    /** POST /api/events/update — admin. Partial: only supplied fields change. */
    public function update(Request $request): Response
    {
        $data = Validator::validate($request->body(), [
            'id' => 'required|integer|atleast:1',
            'name' => 'string|max:255',
            'description' => 'string|max:2000',
            'event_date' => 'datetime',
            'venue' => 'string|max:255',
            'capacity' => 'integer|atleast:1|atmost:100000',
            'status' => 'in:draft,published,closed,cancelled',
        ], [
            'name' => 'Event name',
            'event_date' => 'Date and time',
        ]);

        $id = (int) $data['id'];
        $existing = $this->events->find($id);
        if ($existing === null) {
            throw new NotFoundException('That event does not exist.', 'EVENT_NOT_FOUND');
        }

        /**
         * Capacity below the seats already taken is refused outright here,
         * unlike the admin UI which warns and allows. The UI can afford to be
         * permissive because a human is reading the warning; the API cannot,
         * because it has no idea whether anyone saw it. If overselling is ever
         * genuinely wanted it should be an explicit flag, not a silent default.
         */
        if (array_key_exists('capacity', $data) && (int) $data['capacity'] < $existing['seats_taken']) {
            throw new ValidationException([
                'capacity' => sprintf(
                    'Capacity cannot be below the %d seat(s) already taken.',
                    $existing['seats_taken'],
                ),
            ]);
        }

        unset($data['id']);
        $this->events->update($id, $data);

        return Response::success(['event' => $this->events->find($id)]);
    }
}
