import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Loader2,
  ExternalLink,
  X,
  UserCheck,
  UserCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { formatDateTime } from '@/shared/lib/utils'
import { chatInboxRepository } from '../api/chatInboxRepository'
import { useConversationDetail, conversationQueryKey } from '../hooks/useConversationDetail'
import { useChatInboxStore } from '../model/useChatInboxStore'
import { MessageBubble } from './MessageBubble'
import { AgentComposer } from './AgentComposer'
import { TypingIndicator } from './TypingIndicator'
import type { ChatConversationDetail as Detail } from '../types'

interface Props {
  conversationId: string
  agentId: string
}

/**
 * Right pane: conversation header + scrolling thread + composer.
 *
 * Header carries the actions an agent might take (assign self, close)
 * plus a deep link into the customer profile so the agent can pull the
 * user's loan/KYC context without leaving the chat.
 *
 * Auto-scrolls to bottom on every message addition (matches what the
 * user widget does on the other side — keeps both sides aligned on the
 * "live tail" of the thread).
 */
export function ConversationDetail({ conversationId, agentId }: Props) {
  const qc = useQueryClient()
  const isUserTyping = useChatInboxStore((s) => s.isUserTyping)
  const { data, isLoading, isError, error } = useConversationDetail(conversationId)

  const assignMutation = useMutation({
    mutationFn: () => chatInboxRepository.assign(conversationId),
    onSuccess: (updated) => {
      qc.setQueryData<Detail | undefined>(conversationQueryKey(conversationId), (prev) => {
        if (!prev) return prev
        return { conversation: updated, messages: prev.messages }
      })
      qc.invalidateQueries({ queryKey: ['admin', 'chat', 'inbox'] })
      toast.success('Conversación asignada a ti')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'No pudimos asignar'),
  })

  const closeMutation = useMutation({
    mutationFn: () => chatInboxRepository.close(conversationId),
    onSuccess: (updated) => {
      qc.setQueryData<Detail | undefined>(conversationQueryKey(conversationId), (prev) => {
        if (!prev) return prev
        return { conversation: updated, messages: prev.messages }
      })
      qc.invalidateQueries({ queryKey: ['admin', 'chat', 'inbox'] })
      toast.success('Conversación cerrada')
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'No pudimos cerrar'),
  })

  const endRef = useRef<HTMLDivElement | null>(null)
  const messageCount = data?.messages?.length ?? 0
  // Auto-scroll on new message AND when the typing indicator appears, so
  // the agent sees the user start writing without manually scrolling.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messageCount, isUserTyping])

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-sm text-destructive">
        {error instanceof Error ? error.message : 'No pudimos cargar la conversación'}
      </div>
    )
  }

  const { conversation, messages } = data
  const isClosed = conversation.status === 'CLOSED'
  const isMine = conversation.assignedTo === agentId

  return (
    // min-h-0 is the magic that lets the inner thread (flex-1 overflow-y-auto)
    // actually clip its content. Without it, flex children refuse to shrink
    // below their intrinsic size and the thread pushes past us, making the
    // outer page scroll instead of the thread itself.
    <div className="flex-1 flex flex-col bg-background min-w-0 min-h-0">
      {/* Header */}
      <header className="shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground truncate">
                Usuario #{conversation.userId.slice(0, 8)}
              </h2>
              {isClosed && (
                <Badge variant="secondary" className="h-5 text-[10px]">
                  Cerrada
                </Badge>
              )}
              {!conversation.assignedTo && !isClosed && (
                <Badge variant="outline" className="h-5 text-[10px]">
                  Sin asignar
                </Badge>
              )}
              {isMine && !isClosed && (
                <Badge className="h-5 text-[10px] bg-brand-accent/10 text-brand-accent border-brand-accent/30">
                  Asignada a ti
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Iniciada {formatDateTime(conversation.createdAt)}
              {conversation.closedAt && (
                <> · Cerrada {formatDateTime(conversation.closedAt)}</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="h-8 gap-1.5 text-xs"
              title="Abrir ficha del cliente"
            >
              <Link to={`/customers/${conversation.userId}`}>
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cliente</span>
              </Link>
            </Button>
            {!isClosed && !isMine && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending}
                className="h-8 gap-1.5 text-xs"
                title="Asignarme esta conversación"
              >
                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Tomar</span>
              </Button>
            )}
            {!isClosed && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                title="Cerrar conversación"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cerrar</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Thread — flat single-background pane (no muted tint frame). The
          OL is centered with max-w-3xl so bubbles read as a coherent column
          on wide monitors; the scroll container stays full-width so the
          scrollbar hugs the right edge of the panel. min-h-0 enables the
          internal scroll. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ol className="max-w-3xl mx-auto px-3 py-4 space-y-2.5">
          {messages.length === 0 ? (
            <li className="flex items-center justify-center h-40 text-sm text-muted-foreground gap-2">
              <UserCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Sin mensajes aún.</span>
            </li>
          ) : (
            renderMessagesWithDaySeparators(messages)
          )}
          {isUserTyping && (
            <li className="pt-1">
              <TypingIndicator label="El usuario está escribiendo" />
            </li>
          )}
          <div ref={endRef} />
        </ol>
      </div>

      {/* Composer rail — full-width separator (border-t + bg) so the
          divider runs edge-to-edge of the detail pane; the inner div
          centers the actual textarea+send to align with the thread above. */}
      <div className="shrink-0 border-t border-border bg-card">
        <div className="max-w-3xl mx-auto">
          <AgentComposer
            conversationId={conversationId}
            isClosed={isClosed}
            agentId={agentId}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Day separators (single-pass, no closure mutation) ──────────────────

function renderMessagesWithDaySeparators(messages: Detail['messages']) {
  const showSeparatorAt = new Array<boolean>(messages.length)
  let lastDayKey = ''
  for (let i = 0; i < messages.length; i++) {
    const dayKey = new Date(messages[i].createdAt).toDateString()
    showSeparatorAt[i] = dayKey !== lastDayKey
    lastDayKey = dayKey
  }

  return messages.map((m, i) => (
    <div key={m.id}>
      {showSeparatorAt[i] && (
        <li aria-hidden="true" className="flex justify-center py-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-card px-2.5 py-0.5 rounded-full border border-border">
            {dayLabel(m.createdAt)}
          </span>
        </li>
      )}
      <MessageBubble message={m} />
    </div>
  ))
}

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (sameDay(d, today)) return 'Hoy'
  if (sameDay(d, yesterday)) return 'Ayer'
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}
