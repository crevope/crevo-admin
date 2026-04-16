import { create } from 'zustand'
import { adminAuthRepository } from '../api/adminAuthRepository'

interface AdminInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
}

interface AdminAuthState {
  user: AdminInfo | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loadUser: () => void
}

/**
 * Auth state for the admin panel.
 *
 * `isAuthenticated` is a UI hint derived from the cached user profile in
 * localStorage — the actual security boundary is the HttpOnly `crevo_at`
 * cookie that the browser sends automatically. If the cookie expires the 401
 * interceptor will try a transparent refresh; if that also fails, the user
 * is kicked to /login.
 */
export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  loadUser: () => {
    const user = adminAuthRepository.getStoredUser()
    set({ user, isAuthenticated: !!user, isLoading: false })
  },

  login: async (email, password) => {
    const user = await adminAuthRepository.login(email, password)
    adminAuthRepository.saveUser(user)
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    adminAuthRepository.logout()
    adminAuthRepository.clearUser()
    set({ user: null, isAuthenticated: false })
  },
}))
