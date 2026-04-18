// Public surface of the chat-inbox feature.
export { ChatUnreadBadge } from './ui/ChatUnreadBadge'
export { InboxList, NoConversationSelected } from './ui/InboxList'
export { ConversationDetail } from './ui/ConversationDetail'
export { ChatMetricsCard } from './ui/ChatMetricsCard'
export { useChatInboxStore } from './model/useChatInboxStore'
export { useInboxConversations } from './hooks/useInboxConversations'
export { useChatInboxAlerts } from './hooks/useChatInboxAlerts'
export type {
  ChatConversationAdminView,
  ChatMessageAdminView,
  ChatConversationStatus,
  ChatSenderType,
  ChatUserInfo,
  ChatMetrics,
  InboxFilters,
} from './types'
