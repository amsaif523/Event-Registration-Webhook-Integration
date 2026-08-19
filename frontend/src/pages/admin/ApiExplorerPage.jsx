import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/cn.js';
import { AdminPageHeader } from '../../components/admin/AdminShell.jsx';
import Icon from '../../components/icons/Icon.jsx';
import Button from '../../components/ui/Button.jsx';
import CopyButton from '../../components/ui/CopyButton.jsx';
import { Tag } from '../../components/ui/Badge.jsx';
import { TextInput, TextArea } from '../../components/ui/Field.jsx';
import { Banner, EmptyState, ErrorState } from '../../components/ui/States.jsx';
import JsonBlock from '../../components/JsonBlock.jsx';
import { useNavigation, VIEWS } from '../../state/NavigationContext.jsx';

/**
 * A Postman-style client for the actual API, built from the same
 * docs/postman_collection.json a reviewer would import into real Postman
 * (mirrored into /public so this page can fetch it at runtime). Pick a
 * request, edit the body, hit send — it runs against this session for real.
 *
 * Requests never leave the browser except to this app's own origin: the
 * admin session cookie rides along automatically because everything here is
 * same-origin, exactly like the rest of the admin UI. There is nothing to
 * paste in and nothing to steal.
 */

// Mirrors the $protected route list in backend/src/routes.php. Purely
// informational here — the request still fires either way, this just labels
// what the response will say if you are not signed in.
const PROTECTED_PATHS = new Set([
  '/api/auth/me',
  '/api/auth/logout-everywhere',
  '/api/events/admin-list',
  '/api/events/admin-view',
  '/api/events/create',
  '/api/events/update',
  '/api/registrations/list',
  '/api/webhooks/list',
  '/api/dashboard/summary',
]);

const METHOD_TONE = {
  GET: 'brand',
  POST: 'emerald',
};

function pathOf(item) {
  const parts = item.request.url?.path ?? [];
  return '/' + parts.join('/');
}

function requestId(folderName, item) {
  return `${folderName}::${item.name}`;
}

/** Flattens the Postman folders into a lookup the page can index by id. */
function flattenCollection(collection) {
  const folders = collection.item ?? [];
  const byId = new Map();

  for (const folder of folders) {
    for (const item of folder.item ?? []) {
      const id = requestId(folder.name, item);
      byId.set(id, { id, folder: folder.name, item, path: pathOf(item) });
    }
  }

  return { folders, byId };
}

/**
 * Postman variables ({{reference}}, {{admin_username}}, ...) get resolved by
 * Postman's own runtime when a reviewer imports this collection there. This
 * page has no such runtime, so it substitutes them itself from the
 * collection's `variable` array — otherwise the body would literally contain
 * the string "{{reference}}" and every request would fail validation.
 */
function substituteVariables(text, variables) {
  return text.replace(/{{\s*([\w.-]+)\s*}}/g, (match, name) => variables.get(name) ?? match);
}

function initialHeaders(item, variables) {
  const headers = item.request.header ?? [];
  return headers.map((header) => ({
    key: header.key,
    value: substituteVariables(header.value ?? '', variables),
  }));
}

function initialBody(item, variables) {
  const raw = item.request.body?.raw ?? '';
  return substituteVariables(raw, variables);
}

/* --------------------------------------------------------------- sidebar */

