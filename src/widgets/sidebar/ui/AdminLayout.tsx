import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Clock, List, AlertTriangle,
  Users, UserRound, Menu, LogOut, SlidersHorizontal, Banknote, ShieldCheck,
  ClipboardList, Zap, Headphones,
} from 'lucide-react'
import { useAdminAuthStore } from '@/features/admin-auth'
import { WorkQueueBadge } from '@/features/manage-work-queue'
import { ChatUnreadBadge, useChatInboxAlerts } from '@/features/chat-inbox'
import { ThemeToggle } from '@/shared/ui/theme-toggle'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/lib/utils'

interface NavItem {
  to: string
  icon: typeof LayoutDashboard
  label: string
  badge?: React.ComponentType<{ className?: string }>
  group?: 'main' | 'ops' | 'platform'
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', group: 'main' },

  { to: '/loans/pending', icon: Clock, label: 'Pendientes', group: 'ops' },
  { to: '/loans/all', icon: List, label: 'Todos los préstamos', group: 'ops' },
  { to: '/loans/overdue', icon: AlertTriangle, label: 'En mora', group: 'ops' },
  { to: '/disbursements', icon: Banknote, label: 'Desembolsos', group: 'ops' },

  { to: '/customers', icon: UserRound, label: 'Clientes', group: 'platform' },
  { to: '/work-queue', icon: ClipboardList, label: 'Cola de trabajo', badge: WorkQueueBadge, group: 'platform' },
  { to: '/chat', icon: Headphones, label: 'Chat soporte', badge: ChatUnreadBadge, group: 'platform' },
  { to: '/users', icon: Users, label: 'Usuarios', group: 'platform' },
  { to: '/audit-log', icon: ShieldCheck, label: 'Auditoría', group: 'platform' },
  { to: '/parameters', icon: SlidersHorizontal, label: 'Parametrías', group: 'platform' },
]

const GROUP_LABELS: Record<NonNullable<NavItem['group']>, string> = {
  main: 'General',
  ops: 'Operación',
  platform: 'Plataforma',
}

export function AdminLayout() {
  const { user, logout } = useAdminAuthStore()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  // App-wide chat alerts: tab-title bump + soft ping when a user message
  // arrives while the agent is on another tab / page. Hooked here (not on
  // ChatInboxPage) so it works even when the agent is browsing a customer
  // profile, the work queue, etc.
  useChatInboxAlerts()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Group items for visual organization in the sidebar
  const grouped = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const key = item.group ?? 'main'
    acc[key] = acc[key] ?? []
    acc[key].push(item)
    return acc
  }, {})

  const initials = user
    ? `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`.toUpperCase()
    : 'A'

  const SidebarContent = () => (
    <div className="flex flex-col h-full text-white">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-secondary to-brand-secondary-hover flex items-center justify-center shrink-0 glow-gold">
            <Zap className="h-4.5 w-4.5 text-brand-primary" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Crevo</p>
            <p className="text-[10px] text-white/50 tracking-wider uppercase">Admin Panel</p>
          </div>
        </div>
      </div>

      {/* User card */}
      {user && (
        <div className="mx-3 mb-4 p-3 rounded-lg bg-white/5 border border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-secondary to-brand-secondary-hover flex items-center justify-center text-brand-primary text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/40 uppercase tracking-wider">Conectado</p>
            <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-3 space-y-5 overflow-y-auto">
        {(Object.entries(grouped) as Array<[NonNullable<NavItem['group']>, NavItem[]]>).map(([group, items]) => (
          <div key={group} className="space-y-0.5">
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {GROUP_LABELS[group]}
            </p>
            {items.map(({ to, icon: Icon, label, badge: BadgeComp }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
                  isActive
                    ? 'bg-brand-accent/10 text-brand-accent font-medium border border-brand-accent/20'
                    : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent',
                )}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors',
                        isActive ? 'text-brand-accent' : 'text-white/40 group-hover:text-white',
                      )}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {BadgeComp && <BadgeComp />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom: theme + logout */}
      <div className="px-3 pb-4 pt-3 border-t border-white/5 space-y-1">
        <div className="px-1 flex items-center justify-between">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="h-8 gap-2 text-white/60 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="text-xs">Salir</span>
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-default"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />
          <aside className="relative w-64 flex flex-col bg-sidebar border-r border-sidebar-border">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar text-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-secondary to-brand-secondary-hover flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-brand-primary" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold">Crevo Admin</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="text-white hover:text-white hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1366px] mx-auto p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
