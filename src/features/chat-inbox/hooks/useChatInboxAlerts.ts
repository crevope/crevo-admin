import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { chatInboxRepository } from '../api/chatInboxRepository'

const DEFAULT_TITLE = 'Crevo Admin'

/**
 * Two cross-cutting alerts the agent needs so they don't miss messages
 * while doing other work in the admin panel:
 *
 *   1. Tab title: when the page is hidden (other tab focused, window
 *      minimized) AND there are unread agent messages, prepend `(N)`
 *      so the count is visible in the OS tab strip.
 *   2. Notification ping: when a NEW message arrives (i.e., the unread
 *      total just increased) AND the page is hidden, play a short
 *      synthesized beep. We keep it Web-Audio-only (no asset file) so
 *      there's nothing to bundle and nothing to load on first paint.
 *
 * Both alerts auto-clear when the agent refocuses the page — at that
 * point the inbox is in front of them and any further nudge would be
 * noise.
 *
 * Mount this hook ONCE inside AdminLayout so the alerts work even when
 * the agent is on a non-chat page (customer profile, dashboard, etc.).
 * Reads the same React Query cache as ChatUnreadBadge — no extra network
 * calls, just shared snapshot.
 */
export function useChatInboxAlerts(): void {
  const prevTotalRef = useRef(0)

  // Same query key as ChatUnreadBadge — React Query dedupes so we share
  // a single fetch + 15-s polling cadence. Counts only OPEN
  // conversations (CLOSED ones have no actionable unread for the agent).
  const { data } = useQuery({
    queryKey: ['admin', 'chat', 'unread-total'],
    queryFn: () => chatInboxRepository.list({ status: 'OPEN' }, 100, 0),
    refetchInterval: 15_000,
    staleTime: 5_000,
  })

  const total = (data?.items ?? [])
    .filter((c) => c.status === 'OPEN')
    .reduce((sum, c) => sum + c.agentUnreadCount, 0)

  useEffect(() => {
    const prev = prevTotalRef.current
    prevTotalRef.current = total

    // Title — driven on every tick so it stays in sync with the
    // current count + visibility, not only on the first change.
    if (typeof document !== 'undefined') {
      if (total > 0 && document.visibilityState !== 'visible') {
        document.title = `(${total > 99 ? '99+' : total}) ${DEFAULT_TITLE}`
      } else {
        document.title = DEFAULT_TITLE
      }
    }

    // Ping — only if the count GREW since last tick AND the agent
    // isn't already looking at the tab. Skip the very first render
    // (prev === 0 from initial cache hydration) so we don't beep
    // on page load.
    if (
      total > prev &&
      prev !== 0 &&
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      playNotificationPing()
    }
  }, [total])

  // Refocus → reset title back to the bare admin name and zero out
  // the prev counter so the very next message bumps the title even if
  // the unread total didn't grow numerically (e.g., the agent opened
  // the tab, which read everything down to zero, and then a new
  // message arrives).
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        document.title = DEFAULT_TITLE
        prevTotalRef.current = total
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [total])
}

// ─── Web Audio synthesized ping ─────────────────────────────────────────────

/**
 * Two-tone "ding" played without any audio asset. Web Audio is gated by
 * the browser's user-activation requirement — autoplay policies block
 * audio without prior user interaction. Once the agent has clicked
 * anywhere in the admin panel (login, navigation, anything), AudioContext
 * can be created and pings work for the rest of the session.
 *
 * Wrapped in try/catch so a context-creation failure (e.g., browser
 * blocked, headless test) never bubbles up and breaks the inbox.
 */
function playNotificationPing(): void {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return

    const ctx = new Ctor()
    const now = ctx.currentTime

    // Two short tones a perfect fourth apart — discrete "ding"
    // without being shrill. Soft attack + exponential decay avoids
    // clicks at start/end.
    playTone(ctx, 880, now, 0.12)
    playTone(ctx, 1175, now + 0.09, 0.18)
  } catch {
    // Browser blocked AudioContext or it's unavailable — ignore silently.
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = frequency
  osc.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(0.18, startAt + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}
