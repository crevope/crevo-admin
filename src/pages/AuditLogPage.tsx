import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ShieldCheck } from 'lucide-react'
import {
  adminAuditRepository,
  type AuditEntityType,
} from '@/features/manage-audit/api/adminAuditRepository'
import { Card, CardContent } from '@/shared/ui/card'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Badge } from '@/shared/ui/badge'
import { Skeleton } from '@/shared/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/ui/table'
import { formatDateTime } from '@/shared/lib/utils'

const ENTITY_TYPES: AuditEntityType[] = ['LOAN', 'PAYMENT', 'USER', 'DISBURSEMENT', 'CREDIT_SCORE']

const ACTION_COLORS: Record<string, string> = {
  LOAN_APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  LOAN_REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  LOAN_RESTRUCTURED: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  DISBURSEMENT_INITIATED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DISBURSEMENT_CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  DISBURSEMENT_FAILED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  PAYMENT_REGISTERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  PAYMENT_PARTIAL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  PAYMENT_EARLY_PAYOFF: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  USER_SUSPENDED: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  USER_REGISTERED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

const ROLE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline'> = {
  ADMIN: 'default',
  USER: 'secondary',
  SYSTEM: 'outline',
}

type SearchMode = 'entity' | 'action'

export function AuditLogPage() {
  const [mode, setMode] = useState<SearchMode>('entity')
  const [entityType, setEntityType] = useState<AuditEntityType>('LOAN')
  const [entityId, setEntityId] = useState('')
  const [action, setAction] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const isEntityMode = mode === 'entity'
  const queryKey = isEntityMode
    ? ['admin', 'audit', 'entity', entityType, entityId]
    : ['admin', 'audit', 'action', action]

  const { data: entries = [], isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () =>
      isEntityMode
        ? adminAuditRepository.getByEntity(entityType, entityId)
        : adminAuditRepository.getByAction(action),
    enabled: submitted && (isEntityMode ? !!entityId.trim() : !!action.trim()),
  })

  const handleSearch = () => {
    setSubmitted(true)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Historial de Auditoría</h1>

      {/* Search form */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === 'entity' ? 'default' : 'outline'}
              onClick={() => { setMode('entity'); setSubmitted(false) }}
            >
              Por entidad
            </Button>
            <Button
              size="sm"
              variant={mode === 'action' ? 'default' : 'outline'}
              onClick={() => { setMode('action'); setSubmitted(false) }}
            >
              Por acción
            </Button>
          </div>

          {mode === 'entity' ? (
            <div className="flex gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Tipo de entidad</Label>
                <select
                  value={entityType}
                  onChange={e => setEntityType(e.target.value as AuditEntityType)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {ENTITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1 space-y-1.5">
                <Label>ID de la entidad</Label>
                <Input
                  placeholder="UUID del préstamo, pago, usuario..."
                  value={entityId}
                  onChange={e => setEntityId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={!entityId.trim()}>
                <Search className="h-4 w-4 mr-1" />
                Buscar
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1.5">
                <Label>Acción</Label>
                <Input
                  placeholder="LOAN_APPROVED, PAYMENT_REGISTERED, USER_SUSPENDED..."
                  value={action}
                  onChange={e => setAction(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button onClick={handleSearch} disabled={!action.trim()}>
                <Search className="h-4 w-4 mr-1" />
                Buscar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {submitted && (
        <Card>
          <CardContent className="p-0">
            {isLoading || isFetching ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : entries.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Sin eventos encontrados</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[entry.action] ?? 'bg-muted text-muted-foreground'}`}>
                          {entry.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {entry.actorId ? entry.actorId.slice(0, 8) + '…' : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ROLE_VARIANTS[entry.actorRole] ?? 'outline'} className="text-xs">
                          {entry.actorRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        <span className="font-medium text-foreground">{entry.entityType}</span>
                        {' '}
                        {entry.entityId.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {entry.metadata ? (
                          <pre className="text-xs text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                            {JSON.stringify(entry.metadata)}
                          </pre>
                        ) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
