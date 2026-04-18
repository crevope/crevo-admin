import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chatInboxRepository } from '../api/chatInboxRepository'
import { useChatInboxStore } from '../model/useChatInboxStore'
import type {
  ChatBroadcastEvent,
  ChatConversationDetail,
  ChatMessageAdminView,
} from '../types'
import { isTempId } from '../types'

export const conversationQueryKey = (conversationId: string) =>
  ['admin', 'chat', 'conversation', conversationId] as const

/**
 * Fetches a single conversation + its messages, AND wires the Realtime
 * channel so incoming events are merged into the React Query cache live.
 *
 * Cache shape: `ChatConversationDetail = { conversation, messages }`.
 * Mutations (sendMessage) update the cache optimistically + replace on
 * success; Realtime events from the OTHER party (user) merge by id.
 *
 * The store's onEvent registry is the link between the Realtime channel
 * (lives in the inbox store) and the React Query cache (lives here).
 */
export function useConversationDetail(conversationId: string | null) {
  const qc = useQueryClient()
  const onEvent = useChatInboxStore((s) => s.onEvent)

  const query = useQuery({
    queryKey: conversationId
      ? conversationQueryKey(conversationId)
      : ['admin', 'chat', 'conversation', 'none'],
    queryFn: () => {
      if (!conversationId) return Promise.resolve(null as unknown as ChatConversationDetail)
      return chatInboxRepository.getConversation(conversationId, { markRead: true })
    },
    enabled: Boolean(conversationId),
    // Don't auto-refetch — we get all updates via Realtime. A focus
    // refetch covers the case where the agent left the tab and is
    // returning after some time without realtime updates landing.
    refetchOnWindowFocus: 'always',
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!conversationId) return
    const unsubscribe = onEvent((event: ChatBroadcastEvent) => {
      // Only handle events for THIS conversation (the channel is keyed by
      // id but defensive guard against future multi-channel scenarios).
      const incomingConvId =
        event.type === 'message' ? event.message.conversationId : event.conversationId
      if (incomingConvId !== conversationId) return

      qc.setQueryData<ChatConversationDetail | undefined>(
        conversationQueryKey(conversationId),
        (prev) => {
          if (!prev) return prev
          return _applyEventToCache(prev, event)
        },
      )

      // Also invalidate the inbox list so the conversation jumps to top
      // and the unread counts refresh. We don't know the active filters
      // here so we invalidate ALL inbox queries (cheap — single endpoint
      // call with React Query's de-dup).
      qc.invalidateQueries({ queryKey: ['admin', 'chat', 'inbox'] })
    })
    return unsubscribe
  }, [conversationId, onEvent, qc])

  return query
}

// ─── Pure event reducer ──────────────────────────────────────────────────

function _applyEventToCache(
  prev: ChatConversationDetail,
  event: ChatBroadcastEvent,
): ChatConversationDetail {
  switch (event.type) {
    case 'message': {
      const incoming = event.message
      // Dedupe by id (Realtime + REST may both deliver the same row).
      if (prev.messages.some((m) => m.id === incoming.id)) return prev
      // Optimistic temp swap (rare — only when broadcast beats REST response).
      const tempIdx = prev.messages.findIndex(
        (m) => isTempId(m.id) && m.senderType === incoming.senderType && m.body === incoming.body,
      )
      let nextMessages: ChatMessageAdminView[]
      if (tempIdx >= 0) {
        nextMessages = [...prev.messages]
        const previousTemp = prev.messages[tempIdx]
        // Preserve the optimistic local blob URL on attachments. The
        // broadcast carries `attachmentPath` but NOT a signed URL
        // (signed URLs expire). Without this, the bubble flashes "no
        // disponible" between broadcast arrival and REST completion —
        // see matching fix in AgentComposer.onSuccess for the canonical
        // swap once the server response lands.
        nextMessages[tempIdx] = {
          ...incoming,
          attachmentUrl: incoming.attachmentUrl ?? previousTemp.attachmentUrl ?? null,
        }
      } else {
        nextMessages = [...prev.messages, incoming]
      }

      // Bump conversation activity + unread (only for user messages —
      // agent messages don't count as unread for the agent). user info
      // passes through unchanged — broadcast events never alter the
      // owner identity.
      const isFromUser = incoming.senderType === 'user'
      return {
        conversation: {
          ...prev.conversation,
          lastMessageAt: incoming.createdAt,
          lastMessageSender: incoming.senderType,
          lastMessagePreview: incoming.body.slice(0, 120),
          agentUnreadCount: isFromUser
            ? prev.conversation.agentUnreadCount + 1
            : prev.conversation.agentUnreadCount,
        },
        messages: nextMessages,
        user: prev.user,
      }
    }
    case 'read_receipt': {
      // Only "user read mine" matters to the agent UI: flip our agent
      // messages to ✓✓ leído.
      if (event.readerType !== 'user') return prev
      return {
        conversation: prev.conversation,
        messages: prev.messages.map((m) =>
          m.senderType === 'agent' && !m.readAt ? { ...m, readAt: event.at } : m,
        ),
        user: prev.user,
      }
    }
    case 'conversation_closed': {
      return {
        conversation: {
          ...prev.conversation,
          status: 'CLOSED',
          closedAt: event.closedAt,
        },
        messages: prev.messages,
        user: prev.user,
      }
    }
    case 'conversation_reopened': {
      // Symmetric to close — flip status, clear closedAt so the
      // "Cerrada" badge disappears and the composer re-enables.
      return {
        conversation: {
          ...prev.conversation,
          status: 'OPEN',
          closedAt: null,
        },
        messages: prev.messages,
        user: prev.user,
      }
    }
    case 'typing': {
      // Typing events don't touch the React Query cache — they're
      // handled by the inbox store directly (isUserTyping flag).
      // Returning prev keeps the cache untouched.
      return prev
    }
  }
}
