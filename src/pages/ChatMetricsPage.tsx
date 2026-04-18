import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { ChatMetricsCard } from '@/features/chat-inbox'

/**
 * Standalone metrics page at /chat/metrics.
 *
 * Moved out of ChatInboxPage because the KPI strip was eating ~120px of
 * vertical space from the chat itself, leaving a cramped thread on
 * smaller screens. The inbox is the agent's daily tool — it should
 * take the full height; metrics are a periodic glance the agent can
 * open from the chat header when curious.
 *
 * Composition is deliberately sparse: just the existing ChatMetricsCard
 * component wrapped in a page shell. When we add per-agent comparison,
 * date-range pickers, or trend charts, they land here without affecting
 * the inbox layout.
 */
export function ChatMetricsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Métricas del chat de soporte
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            TTFR, TTC, tasa de respuesta y cola en tiempo real.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-2 text-xs">
          <Link to="/chat">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Volver al inbox
          </Link>
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <ChatMetricsCard />
      </div>
    </div>
  )
}
