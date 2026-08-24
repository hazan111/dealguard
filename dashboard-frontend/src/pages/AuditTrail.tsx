import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, FileText, Mic, RefreshCw, ShieldAlert } from 'lucide-react'
import { api, type TimelineEvent } from '../api'
import { dateLong, timeShort } from '../components/ui'

const meta: Record<string, { icon: typeof FileText; label: string }> = {
  document_ingested: { icon: FileText, label: 'Document' },
  finding_created: { icon: ShieldAlert, label: 'Finding' },
  finding_updated: { icon: RefreshCw, label: 'Update' },
  model_armor_block: { icon: Ban, label: 'Blocked' },
  voice_briefing_generated: { icon: Mic, label: 'Briefing' },
}

export default function AuditTrail() {
  const [events, setEvents] = useState<TimelineEvent[]>([])

  const refresh = useCallback(async () => {
    const { events } = await api<{ events: TimelineEvent[] }>('/api/timeline')
    setEvents(events)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 8_000)
    return () => clearInterval(timer)
  }, [refresh])

  const groups = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of events) {
      const day = dateLong(e.occurred_at)
      map.set(day, [...(map.get(day) ?? []), e])
    }
    return [...map.entries()]
  }, [events])

  const blocked = events.filter(e => e.event_type === 'model_armor_block').length

  return (
    <div className="mx-auto max-w-[960px] px-8 py-7">
      <header className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight">Audit trail</h1>
        <p className="t-meta mt-0.5">{events.length} events · {blocked} blocked by Model Armor · every agent action, in order</p>
      </header>

      {groups.map(([day, list]) => (
        <section key={day} className="mb-8">
          <div className="t-label mb-2">{day}</div>
          <ul className="divide-y divide-line border-y border-line">
            {list.map(e => {
              const m = meta[e.event_type] ?? meta.document_ingested
              const Icon = m.icon
              const block = e.event_type === 'model_armor_block'
              return (
                <li key={e.id} className={`grid grid-cols-[52px_20px_84px_1fr] items-start gap-3 py-2.5 ${block ? 'bg-sev-high-soft/60' : ''}`}>
                  <span className="t-mono pt-0.5 text-ink-3">{timeShort(e.occurred_at)}</span>
                  <Icon size={14} className={`mt-0.5 ${block ? 'text-sev-high' : 'text-ink-3'}`} />
                  <span className={`pt-px text-[12px] font-medium ${block ? 'text-sev-high' : 'text-ink-2'}`}>{m.label}</span>
                  <span className={`text-[13px] leading-5 ${block ? 'font-medium text-sev-high' : 'text-ink'}`}>{e.description}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {events.length === 0 && <p className="t-meta">Nothing recorded yet.</p>}
    </div>
  )
}
