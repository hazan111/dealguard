import { useMemo } from 'react'
import { FileText, ShieldOff } from 'lucide-react'
import type { DocumentRecord, Finding } from '../api'
import { domainMeta, timeShort } from './ui'

const TAU = Math.PI * 2
const rad = (deg: number) => (deg * Math.PI) / 180

const sevColor: Record<string, string> = {
  high: 'var(--color-high)',
  medium: 'var(--color-med)',
  low: 'var(--color-low)',
}

/* Arc path along a circle, drawn as a stroked line (round caps do the rest). */
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))]
  const p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))]
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0
  return `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]}`
}

/* ---------------- Exposure arc: the hero. Severity mix of everything still open. ---------------- */

export function ExposureArc({ findings }: { findings: Finding[] }) {
  const open = findings.filter(f => f.status !== 'resolved')
  const counts = {
    high: open.filter(f => f.severity === 'high').length,
    medium: open.filter(f => f.severity === 'medium').length,
    low: open.filter(f => f.severity === 'low').length,
  }
  const total = open.length
  const state = counts.high >= 3 ? 'Elevated' : counts.high > 0 ? 'Attention' : counts.medium > 0 ? 'Watch' : 'Clear'
  const stateColor = counts.high > 0 ? 'var(--color-high)' : counts.medium > 0 ? 'var(--color-med)' : 'var(--color-ok)'

  const cx = 150, cy = 150, r = 116, sw = 30, gap = 3.2
  const segments: { a0: number; a1: number; color: string }[] = []
  let cursor = 180
  const order: (keyof typeof counts)[] = ['high', 'medium', 'low']
  for (const key of order) {
    if (!counts[key] || !total) continue
    const span = (counts[key] / total) * 180
    segments.push({ a0: cursor + gap / 2, a1: cursor + span - gap / 2, color: sevColor[key] })
    cursor += span
  }

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 300 172" className="w-full max-w-[300px]" role="img"
        aria-label={`${total} open risks, ${counts.high} high severity, status ${state}`}>
        <path d={arcPath(cx, cy, r, 180, 360)} stroke="var(--color-sunk)" strokeWidth={sw} strokeLinecap="round" fill="none" />
        {segments.map((s, i) => (
          <path key={i} d={arcPath(cx, cy, r, s.a0, s.a1)} stroke={s.color} strokeWidth={sw} strokeLinecap="round" fill="none" />
        ))}
        <text x={cx} y={cy - 34} textAnchor="middle" className="display" fill="var(--color-ink)"
          fontSize="62" fontWeight="500">{total}</text>
        <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--color-ink-3)"
          fontSize="10.5" fontWeight="500" letterSpacing="1.3">OPEN RISKS</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fill={stateColor} fontSize="15" fontWeight="500">{state}</text>
      </svg>
      <div className="-mt-1 flex items-center gap-5">
        {order.map(key => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: sevColor[key] }} />
            <span className="text-[12.5px] text-ink-2"><b className="font-medium text-ink">{counts[key]}</b> {key}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Donut: which department the findings landed in ---------------- */

