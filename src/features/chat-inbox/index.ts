// Public surface of the chat-inbox feature.
export { ChatUnreadBadge } from './ui/ChatUnreadBadge'
export { InboxList, NoConversationSelected } from './ui/InboxList'
export { ConversationDetail } from './ui/ConversationDetail'
export { useChatInboxStore } from './model/useChatInboxStore'
export { useInboxConversations } from './hooks/useInboxConversations'
export { useChatInboxAlerts } from './hooks/useChatInboxAlerts'
export type {
  ChatConversationAdminView,
  ChatMessageAdminView,
  ChatConversationStatus,
  ChatSenderType,
  ChatUserInfo,
  InboxFilters,
} from './types'
