/**
 * Firebase Messaging service worker for crevo-admin.
 *
 * Fires when an FCM push lands and the admin tab is BACKGROUNDED or
 * CLOSED. For foreground messages, the page-side onMessage handler runs
 * instead (see useAdminPushNotifications) and decides whether to show
 * a notification based on whether the in-app alerts already covered it.
 *
 * The Firebase config below uses REPLACE_ME_* placeholders. DO NOT edit
 * them by hand — the `firebaseMessagingSwPlugin` Vite plugin
 * (vite-plugins/firebase-messaging-sw.ts) substitutes them at runtime
 * (dev: the dev server middleware rewrites the response on the fly) and
 * at build time (prod: the writeBundle hook rewrites the file emitted
 * to dist/). The values come from the same VITE_FIREBASE_* env vars the
 * page bundle reads — single source of truth in .env.
 *
 * IMPORTANT: this file lives in /public so Vite copies it to dist/ root
 * unchanged (modulo the substitution above). The browser fetches it
 * from the SCOPE root (/firebase-messaging-sw.js) — Firebase Messaging
 * requires this exact path by default.
 */

// eslint-disable-next-line no-undef
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
// eslint-disable-next-line no-undef
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

// Auto-injected by firebaseMessagingSwPlugin from VITE_FIREBASE_* env vars.
// eslint-disable-next-line no-undef
firebase.initializeApp({
  apiKey: 'REPLACE_ME_FIREBASE_API_KEY',
  authDomain: 'REPLACE_ME_FIREBASE_AUTH_DOMAIN',
  projectId: 'REPLACE_ME_FIREBASE_PROJECT_ID',
  storageBucket: 'REPLACE_ME_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REPLACE_ME_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REPLACE_ME_FIREBASE_APP_ID',
})

// eslint-disable-next-line no-undef
const messaging = firebase.messaging()

/**
 * Background message → show a native OS notification.
 * `payload.notification` carries title+body (sent by FCM via the
 * `notification` field). `payload.data.url` carries the deep-link
 * we open on click.
 */
messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Crevo Admin'
  const body = (payload.notification && payload.notification.body) || ''
  // eslint-disable-next-line no-undef
  self.registration.showNotification(title, {
    body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {},
    tag: (payload.data && payload.data.conversationId) || undefined,
    // Replace prior notifications for the same conversation so a
    // chatty user doesn't carpet-bomb the OS notification tray.
    renotify: false,
  })
})

/**
 * Click handler: focus an existing tab on the deep-link URL if any,
 * else open a new one. Same pattern as the user-side SW.
 */
// eslint-disable-next-line no-undef
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    // eslint-disable-next-line no-undef
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          // eslint-disable-next-line no-undef
          if (client.url.includes(target) && 'focus' in client) return client.focus()
        }
        // eslint-disable-next-line no-undef
        return clients.openWindow(target)
      }),
  )
})
