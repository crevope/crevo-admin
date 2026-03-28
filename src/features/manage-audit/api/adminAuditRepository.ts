import { apiClient } from '@/shared/api/client'

export interface AuditLogEntry {
  id: string
  actorId?: string
  actorRole: 'USER' | 'ADMIN' | 'SYSTEM'
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export type AuditEntityType = 'LOAN' | 'PAYMENT' | 'USER' | 'DISBURSEMENT' | 'CREDIT_SCORE'

export const adminAuditRepository = {
  async getByEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLogEntry[]> {
    const { data } = await apiClient.get('/admin/audit-log', {
      params: { entityType, entityId },
    })
    return data.data
  },
  async getByAction(action: string): Promise<AuditLogEntry[]> {
    const { data } = await apiClient.get('/admin/audit-log', {
      params: { action },
    })
    return data.data
  },
}
