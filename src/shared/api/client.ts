import axios, { AxiosError } from 'axios'
import { clearAuthLocalStorage } from '@/shared/lib/sessionStorage'

// ─── Cookie / header / storage names shared with the backend ────────────────
// Must stay in sync with `src/shared/utils/authCookies.ts` on the server.

/** Readable CSRF cookie (non-HttpOnly). Used as a fallback source when the
 *  SPA is same-origin with the API. */
const CSRF_COOKIE_NAME = 'crevo_csrf'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/** sessionStorage key for the CSRF token. We persist it here so that:
 *
 *  1. CROSS-ORIGIN setups work — when the SPA lives on `admin-panel.crevo.pe`
 *     and hits `api.crevo.pe` directly, JS can NOT read the CSRF cookie set
 *     by the API origin (Same-Origin Policy on document.cookie). The backend
 *     also returns the token in the response body of every auth call, and
 *     we stash it here so the request interceptor can echo it on subsequent
 *     mutating requests.
 *
 *  2. Page reloads work — sessionStorage survives F5 within the same tab.
 *
 *  Cleared on logout. New tabs get a fresh CSRF on the first /auth/me call
 *  (the server rotates and returns it on every meHandler hit).
 */
const CSRF_STORAGE_KEY = 'crevo_csrf_token'

/** Key under which we cache the admin user profile for client-side hydration.
 *  The auth token itself is never stored — it lives in an HttpOnly cookie. */
export const ADMIN_USER_KEY = 'crevo_admin_user'

// ─── Axios instance ──────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  // In dev Vite proxies /api/* to the backend, keeping cookies same-origin.
  // In production the full URL may be cross-origin — withCredentials ensures
  // the browser still sends our HttpOnly auth cookies, and the in-body CSRF
  // transport (see below) covers the case where document.cookie is unreadable.
  withCredentials: true,
})

// ─── CSRF token storage ─────────────────────────────────────────────────────

let csrfTokenCache: string | null = null

export function setCsrfToken(token: string | null | undefined): void {
  if (!token) return
  csrfTokenCache = token
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(CSRF_STORAGE_KEY, token)
    } catch {
      /* sessionStorage can be blocked in privacy modes — tolerate it */
    }
  }
}

export function getCsrfToken(): string | null {
  if (csrfTokenCache) return csrfTokenCache
  if (typeof window !== 'undefined') {
    try {
      const stored = window.sessionStorage.getItem(CSRF_STORAGE_KEY)
      if (stored) {
        csrfTokenCache = stored
        return stored
      }
    } catch {
      /* ignore */
    }
  }
  return readCookie(CSRF_COOKIE_NAME)
}

function clearCsrfToken(): void {
  csrfTokenCache = null
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(CSRF_STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }
}

export function captureCsrfFromResponse(payload: unknown): void {
  if (payload && typeof payload === 'object' && 'csrfToken' in payload) {
    const token = (payload as { csrfToken?: unknown }).csrfToken
    if (typeof token === 'string') setCsrfToken(token)
  }
}

// ─── Request interceptor: attach CSRF header ─────────────────────────────────

apiClient.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config

  // Safe methods don't mutate state and are exempt from CSRF validation.
  const method = (config.method ?? 'get').toLowerCase()
  const isSafe = method === 'get' || method === 'head' || method === 'options'
  if (isSafe) return config

  const csrfToken = getCsrfToken()
  if (csrfToken) {
    config.headers = config.headers ?? {}
    ;(config.headers as Record<string, string>)[CSRF_HEADER_NAME] = csrfToken
  }
  return config
})

// ─── Response interceptor: capture rotated CSRF + transparent refresh on 401 ─

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
  (r) => {
    // Capture rotated CSRF from any auth-bearing response body. The backend
    // includes `csrfToken` in login/refresh/me responses; for other endpoints
    // `data?.csrfToken` is just absent and this is a no-op.
    captureCsrfFromResponse(r.data?.data)
    return r
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean }

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
        const refreshRes = await apiClient.post('/auth/refresh', {})
        captureCsrfFromResponse(refreshRes.data?.data)

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
 * Here we clear the non-HttpOnly CSRF cookie, the in-memory + sessionStorage
 * CSRF token cache, and wipe localStorage — preserving long-lived UX
 * preferences (theme) per `clearAuthLocalStorage()`.
 */
export function clearClientSession(): void {
  clearAuthLocalStorage()
  clearCsrfToken()
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
