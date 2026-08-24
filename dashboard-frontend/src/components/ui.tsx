import type { ReactNode } from 'react'
import { Fingerprint, LineChart, Scale, Users, type LucideIcon } from 'lucide-react'

/* One glyph per specialist, so a row of findings reads as a row of departments
   before a single word is read. */
export const deptIcon: Record<string, LucideIcon> = {
  legal: Scale,
  financial: LineChart,
  hr: Users,
  ip: Fingerprint,
}

export function DeptGlyph({ domain, size = 38 }: { domain: string; size?: number }) {
  const Icon = deptIcon[domain] ?? Scale
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-[11px] bg-quiet text-ink-2"
      style={{ width: size, height: size }}
      title={domainMeta[domain]?.label ?? domain}
    >
      <Icon size={size * 0.42} strokeWidth={1.9} />
    </span>
  )
}

export function ActionTag({ action }: { action: string }) {
  return <span className="tag border border-line-2 capitalize text-ink-2">{action}</span>
}

export const domainMeta: Record<string, { label: string; color: string; soft: string }> = {
  legal: { label: 'Legal', color: 'var(--color-legal)', soft: 'var(--color-quiet)' },
  financial: { label: 'Financial', color: 'var(--color-financial)', soft: 'var(--color-quiet)' },
  hr: { label: 'HR / Comp', color: 'var(--color-hr)', soft: 'var(--color-quiet)' },
  ip: { label: 'IP', color: 'var(--color-ip)', soft: 'var(--color-quiet)' },
  unclassified: { label: 'Unclassified', color: 'var(--color-ink-3)', soft: 'var(--color-quiet)' },
}

export function SeverityTag({ severity }: { severity: string }) {
  const s: Record<string, string> = {
    high: 'bg-high-soft text-high',
    medium: 'bg-quiet text-ink',
    low: 'bg-quiet text-ink-3',
  }
  return <span className={`tag ${s[severity] ?? s.low}`}><span className="dot" />{severity}</span>
}

export function StatusTag({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: 'border border-line-2 text-ink-2', label: 'Open' },
    needs_review: { cls: 'bg-high-soft text-high', label: 'Needs review' },
    under_review: { cls: 'bg-high-soft text-high', label: 'Under review' },
    resolved: { cls: 'bg-quiet text-ink-2', label: 'Resolved' },
  }
  const s = map[status] ?? map.open
  return <span className={`tag ${s.cls}`}>{s.label}</span>
}

export function DomainTag({ domain }: { domain: string }) {
  const m = domainMeta[domain] ?? domainMeta.unclassified
  return (
    <span className="tag bg-quiet text-ink-2">
      <span className="dot" style={{ background: m.color }} />{m.label}
    </span>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', title }: {
  children: ReactNode; onClick?: () => void
  variant?: 'primary' | 'outline' | 'ok' | 'ghost'; disabled?: boolean
  type?: 'button' | 'submit'; title?: string
}) {
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`btn btn-${variant}`}>
      {children}
    </button>
  )
}

export function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="seg">
      {options.map(o => (
        <button key={o.value} data-on={value === o.value} onClick={() => onChange(o.value)} className="seg-item">
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CellHead({ title, hint, right }: { title: string; hint?: string; right?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="label">{title}</h2>
        {hint && <p className="mt-2 max-w-[46ch] text-[12.5px] leading-[1.5] text-ink-3">{hint}</p>}
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
