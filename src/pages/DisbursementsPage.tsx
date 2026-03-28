import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Banknote, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import {
  adminDisbursementsRepository,
  type Disbursement,
  type DisbursementStatus,
} from '@/features/manage-disbursements/api/adminDisbursementsRepository'
import { Card, CardContent } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Badge } from '@/shared/ui/badge'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/table'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'

const STATUS_LABELS: Record<DisbursementStatus, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'Procesando',
  SENT: 'Enviado',
  CONFIRMED: 'Confirmado',
  FAILED: 'Fallido',
}

const STATUS_VARIANTS: Record<DisbursementStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PENDING: 'secondary',
  PROCESSING: 'outline',
  SENT: 'default',
  CONFIRMED: 'default',
  FAILED: 'destructive',
}

function DisbursementBadge({ status }: { status: DisbursementStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}

export function DisbursementsPage() {
  const queryClient = useQueryClient()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const { data: disbursements = [], isLoading } = useQuery({
    queryKey: ['admin', 'disbursements', 'pending'],
    queryFn: adminDisbursementsRepository.getPending,
    refetchInterval: 30_000,
  })

  const handleConfirm = async (d: Disbursement) => {
    setActionLoading(`confirm-${d.id}`)
    try {
      await adminDisbursementsRepository.confirm(d.id)
      toast.success('Desembolso confirmado')
      queryClient.invalidateQueries({ queryKey: ['admin', 'disbursements'] })
    } catch {
      toast.error('Error al confirmar el desembolso')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRetry = async (d: Disbursement) => {
    setActionLoading(`retry-${d.id}`)
    try {
      await adminDisbursementsRepository.retry(d.id)
      toast.success('Reintento iniciado')
      queryClient.invalidateQueries({ queryKey: ['admin', 'disbursements'] })
    } catch {
      toast.error('Error al reintentar el desembolso')
    } finally {
      setActionLoading(null)
    }
  }

  const pending = disbursements.filter(d => d.status === 'PENDING' || d.status === 'PROCESSING')
  const sent = disbursements.filter(d => d.status === 'SENT')
  const failed = disbursements.filter(d => d.status === 'FAILED')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Desembolsos</h1>
        <div className="flex gap-2 text-sm text-muted-foreground">
          {pending.length > 0 && <span className="font-medium text-amber-600">{pending.length} pendientes</span>}
          {sent.length > 0 && <span className="font-medium text-blue-600">{sent.length} enviados</span>}
          {failed.length > 0 && <span className="font-medium text-destructive">{failed.length} fallidos</span>}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : disbursements.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin desembolsos pendientes</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Préstatario</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disbursements.map(d => {
                  const user = d.loan?.user
                  const isConfirmLoading = actionLoading === `confirm-${d.id}`
                  const isRetryLoading = actionLoading === `retry-${d.id}`
                  return (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className="font-medium text-sm">
                          {user ? `${user.firstName} ${user.lastName}` : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">{user?.email}</p>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(d.amount)}</TableCell>
                      <TableCell className="text-sm capitalize">{d.provider.toLowerCase()}</TableCell>
                      <TableCell><DisbursementBadge status={d.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {d.externalRef ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(d.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {d.status === 'SENT' && (
                            <Button
                              size="sm"
                              onClick={() => handleConfirm(d)}
                              disabled={!!actionLoading}
                            >
                              {isConfirmLoading
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <CheckCircle2 className="h-3 w-3 mr-1" />
                              }
                              Confirmar
                            </Button>
                          )}
                          {d.status === 'FAILED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetry(d)}
                              disabled={!!actionLoading}
                            >
                              {isRetryLoading
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <RefreshCw className="h-3 w-3 mr-1" />
                              }
                              Reintentar
                            </Button>
                          )}
                          {d.failureReason && (
                            <span className="text-xs text-destructive self-center ml-1">{d.failureReason}</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
