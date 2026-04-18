import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Headphones, BarChart3 } from 'lucide-react'
import { useAdminAuthStore } from '@/features/admin-auth'
import { cn } from '@/shared/lib/utils'
import {
  InboxList,
  NoConversationSelected,
  ConversationDetail,
  useChatInboxStore,
  useInboxConversations,
  type InboxFilters,
} from '@/features/chat-inbox'

/**
 * Two-pane chat inbox.
 *
 * Routes:
 *   - /chat                    → list visible, no conversation selected
 *   - /chat/:conversationId    → list + detail
 *   - /chat/metrics            → separate ChatMetricsPage (sibling route)
 *
 * The URL is the source of truth for the active conversation. The page
 * mirrors :conversationId into the inbox store on mount and on click,
 * which in turn manages the Supabase Realtime subscription.
 *
 * Metrics live on their own page (see ChatMetricsPage) so the inbox
 * uses the full available height for the conversation view; a
 * "Métricas" link in the header jumps there.
 *
 * On mobile (< md) the panes stack: when a conversation is selected we
 * hide the list and show only the detail; otherwise we show only the
 * list. A back button in the detail header handles the reverse.
 */

interface TabDef {
  value: NonNullable<InboxFilters['tab']>
  label: string
  /** When set, queries this status instead of the default OPEN. */
  status?: 'OPEN' | 'CLOSED'
}

const TABS: TabDef[] = [
  { value: 'all', label: 'Todas' },
  { value: 'mine', label: 'Mías' },
  { value: 'unassigned', label: 'Sin asignar' },
  { value: 'closed', label: 'Cerradas', status: 'CLOSED' },
]

export function ChatInboxPage() {
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId?: string }>()
  const { user } = useAdminAuthStore()
  const setActive = useChatInboxStore((s) => s.setActive)
  const unsubscribe = useChatInboxStore((s) => s.unsubscribe)

  const [tab, setTab] = useState<NonNullable<InboxFilters['tab']>>('all')

  // Mirror URL → store. Tearing down on page leave is essential — the
  // Realtime channel would leak otherwise.
  useEffect(() => {
    setActive(conversationId ?? null)
    return () => {
      unsubscribe()
    }
  }, [conversationId, setActive, unsubscribe])

  const activeTab = TABS.find((t) => t.value === tab) ?? TABS[0]
  // Default to OPEN unless the tab explicitly asks for CLOSED. The
  // backend clamp (not here) ensures the page never serves neither.
  const status: 'OPEN' | 'CLOSED' = activeTab.status ?? 'OPEN'

  const { data, isLoading } = useInboxConversations({
    filters: { tab, status },
    agentId: user?.id ?? '',
    enabled: Boolean(user?.id),
  })

  const items = data?.items ?? []
  const showDetailOnly = Boolean(conversationId)

  return (
    // Outer wrapper takes full available height inside AdminLayout's
    // main area. Negative margins cancel AdminLayout's p-6/p-8 wrapper
    // padding so we own the layout edge-to-edge; we then add p-4/p-6
    // for breathing room around the chat card.
    //
    // With metrics moved to their own page, the chat card now uses the
    // full height — no gap + shrink-0 header strip above it.
    <div
      className="-m-6 lg:-m-8 p-4 lg:p-6 overflow-hidden flex flex-col
                 h-[calc(100dvh-6.5rem)] md:h-[calc(100dvh-3rem)] lg:h-[calc(100dvh-4rem)]"
    >
      <div className="flex-1 min-h-0 flex flex-col md:flex-row rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* List pane */}
        <aside
          className={cn(
            'flex flex-col border-border bg-card min-h-0',
            // Width tiers: 72 at md, 80 at lg+ — the 288px width at
            // md-to-lg is tighter but still readable, preventing the
            // detail pane from feeling cramped on laptop screens.
            'md:w-72 lg:w-80 md:shrink-0 md:border-r',
            showDetailOnly ? 'hidden md:flex' : 'flex flex-1',
          )}
        >
          {/* Header + tabs */}
          <div className="shrink-0 border-b border-border">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <Headphones className="h-4 w-4 text-brand-accent shrink-0" aria-hidden="true" />
                <h1 className="text-sm font-semibold truncate">Chat de soporte</h1>
              </div>
              {/* Métricas link — takes the agent to /chat/metrics without
                  stealing any vertical space from the list. */}
              <Link
                to="/chat/metrics"
                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-brand-accent transition-colors"
                title="Ver métricas del chat"
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">Métricas</span>
              </Link>
            </div>
            {/* Tabs — horizontal scroll on narrow widths so 4 labels
                ("Todas", "Mías", "Sin asignar", "Cerradas") don't wrap. */}
            <div className="flex border-t border-border overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={cn(
                    'flex-1 min-w-fit whitespace-nowrap px-2 py-2 text-xs font-medium transition-colors border-b-2',
                    tab === t.value
                      ? 'border-brand-accent text-brand-accent'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <InboxList
            items={items}
            isLoading={isLoading}
            activeConversationId={conversationId ?? null}
          />
        </aside>

        {/* Detail pane */}
        <section
          className={cn(
            'flex-1 flex flex-col min-w-0 min-h-0',
            showDetailOnly ? 'flex' : 'hidden md:flex',
          )}
        >
          {/* Mobile back button when a conversation is open */}
          {showDetailOnly && (
            <button
              type="button"
              onClick={() => navigate('/chat')}
              className="md:hidden shrink-0 px-4 py-2 text-xs text-brand-accent border-b border-border bg-card text-left"
            >
              ← Volver al inbox
            </button>
          )}

          {conversationId && user?.id ? (
            <ConversationDetail conversationId={conversationId} agentId={user.id} />
          ) : (
            <NoConversationSelected />
          )}
        </section>
      </div>
    </div>
  )
}
