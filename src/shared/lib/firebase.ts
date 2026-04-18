import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging'

/**
 * Lazy Firebase init for the admin SPA. Mirrors the web app's setup:
 * config from VITE_FIREBASE_* env vars, app/messaging instances cached
 * after first call.
 *
 * Used solely for FCM push notifications when a user posts a chat
 * message and the admin tab is closed / backgrounded. Sensitive data
 * still flows through the authenticated backend API; Firebase here is
 * just the OS-notification transport.
 *
 * Returns `null` when:
 *   - Required env vars are missing (graceful — chat alerts degrade to
 *     in-tab sound + tab title via useChatInboxAlerts).
 *   - Browser doesn't support FCM (older Safari, certain in-app
 *     browsers, headless test envs).
 */

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasFirebaseConfig = Boolean(config.apiKey && config.projectId && config.appId)

let app: FirebaseApp | null = null
let messagingInstance: Messaging | null = null
let messagingProbed = false

export function getFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig) return null
  if (!app) app = initializeApp(config)
  return app
}

/**
 * Returns the Messaging instance, or null if the browser doesn't support
 * it (notification API blocked, no service worker, etc.). Memoized — the
 * `isSupported()` probe only runs once.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance
  if (messagingProbed && !messagingInstance) return null

  const ready = await isSupported().catch(() => false)
  messagingProbed = true
  if (!ready) return null

  const application = getFirebaseApp()
  if (!application) return null

  messagingInstance = getMessaging(application)
  return messagingInstance
}

export const firebaseVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY ?? ''
