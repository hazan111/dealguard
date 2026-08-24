import { useMemo } from 'react'
import { ArrowUpRight, FileText, ShieldOff } from 'lucide-react'
import type { DocumentRecord, Finding } from '../api'
import { domainMeta, timeShort } from './ui'

const TAU = Math.PI * 2
const rad = (d: number) => (d * Math.PI) / 180

const sevColor: Record<string, string> = {
  high: 'var(--color-high)',
  medium: 'var(--color-med)',
  low: 'var(--color-low)',
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))]
  const p1 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))]
  return `M ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${p1[0]} ${p1[1]}`
}

/* -------- Exposure: how many are open, how severe, and what they ask you to do.
   Deliberately not a circle: the donut below already carries the only ring on the page. -------- */

const ACTION_NOTE: Record<string, string> = {
  're-trade': 'reopen price',
  escrow: 'hold back funds',
  indemnity: 'seller covers it',
  'walk-away': 'deal breaker',
  monitor: 'watch, no action',
}

export function ExposurePanel({ findings }: { findings: Finding[] }) {
  const open = findings.filter(f => f.status !== 'resolved')
  const counts = {
    high: open.filter(f => f.severity === 'high').length,
    medium: open.filter(f => f.severity === 'medium').length,
    low: open.filter(f => f.severity === 'low').length,
  }
  const total = open.length
  const state = counts.high >= 3 ? 'Elevated' : counts.high > 0 ? 'Attention' : counts.medium > 0 ? 'Watch' : 'Clear'
  const tone = counts.high > 0 ? 'bg-high-soft text-high' : 'bg-quiet text-ink-2'
  const order: (keyof typeof counts)[] = ['high', 'medium', 'low']

  const actions = new Map<string, number>()
  for (const f of open) {
    const a = f.recommended_action || 'monitor'
    actions.set(a, (actions.get(a) ?? 0) + 1)
  }
  const ranked = [...actions.entries()].sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...ranked.map(([, n]) => n))

  return (
    <div className="flex flex-col">
      <div className="flex items-end gap-4">
        <span className="tight text-[64px] font-black leading-[0.82]">{total}</span>
        <div className="pb-1.5">
          <p className="label">open risks</p>
          <span className={`tag mt-2 ${tone}`}>{state}</span>
        </div>
      </div>

      <div className="mt-6 flex h-2 gap-1 overflow-hidden">
        {total === 0
          ? <span className="flex-1 rounded-full bg-quiet" />
          : order.filter(k => counts[k] > 0).map(k => (
            <span key={k} className="rounded-full" style={{ flex: counts[k], background: sevColor[k] }} />
          ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        {order.map(k => (
          <div key={k} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: sevColor[k] }} />
            <span className="text-[12.5px] text-ink-2"><b className="font-bold text-ink">{counts[k]}</b> {k}</span>
          </div>
        ))}
      </div>

      <p className="label mt-7">What they ask you to do</p>
      <ul className="mt-3">
        {ranked.map(([action, n]) => (
          <li key={action} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
            <span className="w-[92px] shrink-0 text-[13px] capitalize">{action}</span>
            <span className="hidden text-[11.5px] text-ink-3 sm:block">{ACTION_NOTE[action] ?? ''}</span>
            <span className="ml-auto flex items-center gap-2.5">
              <span className="h-1.5 rounded-full bg-ink" style={{ width: `${(n / max) * 46 + 8}px` }} />
              <b className="w-3 text-right text-[13px] font-bold">{n}</b>
            </span>
          </li>
        ))}
        {ranked.length === 0 && <li className="py-3 text-[13px] text-ink-3">Nothing open.</li>}
      </ul>
    </div>
  )
}

/* -------- Donut: findings per department -------- */

