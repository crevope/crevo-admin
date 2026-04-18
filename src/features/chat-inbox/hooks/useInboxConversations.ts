import { useQuery } from '@tanstack/react-query'
import { chatInboxRepository } from '../api/chatInboxRepository'
import type { InboxFilters } from '../types'

/**
 * Returns the inbox listing for the given filters. Backed by React Query;
 * polls every 15 seconds so new conversations and incoming user messages
 * surface in the list even when the active conversation is something else
 * (the per-conversation Realtime subscription only fires for the open
 * thread, not for siblings).
 *
 * `inboxQueryKey()` is exported so mutations and Realtime fan-out can
 * invalidate consistently.
 */
export const inboxQueryKey = (filters: InboxFilters, agentId: string) => [
  'admin',
  'chat',
  'inbox',
  agentId,
  filters.tab ?? 'all',
  filters.status ?? null,
] as const

interface UseInboxOptions {
  filters: InboxFilters
  /** Current admin id — used both as a queryKey segment AND as the
   *  `assignedTo` value when tab='mine'. */
  agentId: string
  enabled?: boolean
}

export function useInboxConversations({ filters, agentId, enabled = true }: UseInboxOptions) {
  // Translate the tab into concrete server filters. `closed` overrides
  // the default OPEN status; the other tabs inherit whatever status the
  // page passed in (typically 'OPEN').
  const serverFilters: InboxFilters = (() => {
    if (filters.tab === 'mine') return { ...filters, assignedTo: agentId }
    if (filters.tab === 'unassigned') return { ...filters, unassignedOnly: true }
    if (filters.tab === 'closed') return { ...filters, status: 'CLOSED' }
    return filters
  })()

  return useQuery({
    queryKey: inboxQueryKey(filters, agentId),
    queryFn: () => chatInboxRepository.list(serverFilters, 50, 0),
    enabled,
    refetchInterval: 15_000,
    staleTime: 5_000,
  })
}
