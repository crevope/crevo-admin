import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, Loader2, ExternalLink, Download } from 'lucide-react'
import { adminLoansRepository } from '@/features/manage-loans/api/adminLoansRepository'
import { LoanStatusBadge } from '@/entities/loan'
import { Card, CardContent } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/table'
import { formatCurrency, formatDate, exportToCsv } from '@/shared/lib/utils'

const PAGE_SIZE = 20

export function AllLoansPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const { data: loans = [], isLoading } = useQuery({
    queryKey: ['admin', 'loans', 'all'],
    queryFn: adminLoansRepository.getAllLoans,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return loans
    const q = search.toLowerCase()
    return loans.filter(l =>
      l.user?.firstName?.toLowerCase().includes(q) ||
      l.user?.lastName?.toLowerCase().includes(q) ||
      l.user?.email?.toLowerCase().includes(q) ||
      l.status.toLowerCase().includes(q)
    )
  }, [loans, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleDisburse = async (loanId: string) => {
    setActionLoading(loanId)
    try {
      await adminLoansRepository.disburseLoan(loanId)
      toast.success('Préstamo desembolsado')
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    } catch {
      toast.error('Error al desembolsar')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Todos los Préstamos</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{filtered.length} préstamos</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportToCsv('prestamos.csv', filtered.map(l => ({
              id: l.id,
              nombre: `${l.user?.firstName ?? ''} ${l.user?.lastName ?? ''}`.trim(),
              email: l.user?.email ?? '',
              dni: l.user?.dni ?? '',
              monto: l.amount,
              total: l.totalAmount,
              estado: l.status,
              plazo_dias: l.termDays,
              vencimiento: l.dueDate ?? '',
              creado: l.createdAt,
            })))}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : paginated.length === 0 ? (
            <p className="text-center text-muted-foreground py-16">No se encontraron préstamos</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Plazo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell>
                      <p className="font-medium text-sm">{loan.user?.firstName} {loan.user?.lastName}</p>
                      <p className="text-xs text-muted-foreground">{loan.user?.email}</p>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(loan.amount)}</TableCell>
                    <TableCell>{formatCurrency(loan.totalAmount)}</TableCell>
                    <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                    <TableCell>{loan.termDays}d</TableCell>
                    <TableCell className="text-sm">{formatDate(loan.createdAt)}</TableCell>
                    <TableCell className="text-sm">{loan.dueDate ? formatDate(loan.dueDate) : '—'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {loan.status === 'SIGNED' && (
                          <Button size="sm" onClick={() => handleDisburse(loan.id)} disabled={!!actionLoading}>
                            {actionLoading === loan.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Desembolsar
                          </Button>
                        )}
                        {loan.contractUrl && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={loan.contractUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}>Anterior</Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Siguiente</Button>
        </div>
      )}
    </div>
  )
}
