import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShieldAlert, ScrollText, LogOut, Shield } from 'lucide-react'
import { setToken } from '../api'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/risk-register', label: 'Risk Register', icon: ShieldAlert },
  { to: '/audit-trail', label: 'Audit Trail', icon: ScrollText },
]

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col bg-sidebar text-sidebar-text">
        <div className="flex items-center gap-2 px-5 py-5">
          <Shield size={22} className="text-accent" />
          <span className="text-base font-semibold text-white">DealGuard</span>
        </div>
        <div className="px-5 pb-4 text-xs text-sidebar-text/70">
          Project Kestrel · Solvane Search Partners
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => { setToken(null); navigate('/login') }}
          className="mx-3 mb-4 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium hover:bg-white/5 hover:text-white"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </aside>
      <main className="flex-1 bg-surface">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
