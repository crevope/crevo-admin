import { apiClient, ADMIN_USER_KEY } from '@/shared/api/client'

interface AdminInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

/**
 * Auth repository for the admin panel.
 *
 * Tokens live exclusively in HttpOnly cookies (`crevo_at`, `crevo_rt`) set by
 * the server — JavaScript never touches them. The only thing we cache in
 * localStorage is the user profile for instant hydration on page reload.
 */
export const adminAuthRepository = {
  async login(email: string, password: string): Promise<AdminInfo> {
    const { data } = await apiClient.post('/auth/login', { email, password })
    const user: AdminInfo = data.data.user
    if (user.role !== 'ADMIN') {
      // If a non-admin logs in, clear the cookie the server just set and bail.
      await apiClient.post('/auth/logout', {}).catch(() => {})
      throw new Error('No tienes permisos de administrador')
    }
    return user
  },

  async logout(): Promise<void> {
    // Server revokes the refresh token and clears cookies. Best-effort: if
    // the network is down we still clear the local cache.
    await apiClient.post('/auth/logout', {}).catch(() => {})
  },

  saveUser(user: AdminInfo) {
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user))
  },

  clearUser() {
    localStorage.removeItem(ADMIN_USER_KEY)
  },

  getStoredUser(): AdminInfo | null {
    const raw = localStorage.getItem(ADMIN_USER_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as AdminInfo
    } catch {
      return null
    }
  },
}
