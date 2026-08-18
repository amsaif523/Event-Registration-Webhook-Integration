import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { validateEventForm } from '../../lib/validation.js';
import { statusMeta, statusValues } from '../../lib/status.js';
import { formatNumber } from '../../lib/format.js';
import SlideOver from '../ui/SlideOver.jsx';
import Button from '../ui/Button.jsx';
import { Banner } from '../ui/States.jsx';
import { Field, NumberStepper, TextArea, TextInput } from '../ui/Field.jsx';
import SelectMenu from '../ui/SelectMenu.jsx';

// MUI and its date pickers are a large dependency for one field. Loading it
// lazily keeps it out of the public bundle entirely — nothing on the visitor
// side of the app ever renders this panel.
const DateTimeField = lazy(() => import('../ui/DateTimeField.jsx'));

const DESCRIPTION_LIMIT = 2000;

const STATUS_OPTIONS = statusValues('event').map((value) => ({
  value,
  label: statusMeta('event', value).label,
}));

const BLANK = {
  name: '',
  description: '',
  event_date: '',
  venue: '',
  capacity: '50',
  status: 'draft',
};

/** MySQL DATETIME <-> the value shape datetime-local expects. */
const toInputValue = (value) => (value ? String(value).replace(' ', 'T').slice(0, 16) : '');
const toStoredValue = (value) => (value ? `${value.replace('T', 'T')}:00`.slice(0, 19) : '');

/**
 * Create and edit share one panel. A slide-over rather than a centred modal so
 * the table stays visible behind it while you work down a list.
 */
export default function EventSlideOver({ open, event, onClose, onSave }) {
  const [values, setValues] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState(null);

  const isEdit = Boolean(event?.id);
  const seatsTaken = Number(event?.seats_taken ?? 0);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFailure(null);
    setValues(
      event
        ? {
            name: event.name ?? '',
            description: event.description ?? '',
            event_date: toInputValue(event.event_date),
            venue: event.venue ?? '',
            capacity: String(event.capacity ?? ''),
            status: event.status ?? 'draft',
          }
        : BLANK,
    );
  }, [open, event]);

  const setValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFailure(null);
  };

  /**
   * Reducing capacity below the seats already taken is a real decision, not a
   * typo, so it warns inline and keeps the Save button live rather than
   * silently allowing it or silently blocking it.
   */
  const capacityWarning = useMemo(() => {
    if (!isEdit) return null;
    const next = Number(values.capacity);
    if (!Number.isFinite(next) || next >= seatsTaken) return null;
    return `${formatNumber(seatsTaken)} people are already registered. Saving a capacity of ${formatNumber(
      next,
    )} leaves the event over capacity; no existing registration is removed.`;
  }, [isEdit, values.capacity, seatsTaken]);

  const submit = async (formEvent) => {
    formEvent.preventDefault();
    const fieldErrors = validateEventForm(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSaving(true);
    setFailure(null);
    try {
      await onSave({
        ...(isEdit ? { id: event.id } : {}),
        name: values.name.trim(),
        description: values.description.trim(),
        event_date: toStoredValue(values.event_date),
        venue: values.venue.trim(),
        capacity: Number(values.capacity),
        status: values.status,
      });
      onClose();
    } catch (error) {
      setFailure(error?.message ?? 'The event could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit event' : 'Create event'}
      description={
        isEdit ? 'Changes apply immediately once saved.' : 'Draft events stay hidden from the public list.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" loading={saving} loadingText="Saving…">
            {isEdit ? 'Save changes' : 'Create event'}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} noValidate className="space-y-5">
        {failure && <Banner tone="error" title="Could not save">{failure}</Banner>}

        <Field label="Event name" required htmlFor="event-name" error={errors.name}>
          <TextInput
            id="event-name"
            value={values.name}
            error={errors.name}
            placeholder="A short, specific title"
            onChange={(e) => setValue('name', e.target.value)}
          />
        </Field>

        <Field
          label="Description"
          htmlFor="event-description"
          error={errors.description}
          counter={`${values.description.length} / ${DESCRIPTION_LIMIT}`}
          helper="Shown on the event card and detail page."
        >
          <TextArea
            id="event-description"
            rows={5}
            maxLength={DESCRIPTION_LIMIT}
            value={values.description}
            error={errors.description}
            placeholder="What is this event, who is it for, and what will people leave with?"
            onChange={(e) => setValue('description', e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date and time" required htmlFor="event-date" error={errors.event_date}>
            <Suspense fallback={<div className="h-11 w-full rounded border border-hairline bg-slate-50" />}>
              <DateTimeField
                id="event-date"
                value={values.event_date}
                error={errors.event_date}
                onChange={(next) => setValue('event_date', next)}
              />
            </Suspense>
          </Field>

          <Field label="Status" required htmlFor="event-status">
            <SelectMenu
              id="event-status"
              label="Event status"
              value={values.status}
              onChange={(value) => setValue('status', value)}
              searchPlaceholder="Search statuses…"
              options={STATUS_OPTIONS}
            />
          </Field>
        </div>

        <Field label="Venue" required htmlFor="event-venue" error={errors.venue}>
          <TextInput
            id="event-venue"
            value={values.venue}
            error={errors.venue}
            placeholder="Building, area, city"
            onChange={(e) => setValue('venue', e.target.value)}
          />
        </Field>

        <Field
          label="Capacity"
          required
          htmlFor="event-capacity"
          error={errors.capacity}
          helper={isEdit ? `${formatNumber(seatsTaken)} seats currently taken.` : 'Total seats available.'}
        >
          <NumberStepper
            id="event-capacity"
            min={1}
            value={values.capacity}
            error={errors.capacity}
            onChange={(value) => setValue('capacity', value)}
          />
        </Field>

        {capacityWarning && (
          <Banner tone="warning" title="Capacity is below current registrations">
            {capacityWarning}
          </Banner>
        )}
      </form>
    </SlideOver>
  );
}
