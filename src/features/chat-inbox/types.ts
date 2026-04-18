/**
 * Wire-format types mirroring crevo-backend's admin chat endpoints.
 * Admins receive the full toJSON() variant (with assignedTo, unread
 * counts, etc.) — unlike the user widget which gets the redacted
 * toUserJSON() shape.
 */

export type ChatSenderType = 'user' | 'agent' | 'system'
export type ChatConversationStatus = 'OPEN' | 'CLOSED'

/** Owner info attached to inbox + detail responses by the backend
 *  (resolved server-side via JOIN). NULL when the user was anonymized
 *  under Ley 29733 — UI should fall back to a placeholder. */
export interface ChatUserInfo {
  id: string
  firstName: string
  lastName: string
  email: string
}

/** From `ChatConversation.toJSON()` (admin view). The backend's inbox
 *  endpoint augments this with a `user` field containing owner info;
 *  detail endpoint returns user separately at the top level. */
export interface ChatConversationAdminView {
  id: string
  userId: string
  assignedTo: string | null
  assignedAt: string | null
  status: ChatConversationStatus
  closedAt: string | null
  closedBy: string | null
  lastMessageAt: string | null
  lastMessageSender: ChatSenderType | null
  lastMessagePreview: string | null
  userUnreadCount: number
  agentUnreadCount: number
  createdAt: string
  updatedAt: string
  /** Backend attaches this in the inbox listing only (per item). */
  user?: ChatUserInfo | null
}

/** From `ChatMessage.toJSON()`. */
export interface ChatMessageAdminView {
  id: string
  conversationId: string
  senderType: ChatSenderType
  senderId: string | null
  body: string
  readAt: string | null
  createdAt: string
}

export interface ChatInboxListResult {
  items: ChatConversationAdminView[]
  total: number
  limit: number
  offset: number
}

export interface ChatConversationDetail {
  conversation: ChatConversationAdminView
  messages: ChatMessageAdminView[]
  /** Owner info, resolved server-side. NULL if the user was anonymized. */
  user: ChatUserInfo | null
}

// ─── Broadcast event union (mirrors backend IChatBroadcaster) ────────────────

export interface ChatBroadcastMessageEvent {
  type: 'message'
  message: ChatMessageAdminView
}

export interface ChatBroadcastReadReceiptEvent {
  type: 'read_receipt'
  conversationId: string
  readerType: 'user' | 'agent'
  at: string
}

export interface ChatBroadcastConversationClosedEvent {
  type: 'conversation_closed'
  conversationId: string
  closedAt: string
}

/** Transient "X is typing" — emitted client→client (no backend round-trip),
 *  debounced on sender, auto-cleared 5s after last event on receiver. */
export interface ChatBroadcastTypingEvent {
  type: 'typing'
  conversationId: string
  senderType: 'user' | 'agent'
  isTyping: boolean
  at: string
}

export type ChatBroadcastEvent =
  | ChatBroadcastMessageEvent
  | ChatBroadcastReadReceiptEvent
  | ChatBroadcastConversationClosedEvent
  | ChatBroadcastTypingEvent

// ─── Optimistic UI helpers ───────────────────────────────────────────────────

export const TEMP_ID_PREFIX = 'temp-'

export function isTempId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX)
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/**
 * Renders the owner display name for an inbox row / detail header.
 * Falls back to a stable shortened-uuid placeholder when the backend
 * returned `user: null` (account anonymized under Ley 29733).
 */
export function chatUserDisplayName(
  user: ChatUserInfo | null | undefined,
  userId: string,
): string {
  if (user) {
    const name = `${user.firstName} ${user.lastName}`.trim()
    if (name) return name
    return user.email
  }
  return `Usuario #${userId.slice(0, 8)}`
}

/** Two-letter initials for avatar circles. */
export function chatUserInitials(
  user: ChatUserInfo | null | undefined,
  userId: string,
): string {
  if (user) {
    const f = user.firstName.trim().charAt(0)
    const l = user.lastName.trim().charAt(0)
    if (f || l) return `${f}${l}`.toUpperCase() || 'U'
  }
  return userId.slice(0, 2).toUpperCase()
}

// ─── Inbox filters ───────────────────────────────────────────────────────────

export interface InboxFilters {
  status?: ChatConversationStatus
  assignedTo?: string
  unassignedOnly?: boolean
  /** Convenience filter for the UI tabs: 'all' | 'mine' | 'unassigned'. */
  tab?: 'all' | 'mine' | 'unassigned'
}
