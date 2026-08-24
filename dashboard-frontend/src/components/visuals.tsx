import { useMemo } from 'react'
import { Ban, FileText, Link2 } from 'lucide-react'
import type { DocumentRecord, Finding } from '../api'
import { timeShort } from './ui'

/* ---------- Severity gauge: segmented half-circle, status in the middle, number outside ---------- */

export function SeverityGauge({ findings }: { findings: Finding[] }) {
  const open = findings.filter(f => f.status !== 'resolved')
  const high = open.filter(f => f.severity === 'high').length
  const medium = open.filter(f => f.severity === 'medium').length
  const low = open.filter(f => f.severity === 'low').length
  const total = open.length

  const status = high >= 3 ? 'Elevated' : high > 0 ? 'Attention' : medium > 0 ? 'Watch' : 'Clear'
  const statusColor = high > 0 ? 'text-sev-high' : medium > 0 ? 'text-sev-med' : 'text-ok'

  // 12 slices across 180°, each slice colored by severity in order high → medium → low.
  const slices = 12
  const share = (n: number) => total ? Math.round((n / total) * slices) : 0
  let hi = share(high), md = share(medium)
  let lo = Math.max(0, slices - hi - md)
  if (total && hi + md + lo !== slices) lo = slices - hi - md
  const colors = [
    ...Array(hi).fill('var(--color-sev-high)'),
    ...Array(md).fill('var(--color-sev-med)'),
    ...Array(lo).fill(total ? 'var(--color-sev-low)' : 'var(--color-line)'),
  ]

  const cx = 90, cy = 88, rOuter = 82, rInner = 66, gapDeg = 3
  const step = 180 / slices
  const arc = (start: number, end: number) => {
    const s = ((180 + start) * Math.PI) / 180, e = ((180 + end) * Math.PI) / 180
    const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`
    return `M ${p(rOuter, s)} A ${rOuter} ${rOuter} 0 0 1 ${p(rOuter, e)} L ${p(rInner, e)} A ${rInner} ${rInner} 0 0 0 ${p(rInner, s)} Z`
  }

  return (
    <div className="flex items-end gap-5">
      <div className="relative">
        <svg width="180" height="96" viewBox="0 0 180 96" aria-label={`${total} open risks, ${high} high`}>
          {colors.map((c, i) => (
            <path key={i} d={arc(i * step + gapDeg / 2, (i + 1) * step - gapDeg / 2)} fill={c} />
          ))}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <div className={`text-[13px] font-semibold uppercase tracking-[0.08em] ${statusColor}`}>{status}</div>
        </div>
      </div>
      <div className="pb-1">
        <div className="text-[28px] font-semibold leading-8 tracking-tight">{total}</div>
        <div className="t-label">open risks</div>
        <div className="mt-2 flex flex-col gap-0.5 text-[12px] text-ink-2">
          <span><b className="text-sev-high">{high}</b> high</span>
          <span><b className="text-sev-med">{medium}</b> medium</span>
          <span><b className="text-ink">{low}</b> low</span>
        </div>
      </div>
    </div>
  )
}

/* ---------- Data room strip: one tile per document, blocked ones in red ---------- */

const domainLabel: Record<string, string> = { legal: 'Legal', financial: 'Financial', hr: 'HR / Comp', ip: 'IP', unclassified: 'Unclassified' }

export function DataRoomStrip({ documents }: { documents: DocumentRecord[] }) {
  if (documents.length === 0) {
    return <p className="t-meta">The data room is empty. Files dropped into the Drive folder appear here as they are read.</p>
  }
  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
      {documents.map(d => {
        const blocked = d.model_armor_verdict === 'blocked'
        return (
          <div
            key={d.id}
            className={`flex min-h-[124px] flex-col rounded-lg border p-3.5 ${
              blocked ? 'border-sev-high/30 bg-sev-high-soft' : 'border-line bg-raised'
            }`}
          >
            <div className="flex items-start justify-between">
              {blocked ? <Ban size={18} className="text-sev-high" /> : <FileText size={18} className="text-ink-3" />}
              <span className="t-mono text-ink-3">{timeShort(d.ingested_at)}</span>
            </div>
            <div className="mt-auto">
              <div className="t-mono truncate text-ink" title={d.name}>{d.name.replace(/\.pdf$/, '')}</div>
              <div className="mt-1 flex items-center justify-between text-[12px]">
                <span className="text-ink-2">{blocked ? 'Model Armor' : domainLabel[d.category] ?? d.category}</span>
                <span className={blocked ? 'font-medium text-sev-high' : 'font-medium text-ink'}>
                  {blocked ? 'Blocked' : `${d.finding_count} finding${d.finding_count === 1 ? '' : 's'}`}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- Risk clusters: findings connected across domains through a shared entity ---------- */

interface Cluster { label: string; members: Finding[] }

function buildClusters(findings: Finding[]): Cluster[] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  const union = (a: string, b: string) => { parent.set(find(a), find(b)) }
  const ids = new Set(findings.map(f => f.id))
  for (const f of findings) for (const o of f.cross_referenced_finding_ids) if (ids.has(o)) union(f.id, o)

  const groups = new Map<string, Finding[]>()
  for (const f of findings) {
    const r = find(f.id)
    groups.set(r, [...(groups.get(r) ?? []), f])
  }
  const clusters: Cluster[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const tally = new Map<string, number>()
    for (const m of members) for (const e of m.entities ?? []) tally.set(e, (tally.get(e) ?? 0) + 1)
    const label = [...tally.entries()]
      .filter(([e]) => !/kestrel robotics/i.test(e))
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Linked findings'
    clusters.push({ label, members })
  }
  return clusters.sort((a, b) => b.members.length - a.members.length)
}

const domainColor: Record<string, string> = {
  legal: 'var(--color-accent)',
  financial: 'var(--color-sev-med)',
  hr: 'var(--color-ok)',
  ip: 'var(--color-sev-high)',
}

export function RiskClusters({ findings, onSelect }: { findings: Finding[]; onSelect: (id: string) => void }) {
  const clusters = useMemo(() => buildClusters(findings), [findings])
  if (clusters.length === 0) {
    return <p className="t-meta">No cross-domain links yet. They appear when two documents point at the same customer, person, or asset.</p>
  }
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {clusters.slice(0, 4).map(c => {
        const domains = [...new Set(c.members.map(m => m.domain))]
        const worst = c.members.some(m => m.severity === 'high') ? 'high' : c.members.some(m => m.severity === 'medium') ? 'medium' : 'low'
        const n = c.members.length
        const w = 320, h = 78, cx = w / 2, cy = 18, rowY = 62
        const xs = c.members.map((_, i) => (n === 1 ? cx : 24 + (i * (w - 48)) / (n - 1)))
        return (
          <div key={c.label} className="rounded-lg border border-line bg-raised p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[14px] font-semibold tracking-tight">{c.label}</div>
              <div className="t-meta inline-flex items-center gap-1"><Link2 size={12} /> {n} findings · {domains.length} domains</div>
            </div>
            <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="mt-2 block" aria-hidden="true">
              {xs.map((x, i) => (
                <path key={i} d={`M ${cx} ${cy + 9} C ${cx} ${rowY - 26}, ${x} ${cy + 20}, ${x} ${rowY - 8}`}
                  fill="none" stroke="var(--color-line-strong)" strokeWidth="1.25" />
              ))}
              <circle cx={cx} cy={cy} r="9" fill={worst === 'high' ? 'var(--color-sev-high)' : worst === 'medium' ? 'var(--color-sev-med)' : 'var(--color-sev-low)'} />
              <circle cx={cx} cy={cy} r="4" fill="var(--color-raised)" />
              {c.members.map((m, i) => (
                <g key={m.id} onClick={() => onSelect(m.id)} className="cursor-pointer">
                  <circle cx={xs[i]} cy={rowY - 8} r="6" fill={domainColor[m.domain] ?? 'var(--color-ink-3)'} />
                  <text x={xs[i]} y={rowY + 8} textAnchor="middle" fontSize="9.5" fontWeight="500" fill="var(--color-ink-2)"
                    style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {m.domain}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        )
      })}
    </div>
  )
}
