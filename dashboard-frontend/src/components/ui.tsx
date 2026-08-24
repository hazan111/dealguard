import type { ReactNode } from 'react'

export function SeverityPill({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    high: 'bg-sev-high-soft text-sev-high',
    medium: 'bg-sev-med-soft text-sev-med',
    low: 'bg-sev-low-soft text-sev-low',
  }
  return (
    <span className={`pill ${styles[severity] ?? styles.low}`}>
      <span className="dot" />
      {severity}
    </span>
  )
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: 'border border-line-strong bg-raised text-ink', label: 'Open' },
    needs_review: { cls: 'bg-warn-soft text-warn', label: 'Needs review' },
    under_review: { cls: 'bg-warn-soft text-warn', label: 'Under review' },
    resolved: { cls: 'bg-ok-soft text-ok', label: 'Resolved' },
  }
  const s = map[status] ?? map.open
  return <span className={`pill ${s.cls}`}>{s.label}</span>
}

const domainLabels: Record<string, string> = { legal: 'Legal', financial: 'Financial', hr: 'HR / Comp', ip: 'IP' }

export function Domain({ domain }: { domain: string }) {
  return <span className="text-[12px] font-medium text-ink-2">{domainLabels[domain] ?? domain}</span>
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ok' | 'ghost'; disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex h-6 items-center justify-between">
      <span className="t-label">{children}</span>
      {right}
    </div>
  )
}

export function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'high' | 'warn' }) {
  const color = tone === 'high' ? 'text-sev-high' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div className="flex flex-col gap-0.5 pr-8">
      <span className="t-label">{label}</span>
      <span className={`text-[20px] font-semibold leading-7 ${color}`}>{value}</span>
    </div>
  )
}

export function timeShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function dateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
