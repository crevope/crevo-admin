import { Routes, Route, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminLayout } from '@/widgets/sidebar'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PendingLoansPage } from '@/pages/PendingLoansPage'
import { AllLoansPage } from '@/pages/AllLoansPage'
import { OverdueLoansPage } from '@/pages/OverdueLoansPage'
import { DisbursementsPage } from '@/pages/DisbursementsPage'
import { UsersPage } from '@/pages/UsersPage'
import { AuditLogPage } from '@/pages/AuditLogPage'
import { ParametersPage } from '@/pages/ParametersPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="loans/pending" element={<PendingLoansPage />} />
        <Route path="loans/all" element={<AllLoansPage />} />
        <Route path="loans/overdue" element={<OverdueLoansPage />} />
        <Route path="disbursements" element={<DisbursementsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="parameters" element={<ParametersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
