/**
 * Client-side validation that mirrors the backend rules one for one.
 * This is a convenience layer only: the server validates everything again and
 * its 422 field errors overwrite whatever we decided here.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// E.164: a leading + then 8 to 15 digits in total, including the country code.
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

const RULES = {
  first_name: (v) => {
    if (!v.trim()) return 'First name is required';
    if (v.trim().length < 2) return 'First name must be at least 2 characters';
    if (v.trim().length > 100) return 'First name must be 100 characters or fewer';
    return null;
  },
  last_name: (v) => {
    if (!v.trim()) return 'Last name is required';
    if (v.trim().length < 2) return 'Last name must be at least 2 characters';
    if (v.trim().length > 100) return 'Last name must be 100 characters or fewer';
    return null;
  },
  email: (v) => {
    if (!v.trim()) return 'Email address is required';
    if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address';
    if (v.trim().length > 255) return 'Email must be 255 characters or fewer';
    return null;
  },
  phone: (v) => {
    // The country picker seeds the field with a dial code before anything is
    // typed, so "+91" on its own counts as empty rather than as invalid.
    const compact = v.replace(/[\s()-]/g, '');
    if (!compact || /^\+?\d{0,4}$/.test(compact)) return 'Phone number is required';
    if (!PHONE_RE.test(compact)) return 'Enter a valid phone number for the country you selected';
    return null;
  },
};

export const REGISTRATION_FIELDS = ['first_name', 'last_name', 'email', 'phone'];

export function validateField(name, value) {
  const rule = RULES[name];
  return rule ? rule(String(value ?? '')) : null;
}

export function validateRegistration(values) {
  const errors = {};
  for (const field of REGISTRATION_FIELDS) {
    const message = validateField(field, values[field]);
    if (message) errors[field] = message;
  }
  return errors;
}

/**
 * Admin sign-in. The username field accepts either an email address or a plain
 * username, so the rule is deliberately loose: reject only what could not be
 * either.
 */
export function validateAdminLogin({ username, password }) {
  const errors = {};
  const user = String(username ?? '').trim();
  const pass = String(password ?? '');

  if (!user) errors.username = 'Username or email is required';
  else if (user.includes('@') && !EMAIL_RE.test(user)) errors.username = 'Enter a valid email address';
  else if (!user.includes('@') && user.length < 3)
    errors.username = 'Username must be at least 3 characters';
  else if (user.length > 255) errors.username = 'Username must be 255 characters or fewer';

  if (!pass) errors.password = 'Password is required';
  else if (pass.length < 8) errors.password = 'Password must be at least 8 characters';

  return errors;
}

/** Admin event form. Capacity below current registrations is a warning, not an error. */
export function validateEventForm(values) {
  const errors = {};
  if (!String(values.name ?? '').trim()) errors.name = 'Event name is required';
  else if (values.name.trim().length > 255) errors.name = 'Keep the name under 255 characters';
  if (String(values.description ?? '').length > 2000)
    errors.description = 'Description must be 2000 characters or fewer';
  if (!values.event_date) errors.event_date = 'Event date and time is required';
  if (!String(values.venue ?? '').trim()) errors.venue = 'Venue is required';
  const capacity = Number(values.capacity);
  if (!values.capacity && values.capacity !== 0) errors.capacity = 'Capacity is required';
  else if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Capacity must be at least 1';
  return errors;
}
