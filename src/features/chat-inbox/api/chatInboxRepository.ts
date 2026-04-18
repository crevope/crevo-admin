import { apiClient } from '@/shared/api/client'
import { supabase } from '@/shared/lib/supabaseClient'
import type {
  ChatInboxListResult,
  ChatConversationDetail,
  ChatConversationAdminView,
  ChatMessageAdminView,
  ChatMetrics,
  ChatAttachmentUploadUrl,
  InboxFilters,
} from '../types'

/**
 * REST client for the agent-facing chat endpoints. Every call is wrapped
 * in the standard {success, message, data} envelope by the backend; we
 * unwrap data here so consumers see the domain shape directly.
 *
 * Filter mapping:
 *   - tab='mine'        → assignedTo = current admin id (caller passes it in)
 *   - tab='unassigned'  → unassignedOnly = true
 *   - tab='all'         → no filter (default)
 */
export const chatInboxRepository = {
  async list(filters: InboxFilters = {}, limit = 50, offset = 0): Promise<ChatInboxListResult> {
    const params: Record<string, string | number | boolean> = {
      limit,
      offset,
    }
    if (filters.status) params.status = filters.status
    if (filters.assignedTo) params.assignedTo = filters.assignedTo
    if (filters.unassignedOnly) params.unassignedOnly = true

    const { data } = await apiClient.get('/chat/admin/inbox', { params })
    return (data?.data ?? { items: [], total: 0, limit, offset }) as ChatInboxListResult
  },

  /**
   * Fetch a single conversation + ALL its messages. Set markRead=false to
   * inspect a thread without flipping read receipts (e.g. when previewing
   * from a notification).
   */
  async getConversation(
    conversationId: string,
    options: { markRead?: boolean } = {},
  ): Promise<ChatConversationDetail> {
    const params: Record<string, string | boolean> = {}
    if (options.markRead === false) params.markRead = false

    const { data } = await apiClient.get(
      `/chat/admin/conversations/${conversationId}`,
      Object.keys(params).length > 0 ? { params } : undefined,
    )
    return data?.data as ChatConversationDetail
  },

  /** Agent reply. Auto-assigns the conversation to the agent if unassigned.
   *  Body or attachment is required (entity invariant). */
  async sendMessage(
    conversationId: string,
    body: string,
    attachment?: {
      path: string
      mimeType: string
      filename: string
      sizeBytes?: number
    },
  ): Promise<ChatMessageAdminView> {
    const { data } = await apiClient.post(`/chat/admin/conversations/${conversationId}/messages`, {
      body,
      attachment,
    })
    return data?.data as ChatMessageAdminView
  },

  /** Step 1 of attachment flow — signed URL from the backend. */
  async requestUploadUrl(params: {
    conversationId: string
    filename: string
    mimeType: string
    sizeBytes: number
  }): Promise<ChatAttachmentUploadUrl> {
    const { data } = await apiClient.post('/chat/attachments/upload-url', params)
    return data?.data as ChatAttachmentUploadUrl
  },

  /** Step 2 — actual upload via Supabase JS SDK helper. */
  async uploadAttachment(file: File, signed: ChatAttachmentUploadUrl): Promise<void> {
    const { error } = await supabase.storage
      .from('chat-attachments')
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: file.type,
      })
    if (error) {
      throw new Error(error.message || 'No se pudo subir el archivo')
    }
  },

  /** Explicit assign — if `agentId` is omitted the backend self-assigns to caller. */
  async assign(conversationId: string, agentId?: string): Promise<ChatConversationAdminView> {
    const { data } = await apiClient.post(`/chat/admin/conversations/${conversationId}/assign`, {
      agentId,
    })
    return data?.data as ChatConversationAdminView
  },

  /** Close the conversation. Backend emits a SYSTEM closing notice + broadcast. */
  async close(conversationId: string): Promise<ChatConversationAdminView> {
    const { data } = await apiClient.post(`/chat/admin/conversations/${conversationId}/close`, {})
    return data?.data as ChatConversationAdminView
  },

  /** Re-open a CLOSED conversation. Backend emits a SYSTEM reopen notice + broadcast. */
  async reopen(conversationId: string): Promise<ChatConversationAdminView> {
    const { data } = await apiClient.post(`/chat/admin/conversations/${conversationId}/reopen`, {})
    return data?.data as ChatConversationAdminView
  },

  /**
   * Aggregate KPIs (TTFR, TTC, response/close rates, counters) over a
   * rolling window. `windowDays` is clamped server-side to [1, 365];
   * default 30.
   */
  async getMetrics(windowDays?: number): Promise<ChatMetrics> {
    const { data } = await apiClient.get('/chat/admin/metrics', {
      params: windowDays ? { windowDays } : undefined,
    })
    return data?.data as ChatMetrics
  },
}
