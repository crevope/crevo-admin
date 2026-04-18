import { type Plugin, loadEnv } from 'vite'
import * as fs from 'node:fs'
import * as path from 'node:path'

/**
 * Vite plugin: inject Firebase config into the static
 * `public/firebase-messaging-sw.js` at runtime/build-time so the
 * service worker stops needing manual placeholder replacement.
 *
 * Why a plugin instead of inlining the config in `public/`:
 *   - Service Workers can't read `import.meta.env`. They live in their
 *     own JS context that the bundler doesn't transform.
 *   - Files in `public/` are copied to `dist/` unchanged, which means
 *     "just edit the values" requires uncommitted local changes that
 *     drift between developers and deployments.
 *   - This plugin reads `VITE_FIREBASE_*` env vars (loaded by Vite from
 *     .env / .env.production / process.env) and substitutes the
 *     `REPLACE_ME_*` tokens in the SW for both:
 *       1. dev — middleware intercepts /firebase-messaging-sw.js and
 *          serves the substituted content directly (no need to write
 *          to disk during dev),
 *       2. build — after Vite copies the public file to dist, we
 *          rewrite it in place with the substituted content.
 *
 * Net effect: same single source of truth (.env) for both the page-side
 * Firebase init AND the background service worker. Editing the SW file
 * in repo is no longer required.
 *
 * Failure mode: if any env var is missing the corresponding placeholder
 * stays empty (the SW will fail to initialize Firebase, but won't break
 * the rest of the app). Logged as a warning at config-resolve time so
 * misconfigurations show up early.
 */

const PUBLIC_FILE = 'firebase-messaging-sw.js'
const ROUTE_PATH = '/firebase-messaging-sw.js'

/** Token-to-env-var mapping. Keep in sync with the placeholders inside
 *  `public/firebase-messaging-sw.js`. */
const PLACEHOLDERS: Array<{ token: string; envKey: string }> = [
  { token: 'REPLACE_ME_FIREBASE_API_KEY', envKey: 'VITE_FIREBASE_API_KEY' },
  { token: 'REPLACE_ME_FIREBASE_AUTH_DOMAIN', envKey: 'VITE_FIREBASE_AUTH_DOMAIN' },
  { token: 'REPLACE_ME_FIREBASE_PROJECT_ID', envKey: 'VITE_FIREBASE_PROJECT_ID' },
  { token: 'REPLACE_ME_FIREBASE_STORAGE_BUCKET', envKey: 'VITE_FIREBASE_STORAGE_BUCKET' },
  {
    token: 'REPLACE_ME_FIREBASE_MESSAGING_SENDER_ID',
    envKey: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  },
  { token: 'REPLACE_ME_FIREBASE_APP_ID', envKey: 'VITE_FIREBASE_APP_ID' },
]

function substitute(content: string, env: Record<string, string>): string {
  let out = content
  for (const { token, envKey } of PLACEHOLDERS) {
    // String.replaceAll handles the case where a token might appear more
    // than once (e.g. if someone copies the config block into a comment
    // for documentation).
    out = out.replaceAll(token, env[envKey] ?? '')
  }
  return out
}

export function firebaseMessagingSwPlugin(): Plugin {
  let env: Record<string, string> = {}
  let publicDir = ''
  let outDir = ''

  return {
    name: 'crevo:firebase-messaging-sw',

    configResolved(config) {
      // Load only VITE_-prefixed vars — same set the page bundle gets.
      // `loadEnv(mode, dir, prefix)` reads .env / .env.{mode} /
      // .env.local / process.env in the right precedence order.
      env = loadEnv(config.mode, config.root, 'VITE_')
      publicDir = config.publicDir
      outDir = path.isAbsolute(config.build.outDir)
        ? config.build.outDir
        : path.resolve(config.root, config.build.outDir)

      const missing = PLACEHOLDERS.filter((p) => !env[p.envKey])
      if (missing.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[firebase-messaging-sw] Missing env vars; the SW will be emitted with empty Firebase config slots and OS-level push notifications won't work until these are set:\n  ${missing
            .map((p) => p.envKey)
            .join('\n  ')}`,
        )
      }
    },

    /**
     * Dev: intercept /firebase-messaging-sw.js BEFORE Vite's static
     * file middleware sees it, so the browser gets the substituted
     * version without us having to mutate the actual public file.
     * Direct `server.middlewares.use` (not the closure form) registers
     * before Vite's internal sirv handler.
     */
    configureServer(server) {
      server.middlewares.use(ROUTE_PATH, (_req, res, next) => {
        try {
          const swPath = path.resolve(publicDir, PUBLIC_FILE)
          if (!fs.existsSync(swPath)) {
            next()
            return
          }
          const template = fs.readFileSync(swPath, 'utf8')
          const substituted = substitute(template, env)
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          // Service-Worker-Allowed lets the SW claim the site root even
          // though it's served from a deeper path (purely future-proof —
          // the file is at root anyway).
          res.setHeader('Service-Worker-Allowed', '/')
          // Bust browser SW cache during dev so config edits are picked
          // up on reload without manually unregistering.
          res.setHeader('Cache-Control', 'no-store, max-age=0')
          res.end(substituted)
        } catch (err) {
          next(err as Error)
        }
      })
    },

    /**
     * Build: Vite has already copied public/firebase-messaging-sw.js to
     * dist/. Re-read, substitute, and overwrite in place. Synchronous
     * is fine — the file is small and we're past the bundle write phase.
     */
    writeBundle() {
      const swPath = path.join(outDir, PUBLIC_FILE)
      if (!fs.existsSync(swPath)) {
        // Public asset wasn't copied — nothing to do. Could happen if
        // the public file was deleted; we don't fail the build for it.
        return
      }
      const template = fs.readFileSync(swPath, 'utf8')
      const substituted = substitute(template, env)
      fs.writeFileSync(swPath, substituted, 'utf8')
    },
  }
}
