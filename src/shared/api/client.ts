import axios, { AxiosError } from 'axios'

// ─── Cookie names shared with the backend ────────────────────────────────────
// Must stay in sync with `src/shared/utils/authCookies.ts` on the server.

/** Readable CSRF cookie (non-HttpOnly). The SPA reads it and echoes it back
 *  in the `X-CSRF-Token` header on every mutating request. */
const CSRF_COOKIE_NAME = 'crevo_csrf'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/** Key under which we cache the admin user profile for client-side hydration.
 *  The auth token itself is never stored — it lives in an HttpOnly cookie. */
export const ADMIN_USER_KEY = 'crevo_admin_user'

// ─── Axios instance ──────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  // In dev Vite proxies /api/* to the backend, keeping cookies same-origin.
  // In production the full URL may be cross-origin — withCredentials ensures
  // the browser still sends our HttpOnly auth cookies in that scenario.
  withCredentials: true,
})

// ─── Request interceptor: attach CSRF header ─────────────────────────────────

apiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config

  // Safe methods don't mutate state and are exempt from CSRF validation.
  const method = (config.method ?? 'get').toLowerCase()
  const isSafe = method === 'get' || method === 'head' || method === 'options'
  if (isSafe) return config

  const csrfToken = readCookie(CSRF_COOKIE_NAME)
  if (csrfToken) {
    config.headers = config.headers ?? {}
      ; (config.headers as Record<string, string>)[CSRF_HEADER_NAME] = csrfToken
  }
  return config
})

// ─── Response interceptor: transparent refresh on 401 ────────────────────────
//
// Prevents a thundering herd: while one request is refreshing, every other
// 401 is queued and replayed against the new cookie.

let isRefreshing = false
let refreshSubscribers: Array<() => void> = []

function subscribeToRefresh(cb: () => void) {
  refreshSubscribers.push(cb)
}

function notifyRefreshCompleted() {
  refreshSubscribers.forEach((cb) => cb())
  refreshSubscribers = []
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }

    // Don't try to refresh when the failure IS on an auth endpoint — no loops.
    const url = originalRequest?.url ?? ''
    const isAuthEndpoint =
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout') ||
      url.includes('/auth/login')

    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      !originalRequest?._retry &&
      typeof window !== 'undefined'
    ) {
      originalRequest._retry = true

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh(() => resolve(apiClient(originalRequest)))
          setTimeout(() => reject(new Error('Refresh timeout')), 10_000)
        })
      }

      isRefreshing = true

      try {
        await apiClient.post('/auth/refresh', {})
        isRefreshing = false
        notifyRefreshCompleted()
        return apiClient(originalRequest)
      } catch {
        isRefreshing = false
        refreshSubscribers = []

        // Clear the full session: ask the server to expire HttpOnly cookies
        // (`crevo_at`, `crevo_rt`) via Set-Cookie, then wipe client-side state.
        // Best-effort with a 2 s cap so the user isn't stuck on a dead screen.
        await Promise.race([
          apiClient.post('/auth/logout', {}).catch(() => {}),
          new Promise((r) => setTimeout(r, 2000)),
        ])
        clearClientSession()

        window.location.href = '/login'
        return Promise.reject(new Error('Sesión expirada. Inicia sesión de nuevo.'))
      }
    }

    const message: string =
      (error.response?.data as { message?: string })?.message ||
      error.message ||
      'Error inesperado. Intenta de nuevo.'
    return Promise.reject(new Error(message))
  },
)

// ─── Session cleanup ────────────────────────────────────────────────────────

/**
 * Wipes every piece of client-side session state.
 *
 * HttpOnly cookies (`crevo_at`, `crevo_rt`) can only be cleared by a server
 * `Set-Cookie` response — that's handled by the `/auth/logout` call above.
 * Here we clear the non-HttpOnly CSRF cookie and localStorage so the next
 * login starts from a perfectly clean slate.
 */
function clearClientSession() {
  localStorage.removeItem(ADMIN_USER_KEY)
  if (typeof document !== 'undefined') {
    document.cookie = `${CSRF_COOKIE_NAME}=; Path=/; Max-Age=0`
  }
}

// ─── Utility: read a cookie by name ──────────────────────────────────────────

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const needle = `${encodeURIComponent(name)}=`
  const pairs = document.cookie.split('; ')
  for (const pair of pairs) {
    if (pair.startsWith(needle)) {
      return decodeURIComponent(pair.slice(needle.length))
    }
  }
  return null
}
