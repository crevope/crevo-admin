import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  Clock,
  Loader2,
  MessageSquareReply,
  TimerReset,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { chatInboxRepository } from '../api/chatInboxRepository'
import type { ChatMetrics } from '../types'

/**
 * KPIs panel rendered above (or alongside) the chat inbox. Polls every
 * 60 seconds — slower cadence than the inbox listing because the metrics
 * change in aggregate over hours/days, not per-message.
 *
 * Five primary KPIs surfaced today:
 *   1. Total conversations in the window
 *   2. Response rate (% with any agent reply)
 *   3. TTFR median + p95 (how fast we answer + worst-case)
 *   4. TTC median (how long conversations stay open before closure)
 *   5. Currently waiting (OPEN with unread user message → "on my plate")
 *
 * The card is intentionally read-only — there are no clicks here. For
 * drill-down (filter by date range, see per-conversation TTFR) we'd
 * eventually build a /chat/metrics standalone page; for Phase 1 this
 * compact summary is what the agent needs at a glance.
 */
export function ChatMetricsCard({ windowDays = 30 }: { windowDays?: number } = {}) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'chat', 'metrics', windowDays],
    queryFn: () => chatInboxRepository.getMetrics(windowDays),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
        <span className="text-xs">Cargando métricas…</span>
      </div>
    )
  }

  return (
    // Presentation-only — no border/bg here. The parent wraps us so the
    // metrics card and the chat card render as visually separate
    // "tiles" in the page layout.
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Métricas (últimos {data.windowDays} días)
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Kpi
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Conversaciones"
          value={String(data.totalConversations)}
          sub={`${data.closedConversations} cerradas`}
        />
        <Kpi
          icon={<MessageSquareReply className="h-3.5 w-3.5" />}
          label="Tasa de respuesta"
          value={formatPct(data.responseRate)}
          sub={`${data.answeredConversations} respondidas`}
          tone={data.responseRate < 0.7 ? 'warn' : 'ok'}
        />
        <Kpi
          icon={<Clock className="h-3.5 w-3.5" />}
          label="TTFR mediana"
          value={formatDuration(data.ttfrMedianMinutes)}
          sub={`p95 ${formatDuration(data.ttfrP95Minutes)}`}
        />
        <Kpi
          icon={<TimerReset className="h-3.5 w-3.5" />}
          label="TTC mediana"
          value={formatDuration(data.ttcMedianMinutes)}
          sub={`promedio ${formatDuration(data.ttcAvgMinutes)}`}
        />
        <Kpi
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="Esperando ahora"
          value={String(data.openWithUnread)}
          sub="abiertas con mensajes nuevos"
          tone={data.openWithUnread > 0 ? 'warn' : 'ok'}
        />
      </div>
    </div>
  )
}

// ─── Tile ────────────────────────────────────────────────────────────────

interface KpiProps {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  /** `warn` paints the value in a warning hue (responsiveness < 70%, or
   *  a non-zero "waiting now" count). Default `neutral` is theme-default. */
  tone?: 'neutral' | 'ok' | 'warn'
}

function Kpi({ icon, label, value, sub, tone = 'neutral' }: KpiProps) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1 text-muted-foreground">
        <span className="text-brand-accent">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium truncate">{label}</span>
      </div>
      <p
        className={cn(
          'text-lg font-semibold leading-tight',
          tone === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Format helpers ──────────────────────────────────────────────────────

/** "—" for null (no samples in window), human duration otherwise. */
function formatDuration(min: number | null): string {
  if (min === null) return '—'
  if (min < 1) return '< 1 min'
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min - h * 60)
  if (h < 24) return m > 0 ? `${h}h ${m}m` : `${h}h`
  const d = Math.floor(h / 24)
  const remH = h - d * 24
  return remH > 0 ? `${d}d ${remH}h` : `${d}d`
}

function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

/** Re-export type so consumers can import from the UI surface alone. */
export type { ChatMetrics }
