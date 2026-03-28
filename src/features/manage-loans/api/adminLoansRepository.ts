import { apiClient } from '@/shared/api/client'
import type { Loan, DashboardStats } from '@/entities/loan'
import type { AdminUser } from '@/entities/user'

export interface RestructureResult {
  loanId: string
  restructureCount: number
  newPrincipal: number
  newInstallmentAmount: number
  newNumInstallments: number
  newDueDate: string
  capitalizedDebt: number
  message: string
}

export const adminLoansRepository = {
  async getDashboardStats(): Promise<DashboardStats> {
    const { data } = await apiClient.get('/admin/stats')
    return data.data
  },
  async getPendingLoans(): Promise<Loan[]> {
    const { data } = await apiClient.get('/admin/loans/pending')
    return data.data
  },
  async getAllLoans(): Promise<Loan[]> {
    const { data } = await apiClient.get('/admin/loans')
    return data.data
  },
  async getOverdueLoans(): Promise<Loan[]> {
    const { data } = await apiClient.get('/admin/loans/overdue')
    return data.data
  },
  async approveLoan(loanId: string): Promise<Loan> {
    const { data } = await apiClient.post(`/admin/loans/${loanId}/approve`)
    return data.data
  },
  async rejectLoan(loanId: string, reason: string): Promise<Loan> {
    const { data } = await apiClient.post(`/admin/loans/${loanId}/reject`, { reason })
    return data.data
  },
  async disburseLoan(loanId: string): Promise<Loan> {
    const { data } = await apiClient.post(`/admin/loans/${loanId}/disburse`)
    return data.data
  },
  async restructureLoan(loanId: string, newNumInstallments?: number): Promise<RestructureResult> {
    const { data } = await apiClient.post(`/loans/${loanId}/restructure`, { newNumInstallments })
    return data.data
  },
}

export const adminUsersRepository = {
  async getAll(): Promise<AdminUser[]> {
    const { data } = await apiClient.get('/admin/users')
    return data.data
  },
  async suspend(userId: string): Promise<AdminUser> {
    const { data } = await apiClient.post(`/admin/users/${userId}/suspend`)
    return data.data
  },
}