function Sidebar({ folders, activeId, onSelect }) {
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (name) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <nav aria-label="API requests" className="space-y-1">
      {folders.map((folder) => {
        const isCollapsed = collapsed.has(folder.name);
        return (
          <div key={folder.name}>
            <button
              type="button"
              onClick={() => toggle(folder.name)}
              className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-meta hover:text-ink"
            >
              <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={13} />
              {folder.name}
            </button>
            {!isCollapsed && (
              <ul className="space-y-0.5 pb-1">
                {(folder.item ?? []).map((item) => {
                  const id = requestId(folder.name, item);
                  const active = id === activeId;
                  const method = item.request.method;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => onSelect(id)}
                        aria-current={active ? 'true' : undefined}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded py-2 pl-6 pr-3 text-left text-[13px] transition-colors duration-150',
                          active ? 'bg-brand-50 text-brand-700 font-medium' : 'text-body hover:bg-slate-100 hover:text-ink',
                        )}
                      >
                        <span
                          className={cn(
                            'w-11 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold tabular tracking-wide',
                            method === 'GET' ? 'bg-brand-50 text-brand-700' : 'bg-emerald-50 text-emerald-700',
                          )}
                        >
                          {method}
                        </span>
                        <span className="truncate">{item.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* ------------------------------------------------------------- headers ui */

function HeadersEditor({ headers, onChange }) {
  const update = (index, patch) => {
    onChange(headers.map((header, i) => (i === index ? { ...header, ...patch } : header)));
  };
  const remove = (index) => onChange(headers.filter((_, i) => i !== index));
  const add = () => onChange([...headers, { key: '', value: '' }]);

  return (
    <div className="space-y-2">
      {headers.map((header, index) => (
        <div key={index} className="flex items-center gap-2">
          <TextInput
            value={header.key}
            onChange={(e) => update(index, { key: e.target.value })}
            placeholder="Header"
            className="h-9 flex-1 text-[13px]"
          />
          <TextInput
            value={header.value}
            onChange={(e) => update(index, { value: e.target.value })}
            placeholder="Value"
            className="h-9 flex-[1.5] font-mono text-[12px]"
          />
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={`Remove header ${header.key || index}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded text-meta transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-[13px] font-medium text-brand-600 hover:bg-brand-50"
      >
        <Icon name="plus" size={14} />
        Add header
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- request */

function statusTone(status) {
  if (status === 0) return { badge: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Network error' };
  if (status >= 200 && status < 300) return { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: `${status} OK` };
  if (status >= 400 && status < 500) return { badge: 'bg-amber-50 text-amber-700 border-amber-200', label: `${status}` };
  if (status >= 500) return { badge: 'bg-red-50 text-red-700 border-red-200', label: `${status}` };
  return { badge: 'bg-slate-100 text-slate-600 border-slate-200', label: `${status}` };
}

export default function ApiExplorerPage() {
  const { navigate } = useNavigation();
  const [collection, setCollection] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/postman_collection.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load collection (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setCollection(data);
        const { byId } = flattenCollection(data);
        setActiveId(byId.keys().next().value ?? null);
      })
      .catch((error) => !cancelled && setLoadError(error.message));
    return () => {
      cancelled = true;
    };
  }, []);

  const { folders, byId } = useMemo(
    () => (collection ? flattenCollection(collection) : { folders: [], byId: new Map() }),
    [collection],
  );

  const active = activeId ? byId.get(activeId) : null;

  const variables = useMemo(() => {
    const map = new Map();
    for (const variable of collection?.variable ?? []) map.set(variable.key, variable.value);
    return map;
  }, [collection]);

  const draft = useMemo(() => {
    if (!active) return null;
    if (drafts[active.id]) return drafts[active.id];
    return { headers: initialHeaders(active.item, variables), body: initialBody(active.item, variables) };
  }, [active, drafts, variables]);

  const setDraft = (patch) => {
    if (!active) return;
    setDrafts((current) => ({ ...current, [active.id]: { ...draft, ...patch } }));
  };

  const resetDraft = () => {
    if (!active) return;
    setDrafts((current) => {
      const next = { ...current };
      delete next[active.id];
      return next;
    });
    setResponse(null);
  };

  const select = (id) => {
    setActiveId(id);
    setResponse(null);
  };

  const send = async () => {
    if (!active || !draft) return;
    setSending(true);
    setResponse(null);

    const method = active.item.request.method;
    const headers = {};
    for (const header of draft.headers) {
      if (header.key.trim()) headers[header.key.trim()] = header.value;
    }

    const started = performance.now();
    try {
      const res = await fetch(active.path, {
        method,
        headers,
        credentials: 'same-origin',
        body: method === 'GET' ? undefined : draft.body,
      });
      const elapsed = Math.round(performance.now() - started);
      const text = await res.text();
      const headerEntries = Array.from(res.headers.entries());
      setResponse({ status: res.status, ok: res.ok, elapsed, text, headers: headerEntries });
    } catch {
      const elapsed = Math.round(performance.now() - started);
      setResponse({ status: 0, ok: false, elapsed, text: '', networkError: true });
    } finally {
      setSending(false);
    }
  };

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <AdminPageHeader title="API Explorer" description="A Postman-style client for every endpoint in this API." />
        <ErrorState
          className="mt-6"
          title="Could not load the collection"
          description={loadError}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-8xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <AdminPageHeader
        title="API Explorer"
        description="Every endpoint, loaded from docs/postman_collection.json — the same file a reviewer imports into real Postman. Pick a request, edit the body, and send it against this session."
        actions={
          <a
            href="/postman_collection.json"
            download="eventide-postman-collection.json"
            className="inline-flex h-9 items-center gap-2 rounded border border-hairline bg-white px-3 text-[13px] font-medium text-body transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-ink"
          >
            <Icon name="code" size={15} />
            Download collection
          </a>
        }
      />

      {!collection ? (
        <div className="mt-10 flex items-center gap-3 text-[13px] text-meta">
          <Icon name="loader" size={16} className="animate-spin" />
          Loading collection…
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <Sidebar folders={folders} activeId={activeId} onSelect={select} />
          </aside>

          {!active || !draft ? (
            <EmptyState icon="code" title="Pick a request" description="Choose an endpoint from the list to get started." />
          ) : (
            <div className="min-w-0 space-y-4">
              {/* --------------------------------------------------- request bar */}
              <div className="card flex flex-wrap items-center gap-3 p-4">
                <Tag tone={METHOD_TONE[active.item.request.method] ?? 'slate'}>
                  {active.item.request.method}
                </Tag>
                <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{active.path}</code>
                {PROTECTED_PATHS.has(active.path) && <Tag tone="amber">Admin session</Tag>}
                <Button size="sm" variant="ghost" onClick={resetDraft} icon="refresh">
                  Reset
                </Button>
                <Button size="sm" onClick={send} loading={sending} loadingText="Sending…" iconAfter="arrowRight">
                  Send
                </Button>
              </div>

              {active.item.request.description && (
                <Banner tone="info" title="About this request">
                  <p className="whitespace-pre-line">{active.item.request.description}</p>
                </Banner>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                {/* --------------------------------------------------- request */}
                <div className="card space-y-5 p-5">
                  <div>
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Headers</h3>
                    <HeadersEditor headers={draft.headers} onChange={(headers) => setDraft({ headers })} />
                  </div>

                  {active.item.request.method !== 'GET' && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="text-[13px] font-semibold text-ink">Body (JSON)</h3>
                        <span className="text-[11px] text-meta">Sent exactly as typed, byte for byte</span>
                      </div>
                      <TextArea
                        value={draft.body}
                        onChange={(e) => setDraft({ body: e.target.value })}
                        rows={12}
                        spellCheck={false}
                        className="font-mono text-[12.5px] leading-relaxed"
                      />
                    </div>
                  )}
                </div>

                {/* -------------------------------------------------- response */}
                <div className="card space-y-4 p-5">
                  <h3 className="text-[13px] font-semibold text-ink">Response</h3>

                  {!response ? (
                    <EmptyState
                      compact
                      icon="activity"
                      title="Nothing yet"
                      description="Send the request to see the response here."
                    />
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                            statusTone(response.status).badge,
                          )}
                        >
                          {statusTone(response.status).label}
                        </span>
                        <span className="text-[13px] text-meta">{response.elapsed} ms</span>
                        {response.text && <CopyButton value={response.text} label="Copy response" />}
                      </div>

                      {response.networkError ? (
                        <Banner tone="error" title="Network error">
                          Could not reach the server. Check that the backend is running.
                        </Banner>
                      ) : response.text ? (
                        <JsonBlock payload={response.text} label="Response body" />
                      ) : (
                        <p className="text-[13px] text-meta">Empty response body.</p>
                      )}

                      {response.headers?.length > 0 && (
                        <details className="rounded border border-hairline">
                          <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-body hover:text-ink">
                            Response headers ({response.headers.length})
                          </summary>
                          <dl className="space-y-1 border-t border-hairline px-3 py-2.5 text-[12px]">
                            {response.headers.map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <dt className="shrink-0 font-medium text-meta">{key}:</dt>
                                <dd className="min-w-0 break-all text-body">{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {active.path === '/api/webhooks/ticketing' && (
                <Banner tone="warning" title="This one needs a real signature">
                  <p>
                    The header values shown are placeholders — WEBHOOK_SECRET never reaches the browser, so this page
                    cannot compute a valid HMAC for you. Sending as-is will correctly get rejected with 401. To see a
                    real confirmed delivery,{' '}
                    <button
                      type="button"
                      onClick={() => navigate(VIEWS.adminWebhooks)}
                      className="font-medium text-amber-900 underline underline-offset-2"
                    >
                      use the webhook simulator
                    </button>{' '}
                    instead — it signs server-side.
                  </p>
                </Banner>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
