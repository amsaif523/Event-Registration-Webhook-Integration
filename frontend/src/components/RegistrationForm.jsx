import { useRef, useState } from 'react';
import { ApiError } from '../api/index.js';
import { REGISTRATION_FIELDS, validateField, validateRegistration } from '../lib/validation.js';
import { eventFacts } from '../lib/events.js';
import { Field, TextInput } from './ui/Field.jsx';
import PhoneField from './ui/PhoneField.jsx';
import { Banner } from './ui/States.jsx';
import Button from './ui/Button.jsx';
import Icon from './icons/Icon.jsx';

const FIELD_CONFIG = [
  { name: 'first_name', label: 'First name', autoComplete: 'given-name', placeholder: 'Jane' },
  { name: 'last_name', label: 'Last name', autoComplete: 'family-name', placeholder: 'Doe' },
  {
    name: 'email',
    label: 'Email address',
    type: 'email',
    autoComplete: 'email',
    placeholder: 'you@example.com',
    helper: 'Your reference number is shown on screen after you register.',
    full: true,
  },
];

const EMPTY = { first_name: '', last_name: '', email: '', phone: '' };

/**
 * Client-side rules mirror the backend exactly, but the server is still the
 * authority: a 422 comes back with per-field messages and those overwrite ours.
 * Errors only appear once a field has been blurred, so the form does not shout
 * at someone who is still typing their first character.
 */
export default function RegistrationForm({ event, onRegistered, idPrefix = 'reg' }) {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState(null);
  const formRef = useRef(null);

  const facts = eventFacts(event);
  const locked = !facts.registerable || submitting;

  const setValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (touched[name]) {
      setErrors((current) => ({ ...current, [name]: validateField(name, value) }));
    }
    setFailure(null);
  };

  const onBlur = (name) => {
    setTouched((current) => ({ ...current, [name]: true }));
    setErrors((current) => ({ ...current, [name]: validateField(name, values[name]) }));
  };

  const focusFirstInvalid = (fieldErrors) => {
    const firstInvalid = REGISTRATION_FIELDS.find((field) => fieldErrors[field]);
    if (!firstInvalid) return;
    formRef.current?.querySelector(`#${idPrefix}-${firstInvalid}`)?.focus();
  };

  const submit = async (event_) => {
    event_.preventDefault();
    setFailure(null);

    const fieldErrors = validateRegistration(values);
    setTouched(Object.fromEntries(REGISTRATION_FIELDS.map((field) => [field, true])));
    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      focusFirstInvalid(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const registration = await onRegistered({ event_id: event.id, ...values });
      if (registration) setValues(EMPTY);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields ?? {}).length > 0) {
        setErrors(error.fields);
        focusFirstInvalid(error.fields);
      }
      setFailure({
        code: error?.code ?? 'UNKNOWN_ERROR',
        message: error?.message ?? 'Something went wrong. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      {failure && (
        <Banner
          tone={failure.code === 'EVENT_FULL' || failure.code === 'ALREADY_REGISTERED' ? 'warning' : 'error'}
          title={
            failure.code === 'EVENT_FULL'
              ? 'This event is now full'
              : failure.code === 'ALREADY_REGISTERED'
                ? 'This email is already registered for this event'
                : 'We could not complete your registration'
          }
          onDismiss={() => setFailure(null)}
        >
          {failure.code === 'EVENT_FULL'
            ? 'The last seat was taken while you were filling in the form. Nothing has been charged or saved.'
            : failure.code === 'ALREADY_REGISTERED'
              ? 'Use your existing reference number to track that registration instead.'
              : failure.message}
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELD_CONFIG.map((field) => (
          <Field
            key={field.name}
            label={field.label}
            required
            htmlFor={`${idPrefix}-${field.name}`}
            helper={field.helper}
            error={touched[field.name] ? errors[field.name] : undefined}
            className={field.full ? 'sm:col-span-2' : undefined}
          >
            <TextInput
              id={`${idPrefix}-${field.name}`}
              name={field.name}
              type={field.type ?? 'text'}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              value={values[field.name]}
              disabled={locked}
              error={touched[field.name] ? errors[field.name] : undefined}
              onChange={(e) => setValue(field.name, e.target.value)}
              onBlur={() => onBlur(field.name)}
            />
          </Field>
        ))}

        <Field
          label="Phone number"
          required
          htmlFor={`${idPrefix}-phone`}
          helper="Pick your country, then enter the number without the dialling code."
          error={touched.phone ? errors.phone : undefined}
          className="sm:col-span-2"
        >
          <PhoneField
            id={`${idPrefix}-phone`}
            value={values.phone}
            disabled={locked}
            error={touched.phone ? errors.phone : undefined}
            onChange={(phone) => setValue('phone', phone)}
            onBlur={() => onBlur('phone')}
          />
        </Field>
      </div>

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        loadingText="Registering…"
        disabled={!facts.registerable}
      >
        {facts.registerable ? 'Complete registration' : 'Registration closed'}
      </Button>

      <p className="flex items-start gap-1.5 text-[13px] text-meta">
        <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
        <span>
          Your seat is held as <strong className="font-medium text-body">pending</strong> until the ticketing
          system confirms it, usually within a few seconds.
        </span>
      </p>
    </form>
  );
}
