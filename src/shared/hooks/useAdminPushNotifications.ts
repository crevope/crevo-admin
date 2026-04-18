import { useEffect } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { toast } from 'sonner'
import { apiClient } from '@/shared/api/client'
import { getFirebaseMessaging, firebaseVapidKey } from '@/shared/lib/firebase'
import { useAdminAuthStore } from '@/features/admin-auth'

/**
 * Requests browser notification permission, registers the FCM token
 * with the backend, and wires the foreground onMessage handler.
 *
 * Behaviour parity with the user-side widget's `usePushNotifications`:
 *
 *   - GATED on `isAuthenticated` so we don't try to POST the token
 *     before the admin's session is confirmed (would 401 + trigger
 *     refresh storms).
 *   - PRODUCTION-only by default — in dev the SW isn't registered
 *     (would race against Vite's dev server reloads). Set
 *     `VITE_FORCE_PUSH_DEV=1` to override for local testing.
 *   - SKIPS if browser blocked notifications or if Firebase config is
 *     missing (returns null from getFirebaseMessaging).
 *   - SKIPS the foreground native notification when the incoming
 *     message is `chat_message_admin` — the inbox alerts hook
 *     (useChatInboxAlerts) already plays a sound + bumps the tab
 *     title, so an additional OS notification would be redundant
 *     while the admin is right there.
 *   - FALLS BACK silently on any error — push is a "nice to have", the
 *     in-tab signals are the authoritative path.
 *
 * Token lifecycle: registered with the SAME `/api/notifications/fcm-token`
 * endpoint the user-side widget uses; backend stores against the
 * authenticated user's row regardless of role, so nothing extra needed
 * server-side.
 */
export function useAdminPushNotifications() {
  const isAuthenticated = useAdminAuthStore((s) => s.isAuthenticated)
  const userId = useAdminAuthStore((s) => s.user?.id)

  useEffect(() => {
    if (!isAuthenticated || !userId) return
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    // Production gate: same logic as web's usePushNotifications.
    const forceInDev = import.meta.env.VITE_FORCE_PUSH_DEV === '1'
    if (import.meta.env.DEV && !forceInDev) return

    let unsubscribe: (() => void) | undefined
    let cancelled = false

    async function init() {
      try {
        // Don't re-prompt if user already denied.
        if (Notification.permission === 'denied') return

        const permission = await Notification.requestPermission()
        if (permission !== 'granted' || cancelled) return

        const messaging = await getFirebaseMessaging()
        if (!messaging || cancelled) return

        // Register the SW that handles background messages. Vite serves
        // it from the public dir at the root path, which is exactly what
        // Firebase Messaging expects by default (no
        // serviceWorkerRegistration override needed).
        const registration = await navigator.serviceWorker.register(
          '/firebase-messaging-sw.js',
        )

        if (cancelled) return

        const token = await getToken(messaging, {
          vapidKey: firebaseVapidKey,
          serviceWorkerRegistration: registration,
        })

        if (token && !cancelled) {
          // Reuse the same /api/notifications/fcm-token endpoint as web —
          // backend stores it against the authenticated admin's user row.
          await apiClient.post('/notifications/fcm-token', { token }).catch(() => {
            // Best-effort: a failed save shouldn't block the rest of the
            // setup. Next session will retry.
          })
        }

        if (cancelled) return

        unsubscribe = onMessage(messaging, (payload) => {
          // Suppress foreground native notification for chat-message
          // admin pushes — useChatInboxAlerts already plays a sound +
          // bumps the tab title in the same scenario, and the admin is
          // right here looking at the page (Notification.permission
          // foreground events only fire on visible tabs anyway).
          if (payload.data?.type === 'chat_message_admin') return

          const title = payload.notification?.title
          const body = payload.notification?.body
          if (title) {
            // Generic in-app toast for non-chat alerts (future expansion).
            toast(title, { description: body ?? '' })
          }
        })
      } catch (err) {
        // Token errors / SW registration errors / network — all silent.
        // Logged for debug only.
        // eslint-disable-next-line no-console
        console.debug('[admin-push] setup skipped:', err)
      }
    }

    void init()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [isAuthenticated, userId])
}
