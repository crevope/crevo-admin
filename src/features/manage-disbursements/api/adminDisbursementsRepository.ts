import { apiClient } from '@/shared/api/client'

export interface Disbursement {
  id: string
  loanId: string
  userId: string
  amount: number
  currency: string
  provider: string
  status: DisbursementStatus
  externalRef?: string
  failureReason?: string
  confirmedAt?: string
  createdAt: string
  updatedAt: string
  loan?: {
    id: string
    amount: number
    user?: {
      firstName: string
      lastName: string
      email: string
      dni: string
    }
  }
}

export type DisbursementStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'CONFIRMED' | 'FAILED'

export const adminDisbursementsRepository = {
  async getPending(): Promise<Disbursement[]> {
    const { data } = await apiClient.get('/disbursements/pending')
    return data.data
  },
  async confirm(disbursementId: string, confirmedBy?: string): Promise<Disbursement> {
    const { data } = await apiClient.post(`/disbursements/${disbursementId}/confirm`, { confirmedBy })
    return data.data
  },
  async retry(disbursementId: string): Promise<Disbursement> {
    const { data } = await apiClient.post(`/disbursements/${disbursementId}/retry`)
    return data.data
  },
}
