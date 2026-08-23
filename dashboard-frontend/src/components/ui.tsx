import type { ReactNode } from 'react'

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-open/10 text-open border-open/30',
    needs_review: 'bg-review/15 text-ink-secondary border-review/40',
    under_review: 'bg-review/15 text-ink-secondary border-review/40',
    resolved: 'bg-resolved/10 text-resolved border-resolved/30',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.needs_review}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    high: 'bg-open text-white',
    medium: 'bg-accent text-white',
    low: 'bg-review text-white',
  }
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${styles[severity] ?? styles.low}`}>
      {severity}
    </span>
  )
}

export function DomainBadge({ domain }: { domain: string }) {
  const labels: Record<string, string> = { legal: 'Legal', financial: 'Financial', hr: 'HR/Comp', ip: 'IP' }
  return (
    <span className="inline-flex items-center rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink">
      {labels[domain] ?? domain}
    </span>
  )
}

export function SummaryTile({ label, value, icon, alert }: {
  label: string; value: number | string; icon: ReactNode; alert?: boolean
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-secondary">{label}</span>
        <span className={alert ? 'text-open' : 'text-ink-secondary'}>{icon}</span>
      </div>
      <div className={`mt-2 text-3xl font-semibold ${alert ? 'text-open' : 'text-ink'}`}>{value}</div>
    </div>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled }: {
  children: ReactNode; onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean
}) {
  const styles = {
    primary: 'bg-accent hover:bg-accent-hover text-white',
    secondary: 'border border-line bg-white hover:bg-surface text-ink',
    danger: 'bg-resolved hover:brightness-95 text-white',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  )
}
