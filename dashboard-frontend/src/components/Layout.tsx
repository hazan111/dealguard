import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronRight, LayoutGrid, ListFilter, LogOut, ScrollText, Shield } from 'lucide-react'
import { api, setToken, type Summary } from '../api'
import { domainMeta } from './ui'

const nav = [
  { to: '/', label: 'Deal overview', icon: LayoutGrid, count: (s: Summary | null) => s?.documents_processed },
  { to: '/risk-register', label: 'Risk register', icon: ListFilter, count: (s: Summary | null) => s?.total_findings },
  { to: '/audit-trail', label: 'Audit trail', icon: ScrollText, count: (s: Summary | null) => s?.timeline_events },
]

const domains = ['legal', 'financial', 'hr', 'ip']

export default function Layout({ children }: { children: ReactNode }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    try { setSummary(await api<Summary>('/api/summary')) } catch { /* page shows its own error state */ }
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 15_000)
    return () => clearInterval(timer)
  }, [refresh])

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[268px] shrink-0 flex-col border-r border-line bg-surface px-4 py-5">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink text-white">
            <Shield size={16} strokeWidth={2.2} />
          </span>
          <span className="tight text-[17px] font-bold">DealGuard</span>
          <span className="ml-auto text-[11px] font-medium text-ink-3">Kestrel</span>
        </div>

        <nav className="mt-7 flex flex-col gap-2">
          {nav.map(({ to, label, icon: Icon, count }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `group flex h-[46px] items-center gap-3 rounded-[12px] border px-3.5 transition-colors duration-200 ${
                  isActive ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:bg-quiet'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} strokeWidth={2} className={isActive ? 'text-white' : 'text-ink-2'} />
                  <span className="text-[13.5px] font-medium">{label}</span>
                  <span className={`ml-auto text-[12.5px] ${isActive ? 'text-white/70' : 'text-ink-3'}`}>
                    {count(summary) ?? '–'}
                  </span>
                  <ChevronRight size={14} className={isActive ? 'text-white/70' : 'text-ink-3'} />
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <p className="label mt-8 px-2">Departments</p>
        <ul className="mt-3 flex flex-col">
          {domains.map(d => (
            <li key={d}>
              <button onClick={() => navigate(`/risk-register?domain=${d}`)}
                className="hoverable flex h-9 w-full items-center gap-2.5 rounded-[9px] px-2 text-left">
                <span className="h-2 w-2 rounded-full" style={{ background: domainMeta[d].color }} />
                <span className="text-[13px]">{domainMeta[d].label}</span>
                <span className="ml-auto text-[12.5px] text-ink-3">{summary?.by_domain?.[d] ?? '–'}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-auto rounded-[12px] border border-line p-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-quiet text-[12px] font-bold">MC</span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">Maya Chen</p>
              <p className="truncate text-[11.5px] text-ink-3">Reviewer of record</p>
            </div>
            <button onClick={() => { setToken(null); navigate('/login') }} title="Sign out"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-[8px] text-ink-3 transition-colors hover:bg-quiet hover:text-ink">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-page">{children}</main>
    </div>
  )
}
