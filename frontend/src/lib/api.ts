/**
 * API client — contract: /api/v1, JSON, `{code, message}` errors,
 * cookies (`credentials: 'include'`) with one automatic refresh-on-401.
 */
export const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  query?: Query;
  signal?: AbortSignal;
  /** return the raw Response (e.g. for file downloads) */
  raw?: boolean;
  /** disable the refresh-on-401 retry */
  noRefresh?: boolean;
}

export function buildUrl(path: string, query?: Query): string {
  const url = path.startsWith('http') || path.startsWith('/api') ? path : API_BASE + path;
  if (!query) return url;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '' || v === 'all') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `${url}${url.includes('?') ? '&' : '?'}${s}` : url;
}

let refreshing: Promise<boolean> | null = null;
const NO_REFRESH_CODES = new Set(['OTP_REQUIRED', 'INVALID_CREDENTIALS', 'INVALID_OTP', 'BAD_CREDENTIALS']);

async function doRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } })
      .then(async (r) => { await r.text().catch(() => ''); return r.ok; })
      .catch(() => false)
      .finally(() => {
        setTimeout(() => { refreshing = null; }, 0);
      });
  }
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  let code = 'HTTP_' + res.status;
  let message = res.statusText || 'Error';
  let fields: Record<string, string> | undefined;
  try {
    const data = await res.json();
    if (data && typeof data === 'object') {
      if (typeof data.code === 'string') code = data.code;
      if (typeof data.message === 'string') message = data.message;
      else if (typeof data.detail === 'string') message = data.detail;
      if (data.fields && typeof data.fields === 'object') fields = data.fields;
      // FastAPI default validation shape fallback
      if (Array.isArray(data.detail)) {
        code = 'VALIDATION_ERROR';
        fields = {};
        for (const d of data.detail) {
          const loc = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : 'field';
          fields[String(loc)] = String(d.msg ?? 'invalid');
        }
        message = Object.values(fields).join('; ');
      }
    }
  } catch {
    /* not JSON */
  }
  if (res.status === 429 && code.startsWith('HTTP_')) code = 'RATE_LIMITED';
  if (res.status === 404 && code.startsWith('HTTP_')) code = 'NOT_FOUND';
  return new ApiError(res.status, code, message, fields);
}

export async function request<T = unknown>(path: string, opts: RequestOpts = {}): Promise<T> {
  const url = buildUrl(path, opts.query);
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const init: RequestInit = { method: opts.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'include', signal: opts.signal };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error');
  }

  const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh');
  if (res.status === 401 && !opts.noRefresh && !isAuthCall) {
    const peek = res.clone();
    let code = '';
    try { code = (await peek.json())?.code ?? ''; } catch { /* ignore */ }
    if (!NO_REFRESH_CODES.has(code)) {
      const ok = await doRefresh();
      if (ok) {
        try { res = await fetch(url, init); } catch { throw new ApiError(0, 'NETWORK_ERROR', 'Network error'); }
      }
      if (res.status === 401) window.dispatchEvent(new CustomEvent('ss:auth-expired'));
    }
  }

  if (!res.ok) throw await toError(res);
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('json')) return (await res.text()) as unknown as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ?? {} }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
};

/** Download a file endpoint (xlsx export etc.) keeping auth cookies. */
export async function download(path: string, query: Query | undefined, fallbackName: string) {
  const res = await request<Response>(path, { query, raw: true });
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const name = m ? decodeURIComponent(m[1]) : fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
