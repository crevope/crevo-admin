import { Link } from 'react-router-dom'
import { Loader2, MessageCircle, Inbox as InboxIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { formatRelativeDate } from '@/shared/lib/utils'
import { Badge } from '@/shared/ui/badge'
import type { ChatConversationAdminView } from '../types'
import { chatUserDisplayName, chatUserInitials } from '../types'

interface Props {
  items: ChatConversationAdminView[]
  isLoading: boolean
  activeConversationId: string | null
}

/**
 * Left pane: scrollable list of conversations. Each row links to the
 * detail route (the page reads :conversationId from URL → setActive).
 *
 * Visual hierarchy mirrors Gmail / Intercom:
 *   - Bold text + accent bar on rows with unread agent messages
 *   - Closed conversations dim further down
 *   - Last-message preview truncated to one line
 *   - Time anchored to the right
 *
 * User identity: backend doesn't currently JOIN users into the inbox
 * payload, so we show a short user-id placeholder. A future backend
 * enhancement (Batch 4) will enrich the response with name/email.
 */
export function InboxList({ items, isLoading, activeConversationId }: Props) {
  if (isLoading && items.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
        <InboxIcon className="h-10 w-10 mb-3 text-muted-foreground/40" aria-hidden="true" />
        <p className="text-sm">Sin conversaciones</p>
        <p className="text-xs mt-1">
          Cuando un usuario inicie un chat aparecerá acá.
        </p>
      </div>
    )
  }

  return (
    // min-h-0 lets this flex-1 child shrink below its content's intrinsic
    // height so overflow-y-auto actually clips. Without it, a long list
    // would push the aside taller than the page and the outer layout
    // would scroll instead of just this list.
    <ol className="flex-1 min-h-0 overflow-y-auto divide-y divide-border">
      {items.map((c) => (
        <ConversationRow
          key={c.id}
          conversation={c}
          isActive={c.id === activeConversationId}
        />
      ))}
    </ol>
  )
}

function ConversationRow({
  conversation,
  isActive,
}: {
  conversation: ChatConversationAdminView
  isActive: boolean
}) {
  const hasUnread = conversation.agentUnreadCount > 0
  const isClosed = conversation.status === 'CLOSED'
  const displayName = chatUserDisplayName(conversation.user, conversation.userId)
  const initials = chatUserInitials(conversation.user, conversation.userId)

  return (
    <li>
      <Link
        to={`/chat/${conversation.id}`}
        className={cn(
          'block px-4 py-3 transition-colors',
          isActive
            ? 'bg-brand-accent/10 border-l-2 border-brand-accent'
            : 'border-l-2 border-transparent hover:bg-muted/50',
          isClosed && !isActive && 'opacity-60',
        )}
      >
        <div className="flex items-start gap-2.5">
          {/* Avatar — initials over a brand-tinted circle. The backend
              hands us the resolved user; we never call out for a photo
              url because chat doesn't currently surface profile pics. */}
          <div className="h-9 w-9 rounded-full bg-brand-accent/15 text-brand-accent flex items-center justify-center shrink-0 text-xs font-semibold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p
                className={cn(
                  'text-sm truncate',
                  hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground',
                )}
                title={displayName}
              >
                {displayName}
              </p>
              {conversation.lastMessageAt && (
                <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                  {formatRelativeDate(conversation.lastMessageAt)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  'text-xs truncate',
                  hasUnread ? 'text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                {conversation.lastMessageSender === 'agent' && 'Tú: '}
                {conversation.lastMessagePreview ?? (
                  <span className="italic text-muted-foreground/60">Sin mensajes aún</span>
                )}
              </p>
              <div className="flex items-center gap-1.5 shrink-0">
                {hasUnread && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1.5 text-[9px]">
                    {conversation.agentUnreadCount > 9 ? '9+' : conversation.agentUnreadCount}
                  </Badge>
                )}
                {isClosed && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                    Cerrada
                  </Badge>
                )}
                {!conversation.assignedTo && !isClosed && (
                  <Badge variant="outline" className="h-4 px-1.5 text-[9px]">
                    Nueva
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </li>
  )
}

/** Empty-state placeholder shown in the right pane when no conversation
 *  is selected. Exported here for layout convenience. */
export function NoConversationSelected() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-muted-foreground bg-background">
      <MessageCircle
        className="h-12 w-12 mb-4 text-muted-foreground/30"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-foreground">Selecciona una conversación</p>
      <p className="text-xs mt-1 max-w-xs">
        Las conversaciones nuevas y los mensajes entrantes aparecen en la lista de la izquierda.
      </p>
    </div>
  )
}
