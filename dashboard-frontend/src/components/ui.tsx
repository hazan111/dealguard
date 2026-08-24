import type { ReactNode } from 'react'

export const domainMeta: Record<string, { label: string; color: string; soft: string }> = {
  legal: { label: 'Legal', color: 'var(--color-legal)', soft: 'oklch(0.94 0.025 275)' },
  financial: { label: 'Financial', color: 'var(--color-financial)', soft: 'oklch(0.955 0.040 80)' },
  hr: { label: 'HR / Comp', color: 'var(--color-hr)', soft: 'oklch(0.950 0.028 155)' },
  ip: { label: 'IP', color: 'var(--color-ip)', soft: 'oklch(0.945 0.030 340)' },
  unclassified: { label: 'Unclassified', color: 'var(--color-ink-3)', soft: 'var(--color-sunk)' },
}

export function SeverityChip({ severity }: { severity: string }) {
  const s: Record<string, string> = {
    high: 'bg-high-soft text-high',
    medium: 'bg-med-soft text-med',
    low: 'bg-low-soft text-ink-2',
  }
  return <span className={`chip ${s[severity] ?? s.low}`}><span className="dot" />{severity}</span>
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: 'bg-sunk text-ink-2', label: 'Open' },
    needs_review: { cls: 'bg-med-soft text-med', label: 'Needs review' },
    under_review: { cls: 'bg-med-soft text-med', label: 'Under review' },
    resolved: { cls: 'bg-ok-soft text-ok', label: 'Resolved' },
  }
  const s = map[status] ?? map.open
  return <span className={`chip ${s.cls}`}>{s.label}</span>
}

export function DomainChip({ domain }: { domain: string }) {
  const m = domainMeta[domain] ?? domainMeta.unclassified
  return (
    <span className="chip" style={{ background: m.soft, color: m.color }}>
      <span className="dot" />{m.label}
    </span>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', title }: {
  children: ReactNode; onClick?: () => void
  variant?: 'primary' | 'soft' | 'ok' | 'quiet'; disabled?: boolean
  type?: 'button' | 'submit'; title?: string
}) {
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}

export function CardHead({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="label">{title}</h2>
        {hint && <p className="mt-1.5 text-[12.5px] leading-4 text-ink-3">{hint}</p>}
      </div>
      {right}
    </div>
  )
}

export function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function dateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