export function DomainDonut({ findings }: { findings: Finding[] }) {
  const domains = ['legal', 'financial', 'hr', 'ip']
  const counts = domains.map(d => ({ d, n: findings.filter(f => f.domain === d).length }))
  const total = counts.reduce((s, c) => s + c.n, 0)

  const cx = 90, cy = 90, r = 64, sw = 22, gap = 5
  const segs: { a0: number; a1: number; color: string }[] = []
  let cursor = -90
  for (const { d, n } of counts) {
    if (!n) continue
    const span = (n / total) * 360
    segs.push({ a0: cursor + gap / 2, a1: cursor + span - gap / 2, color: domainMeta[d].color })
    cursor += span
  }

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 180 180" className="h-[168px] w-[168px] shrink-0" role="img" aria-label="Findings by domain">
        <circle cx={cx} cy={cy} r={r} stroke="var(--color-sunk)" strokeWidth={sw} fill="none" />
        {segs.map((s, i) => (
          <path key={i} d={arcPath(cx, cy, r, s.a0, s.a1)} stroke={s.color} strokeWidth={sw} strokeLinecap="round" fill="none" />
        ))}
        <text x={cx} y={cy + 4} textAnchor="middle" className="display" fill="var(--color-ink)" fontSize="36" fontWeight="500">{total}</text>
        <text x={cx} y={cy + 22} textAnchor="middle" fill="var(--color-ink-3)" fontSize="9.5" fontWeight="500" letterSpacing="1.2">FINDINGS</text>
      </svg>
      <ul className="flex min-w-0 flex-col gap-3">
        {counts.map(({ d, n }) => (
          <li key={d} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: domainMeta[d].color }} />
            <span className="text-[13px] text-ink-2">{domainMeta[d].label}</span>
            <span className="ml-auto text-[13px] font-medium">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------------- Evidence bars: is each finding's citation verified in the source? ---------------- */

export function EvidenceBars({ findings }: { findings: Finding[] }) {
  const domains = ['legal', 'financial', 'hr', 'ip']
  return (
    <ul className="flex flex-col gap-4">
      {domains.map(d => {
        const items = findings.filter(f => f.domain === d)
        const verified = items.filter(f => f.citation_verified).length
        return (
          <li key={d}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[13px] text-ink-2">{domainMeta[d].label}</span>
              <span className="text-[12px] text-ink-3">
                {items.length === 0 ? 'no findings' : <><b className="font-medium text-ink">{verified}</b> of {items.length} quoted verbatim</>}
              </span>
            </div>
            <div className="flex h-[7px] gap-1">
              {items.length === 0
                ? <span className="flex-1 rounded-full bg-sunk" />
                : items.map(f => (
                  <span key={f.id} className="flex-1 rounded-full"
                    style={{ background: f.citation_verified ? domainMeta[d].color : 'var(--color-med)' }}
                    title={f.citation_verified ? 'Quote found in source' : 'Quote not found — routed to review'} />
                ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------------- Data room: one tile per document ---------------- */

export function DataRoom({ documents }: { documents: DocumentRecord[] }) {
  if (documents.length === 0) {
    return <p className="text-[13px] text-ink-3">Empty. Files dropped into the Drive folder land here as the agents read them.</p>
  }
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {documents.map(d => {
        const blocked = d.model_armor_verdict === 'blocked'
        const m = domainMeta[d.category] ?? domainMeta.unclassified
        return (
          <div key={d.id}
            className={`flex min-h-[130px] w-[168px] shrink-0 flex-col justify-between rounded-[var(--radius-inner)] p-4 ${blocked ? 'bg-high-soft' : 'bg-sunk'}`}>
            <div className="flex items-start justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: blocked ? 'var(--color-high)' : m.soft, color: blocked ? 'white' : m.color }}>
                {blocked ? <ShieldOff size={15} /> : <FileText size={15} />}
              </span>
              <span className="text-[11px] text-ink-3">{timeShort(d.ingested_at)}</span>
            </div>
            <div>
              <p className="line-clamp-2 text-[12.5px] font-medium leading-4" title={d.name}>
                {d.name.replace(/\.pdf$/, '').replace(/_/g, ' ')}
              </p>
              <p className="mt-1.5 text-[12px]" style={{ color: blocked ? 'var(--color-high)' : 'var(--color-ink-3)' }}>
                {blocked ? 'Blocked before reasoning' : `${m.label} · ${d.finding_count} finding${d.finding_count === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Constellation: findings that share an entity, across departments ---------------- */

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
  const ids = new Set(findings.map(f => f.id))
  for (const f of findings)
    for (const o of f.cross_referenced_finding_ids)
      if (ids.has(o)) parent.set(find(f.id), find(o))

  const groups = new Map<string, Finding[]>()
  for (const f of findings) groups.set(find(f.id), [...(groups.get(find(f.id)) ?? []), f])

  const out: Cluster[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const tally = new Map<string, number>()
    for (const m of members) for (const e of m.entities ?? []) tally.set(e, (tally.get(e) ?? 0) + 1)
    const label = [...tally.entries()]
      .filter(([e]) => !/kestrel robotics/i.test(e))
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Linked findings'
    out.push({ label: label.replace(/,? (Inc|Corp|LLC)\.?$/i, ''), members })
  }
  return out.sort((a, b) => b.members.length - a.members.length)
}

export function Constellation({ findings, onSelect }: { findings: Finding[]; onSelect: (id: string) => void }) {
  const clusters = useMemo(() => buildClusters(findings), [findings])
  if (clusters.length === 0) {
    return <p className="text-[13px] text-ink-3">Nothing linked yet. A link appears when two documents from different departments name the same customer, person or asset.</p>
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-6">
      {clusters.slice(0, 2).map(c => {
        const n = c.members.length
        const size = 208, cx = size / 2, cy = size / 2, ring = 74
        const worst = c.members.some(m => m.severity === 'high') ? 'high'
          : c.members.some(m => m.severity === 'medium') ? 'medium' : 'low'
        const pts = c.members.map((_, i) => {
          const a = -TAU / 4 + (i * TAU) / n
          return [cx + ring * Math.cos(a), cy + ring * Math.sin(a)]
        })
        return (
          <div key={c.label} className="flex min-w-0 flex-1 items-center gap-5">
            <svg viewBox={`0 0 ${size} ${size}`} className="h-[172px] w-[172px] shrink-0" role="img"
              aria-label={`${c.label}: ${n} findings linked`}>
              {pts.map(([x, y], i) => (
                <path key={i} d={`M ${cx} ${cy} Q ${(cx + x) / 2 + (y - cy) * 0.16} ${(cy + y) / 2 - (x - cx) * 0.16} ${x} ${y}`}
                  stroke="var(--color-hair)" strokeWidth="1.5" fill="none" />
              ))}
              <circle cx={cx} cy={cy} r="30" fill={sevColor[worst]} opacity="0.09" />
              <circle cx={cx} cy={cy} r="19" fill={sevColor[worst]} />
              <circle cx={cx} cy={cy} r="7" fill="var(--color-card)" />
              {c.members.map((m, i) => (
                <g key={m.id} onClick={() => onSelect(m.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={pts[i][0]} cy={pts[i][1]} r="20" fill={domainMeta[m.domain].soft} />
                  <circle cx={pts[i][0]} cy={pts[i][1]} r="8" fill={domainMeta[m.domain].color} />
                  <title>{m.summary}</title>
                </g>
              ))}
            </svg>
            <div className="min-w-0">
              <p className="display text-[19px] leading-[1.2]">{c.label}</p>
              <p className="mt-1 whitespace-nowrap text-[12.5px] text-ink-3">
                {n} findings · {new Set(c.members.map(m => m.domain)).size} departments
              </p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {[...new Set(c.members.map(m => m.domain))].map(d => (
                  <li key={d} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: domainMeta[d].color }} />
                    <span className="text-[12.5px] text-ink-2">{domainMeta[d].label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}
    </div>
  )
}
