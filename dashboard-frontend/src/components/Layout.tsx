import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Gauge, ListFilter, LogOut, ScrollText, Shield } from 'lucide-react'
import { setToken } from '../api'

const nav = [
  { to: '/', label: 'Deal', icon: Gauge },
  { to: '/risk-register', label: 'Risks', icon: ListFilter },
  { to: '/audit-trail', label: 'Trail', icon: ScrollText },
]

export default function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen gap-5 p-5">
      <aside className="sticky top-5 flex h-[calc(100vh-2.5rem)] w-[78px] shrink-0 flex-col items-center rounded-[28px] bg-card py-5"
        style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
          <Shield size={19} strokeWidth={2.1} />
        </div>

        <nav className="mt-8 flex flex-col gap-2">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} title={label}
              className={({ isActive }) =>
                `flex h-[52px] w-[52px] flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-200 ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-sunk hover:text-ink'
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span className="text-[9.5px] font-medium tracking-wide">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sunk text-[13px] font-medium text-ink"
            title="Maya Chen · reviewer of record">MC</div>
          <button onClick={() => { setToken(null); navigate('/login') }} title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-3 transition-colors hover:bg-sunk hover:text-ink">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
