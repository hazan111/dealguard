import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutList, ShieldAlert, ScrollText, LogOut, Shield } from 'lucide-react'
import { setToken } from '../api'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutList },
  { to: '/risk-register', label: 'Risk register', icon: ShieldAlert },
  { to: '/audit-trail', label: 'Audit trail', icon: ScrollText },
]

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[220px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex items-center gap-2 px-4 pt-5 pb-4">
          <Shield size={18} strokeWidth={2.2} className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">DealGuard</span>
        </div>

        <div className="mx-4 mb-4 rounded-md border border-line bg-raised px-3 py-2.5">
          <div className="t-label">Deal</div>
          <div className="mt-0.5 text-[13px] font-medium leading-5">Project Kestrel</div>
          <div className="t-meta leading-4">Solvane Search Partners → Kestrel Robotics</div>
        </div>

        <nav className="flex flex-col gap-0.5 px-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-150 ${
                  isActive ? 'bg-accent-soft font-medium text-accent' : 'text-ink-2 hover:bg-raised hover:text-ink'
                }`
              }
            >
              <Icon size={15} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto px-2 pb-3">
          <div className="mx-2.5 mb-2 border-t border-line pt-3">
            <div className="text-[13px] font-medium">Maya Chen</div>
            <div className="t-meta">Searcher · reviewer of record</div>
          </div>
          <button
            onClick={() => { setToken(null); navigate('/login') }}
            className="btn btn-ghost h-8 w-full justify-start px-2.5"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
