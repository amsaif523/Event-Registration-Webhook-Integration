import { useState } from 'react';
import { useAuth } from '../../state/AuthContext.jsx';
import { useNavigation, VIEWS } from '../../state/NavigationContext.jsx';
import { Field, TextInput } from '../../components/ui/Field.jsx';
import { validateAdminLogin } from '../../lib/validation.js';
import Button from '../../components/ui/Button.jsx';
import Icon from '../../components/icons/Icon.jsx';
import Wordmark from '../../components/Wordmark.jsx';

/**
 * Username and password. The password is what reaches the server as
 * X-Admin-Token, matched against ADMIN_TOKEN with hash_equals; the username is
 * a session label used for the avatar. The username box accepts either an email
 * address or a plain username. No sign-up, no password reset, no social
 * buttons, because none of those exist in the backend.
 *
 * Split layout: the dark panel carries the brand and says what is behind the
 * door, the light panel holds the one field. The panel is decoration, so it is
 * hidden below lg rather than stacked, which would push the form below the
 * fold on a phone for no benefit.
 */

const CAPABILITIES = [
  {
    icon: 'calendar',
    title: 'Events and capacity',
    description: 'Publish events, adjust capacity, and see how close each one is to selling out.',
  },
  {
    icon: 'list',
    title: 'Every registration',
    description: 'Search by reference, name or email, and open the full record with its deliveries.',
  },
  {
    icon: 'shield',
    title: 'The webhook audit trail',
    description: 'Every inbound delivery with its raw payload, including the ones we rejected.',
  },
];

export default function AdminLoginPage() {
  const { signIn } = useAuth();
  const { navigate } = useNavigation();
  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState(false);
  const [failure, setFailure] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setValue = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFailure(null);
  };

  const submit = async (event) => {
    event.preventDefault();

    const fieldErrors = validateAdminLogin(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      // Send focus to the first thing that needs fixing.
      const first = ['username', 'password'].find((field) => fieldErrors[field]);
      document.getElementById(`admin-${first}`)?.focus();
      return;
    }

    setSubmitting(true);
    setFailure(null);
    try {
      await signIn(values.username, values.password);
      navigate(VIEWS.adminDashboard);
    } catch (err) {
      setFailure(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[1.1fr_1fr]">
      {/* ------------------------------------------------------- brand panel */}
      <aside className="relative hidden overflow-hidden bg-ink px-12 py-14 lg:flex lg:flex-col xl:px-16">
        {/* Flat hairline grid, no gradient wash. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-brand-500/10 blur-3xl"
        />

        <div className="relative">
          <Wordmark tone="light" subtitle="Admin" />
        </div>

        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-[34px] font-bold leading-[1.15] tracking-tight text-white">
            The room behind the registration desk.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            Manage what the public sees, and inspect exactly what the ticketing system sent us.
          </p>

          <ul className="mt-10 space-y-6">
            {CAPABILITIES.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-brand-400 ring-1 ring-inset ring-white/10">
                  <Icon name={item.icon} size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{item.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-auto pt-14 text-[13px] text-slate-500">
          Eventide — event registration and ticketing.
        </p>
      </aside>

      {/* -------------------------------------------------------- form panel */}
      <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 sm:px-8 sm:py-12 lg:min-h-dvh">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Wordmark className="mb-8" />
          </div>

          <div className="grid h-11 w-11 place-items-center rounded-full border border-hairline bg-white text-brand-500">
            <Icon name="key" size={20} />
          </div>

          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-body">
            Sign in to manage events, registrations and webhook deliveries.
          </p>

          {failure && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2.5 rounded border border-red-200 bg-red-50 px-3.5 py-3"
            >
              <Icon name="alertCircle" size={16} className="mt-0.5 shrink-0 text-red-600" />
              <p className="text-[13px] text-red-700">{failure}</p>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-7 space-y-4">
            <Field
              label="Username or email"
              required
              htmlFor="admin-username"
              error={errors.username}
            >
              <TextInput
                id="admin-username"
                value={values.username}
                autoComplete="username"
                spellCheck="false"
                autoCapitalize="none"
                placeholder="you@example.com"
                error={errors.username}
                onChange={(e) => setValue('username', e.target.value)}
              />
            </Field>

            <Field label="Password" required htmlFor="admin-password" error={errors.password}>
              <div className="relative">
                <TextInput
                  id="admin-password"
                  type={visible ? 'text' : 'password'}
                  value={values.password}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="pr-11"
                  error={errors.password}
                  onChange={(e) => setValue('password', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setVisible((current) => !current)}
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded text-meta transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  <Icon name={visible ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>
            </Field>

            <Button type="submit" size="lg" fullWidth loading={submitting} loadingText="Signing in…">
              Sign in
            </Button>
          </form>

          <button
            type="button"
            onClick={() => navigate(VIEWS.events)}
            className="mt-8 flex items-center gap-1.5 rounded text-[13px] font-medium text-body transition-colors hover:text-ink"
          >
            <Icon name="arrowLeft" size={15} />
            Back to the public site
          </button>
        </div>
      </main>
    </div>
  );
}