export function DomainDonut({ findings }: { findings: Finding[] }) {
  const list = ['legal', 'financial', 'hr', 'ip'].map(d => ({ d, n: findings.filter(f => f.domain === d).length }))
  const total = list.reduce((s, c) => s + c.n, 0)
  const cx = 82, cy = 82, r = 62, sw = 15, gap = 6
  const segs: { a0: number; a1: number; c: string }[] = []
  let cursor = -90
  for (const { d, n } of list) {
    if (!n || !total) continue
    const span = (n / total) * 360
    segs.push({ a0: cursor + gap / 2, a1: cursor + span - gap / 2, c: domainMeta[d].color })
    cursor += span
  }

  return (
    <div className="flex items-center gap-7">
      <div className="relative shrink-0">
        <svg viewBox="0 0 164 164" className="h-[158px] w-[158px]" role="img" aria-label="Findings by department">
          <circle cx={cx} cy={cy} r={r} stroke="var(--color-quiet)" strokeWidth={sw} fill="none" />
          {segs.map((s, i) => (
            <path key={i} d={arcPath(cx, cy, r, s.a0, s.a1)} stroke={s.c} strokeWidth={sw} strokeLinecap="round" fill="none" />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="tight text-[30px] font-black leading-none">{total}</span>
          <span className="label mt-1.5">total</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1">
        {list.map(({ d, n }) => (
          <li key={d} className="flex items-center gap-2.5 border-b border-line py-2.5 last:border-0">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: domainMeta[d].color }} />
            <span className="text-[13px] text-ink-2">{domainMeta[d].label}</span>
            <span className="ml-auto text-[13px] font-bold">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* -------- Evidence: verbatim-quote verification per department -------- */

export function EvidenceBars({ findings }: { findings: Finding[] }) {
  return (
    <ul className="flex flex-col gap-4">
      {['legal', 'financial', 'hr', 'ip'].map(d => {
        const items = findings.filter(f => f.domain === d)
        const ok = items.filter(f => f.citation_verified).length
        return (
          <li key={d}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12.5px] text-ink-2">{domainMeta[d].label}</span>
              <span className="text-[12px] text-ink-3">
                {items.length === 0 ? '—' : <><b className="font-bold text-ink">{ok}</b>/{items.length} verified</>}
              </span>
            </div>
            <div className="flex h-1.5 gap-1">
              {items.length === 0
                ? <span className="flex-1 rounded-full bg-quiet" />
                : items.map(f => (
                  <span key={f.id} className="flex-1 rounded-full"
                    style={{ background: f.citation_verified ? domainMeta[d].color : 'var(--color-high)' }}
                    title={f.citation_verified ? 'Quote found in source' : 'Quote not found — held for review'} />
                ))}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* -------- Data room: a bordered tile per document -------- */

export function DataRoom({ documents }: { documents: DocumentRecord[] }) {
  if (documents.length === 0) {
    return <p className="text-[13px] text-ink-3">Empty. Files dropped into the Drive folder appear here as the agents read them.</p>
  }
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[12px] border-t border-l border-line sm:grid-cols-3 xl:grid-cols-6">
      {documents.map(d => {
        const blocked = d.model_armor_verdict === 'blocked'
        const m = domainMeta[d.category] ?? domainMeta.unclassified
        return (
          <div key={d.id}
            className={`group relative flex min-h-[142px] flex-col justify-between border-r border-b border-line p-4 transition-colors duration-200 ${blocked ? 'bg-high-soft' : 'hover:bg-quiet'}`}>
            <div className="flex items-start justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px]"
                style={{ background: blocked ? 'var(--color-high)' : m.soft, color: blocked ? '#fff' : m.color }}>
                {blocked ? <ShieldOff size={16} /> : <FileText size={16} />}
              </span>
              <span className="mono text-ink-3">{timeShort(d.ingested_at)}</span>
            </div>
            <div>
              <p className="line-clamp-2 text-[12.5px] font-medium leading-[1.35]" title={d.name}>
                {d.name.replace(/\.pdf$/, '').replace(/_/g, ' ')}
              </p>
              <p className="mt-1.5 text-[11.5px]" style={{ color: blocked ? 'var(--color-high)' : 'var(--color-ink-3)' }}>
                {blocked ? 'Blocked before reasoning' : `${m.label} · ${d.finding_count} finding${d.finding_count === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* -------- Constellation: one entity, findings across departments -------- */

interface Cluster { label: string; members: Finding[] }

function buildClusters(findings: Finding[]): Cluster[] {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p); parent.set(x, r); return r
  }
  const ids = new Set(findings.map(f => f.id))
  for (const f of findings) for (const o of f.cross_referenced_finding_ids) if (ids.has(o)) parent.set(find(f.id), find(o))

  const groups = new Map<string, Finding[]>()
  for (const f of findings) groups.set(find(f.id), [...(groups.get(find(f.id)) ?? []), f])

  const out: Cluster[] = []
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const tally = new Map<string, number>()
    for (const m of members) for (const e of m.entities ?? []) tally.set(e, (tally.get(e) ?? 0) + 1)
    const label = [...tally.entries()].filter(([e]) => !/kestrel robotics/i.test(e))
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
    <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
      {clusters.slice(0, 2).map(c => {
        const n = c.members.length
        const size = 190, cx = size / 2, cy = size / 2, ring = 68
        const worst = c.members.some(m => m.severity === 'high') ? 'high'
          : c.members.some(m => m.severity === 'medium') ? 'medium' : 'low'
        const pts = c.members.map((_, i) => {
          const a = -TAU / 4 + (i * TAU) / n
          return [cx + ring * Math.cos(a), cy + ring * Math.sin(a)]
        })
        return (
          <div key={c.label} className="flex min-w-0 items-center gap-5">
            <svg viewBox={`0 0 ${size} ${size}`} className="h-[168px] w-[168px] shrink-0" role="img"
              aria-label={`${c.label}: ${n} findings linked`}>
              {pts.map(([x, y], i) => (
                <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-line)" strokeWidth="1.25" />
              ))}
              <circle cx={cx} cy={cy} r="15" fill={sevColor[worst]} />
              {c.members.map((m, i) => (
                <g key={m.id} onClick={() => onSelect(m.id)} style={{ cursor: 'pointer' }}>
                  <circle cx={pts[i][0]} cy={pts[i][1]} r="16" fill="var(--color-surface)" stroke={domainMeta[m.domain].color} strokeWidth="1.5" />
                  <circle cx={pts[i][0]} cy={pts[i][1]} r="6" fill={domainMeta[m.domain].color} />
                  <title>{m.summary}</title>
                </g>
              ))}
            </svg>
            <div className="min-w-0">
              <p className="tight text-[17px] font-bold leading-[1.2]">{c.label}</p>
              <p className="mt-1 whitespace-nowrap text-[12px] text-ink-3">
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
              <button onClick={() => onSelect(c.members[0].id)}
                className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                Inspect <ArrowUpRight size={12} />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
