import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { USE_MOCK, ApiError, client } from '../api/index.js';

/**
 * Admin session state.
 *
 * There is no token in here, and none in localStorage or sessionStorage. The
 * access and refresh tokens live in HttpOnly cookies that JavaScript cannot
 * read, so the only thing this holds is who the server says you are. That is
 * the whole reason for the cookie design: a script injected into the page
 * cannot steal what it cannot read.
 *
 * It also means "am I signed in?" is not something the frontend can decide on
 * its own — it has to ask the server (POST /api/auth/me).
 *
 * That question is asked lazily, only once something actually depends on the
 * answer. A visitor browsing events is not signing in, and firing an auth
 * probe at them on every page load is a wasted round trip that answers 401 and
 * changes nothing on screen. `ensureSession()` runs the check the first time an
 * admin view is reached, and never more than once.
 */

const AuthContext = createContext(null);

const DEFAULT_NAME = 'Admin';

/**
 * Turn a username into something displayable, used when the server has not
 * supplied a name. "asma.madhvaswala@example.com" reads as "Asma Madhvaswala".
 */
export function toDisplayName(username) {
  const raw = String(username ?? '').trim();
  if (!raw) return DEFAULT_NAME;
  const local = raw.includes('@') ? raw.slice(0, raw.indexOf('@')) : raw;
  const words = local
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.join(' ') || DEFAULT_NAME;
}

/** "Asma Madhvaswala" -> "AM", "Admin" -> "AD". Always two characters. */
export function toInitials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // idle -> nothing has needed the answer yet | checking -> asking the server
  // | ready -> the answer is known, signed in or not.
  const [status, setStatus] = useState('idle');
  const started = useRef(false);

  /**
   * Ask the server who we are, at most once per page load.
   *
   * Guarded by a ref rather than by state: two admin screens mounting in the
   * same tick would both see status === 'idle' and both fire.
   */
  const ensureSession = useCallback(async () => {
    if (USE_MOCK || started.current) return;
    started.current = true;
    setStatus('checking');

    try {
      const data = await client.me();
      setUser(data.user);
    } catch (error) {
      // An expired access token is recoverable: refresh and ask again.
      // Anything else — revoked session, no cookie — means no session.
      if (error instanceof ApiError && error.code === 'TOKEN_EXPIRED') {
        try {
          await client.refresh();
          const data = await client.me();
          setUser(data.user);

          return;
        } catch {
          /* fall through to signed out */
        }
      }
      setUser(null);
    } finally {
      setStatus('ready');
    }
  }, []);

  const signIn = useCallback(async (username, password) => {
    if (USE_MOCK) {
      // Design mode has no server to check against, so it rejects only what
      // the real backend would also reject, keeping the error path visible.
      if (String(password ?? '').length < 8) throw new Error('Incorrect username or password.');
      const mockUser = { id: 0, name: toDisplayName(username), username, role: 'admin' };
      setUser(mockUser);

      return mockUser;
    }

    const data = await client.login(username, password);
    // Signing in answers the question, so no probe is needed afterwards.
    started.current = true;
    setStatus('ready');
    setUser(data.user);

    return data.user;
  }, []);

  const signOut = useCallback(async () => {
    setUser(null);

    if (USE_MOCK) return;

    try {
      // Server-side revocation is the part that matters: it ends the whole
      // token family, so a copied access token stops working immediately
      // instead of lasting until it expires.
      await client.logout();
    } catch {
      /* already signed out, or offline; local state is cleared either way */
    }
  }, []);

  const value = useMemo(() => {
    const name = user?.name ?? DEFAULT_NAME;

    return {
      user,
      name,
      initials: toInitials(name),
      isAuthenticated: Boolean(user),
      // True until the server has answered. Admin screens wait for this rather
      // than assuming "not signed in" and bouncing to the login card.
      isChecking: !USE_MOCK && status !== 'ready',
      ensureSession,
      signIn,
      signOut,
    };
  }, [user, status, ensureSession, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');

  return context;
}
