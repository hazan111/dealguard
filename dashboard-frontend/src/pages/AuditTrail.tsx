import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, FileText, Mic, RefreshCw, ShieldAlert } from 'lucide-react'
import { api, type TimelineEvent } from '../api'
import { dateLong, timeShort } from '../components/ui'

const meta: Record<string, { icon: typeof FileText; label: string; tone: 'quiet' | 'accent' | 'alarm' }> = {
  document_ingested: { icon: FileText, label: 'Document read', tone: 'quiet' },
  finding_created: { icon: ShieldAlert, label: 'Finding raised', tone: 'accent' },
  finding_updated: { icon: RefreshCw, label: 'Finding updated', tone: 'accent' },
  model_armor_block: { icon: Ban, label: 'Blocked', tone: 'alarm' },
  voice_briefing_generated: { icon: Mic, label: 'Briefing', tone: 'quiet' },
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
    for (const e of events) map.set(dateLong(e.occurred_at), [...(map.get(dateLong(e.occurred_at)) ?? []), e])
    return [...map.entries()]
  }, [events])

  const blocked = events.filter(e => e.event_type === 'model_armor_block').length

  return (
    <div className="px-8 py-7">
      <header className="rise mb-6">
        <h1 className="tight text-[30px] font-bold leading-none">Audit trail</h1>
        <p className="mt-2.5 text-[13.5px] text-ink-2">
          {events.length} events · {blocked} blocked before any agent read them · newest first
        </p>
      </header>

      <div className="rise max-w-[980px]">
        {groups.map(([day, list]) => (
          <section key={day} className="grid-shell mb-6">
            <p className="label border-r border-b border-line px-5 py-3.5">{day}</p>
            <ol>
              {list.map(e => {
                const m = meta[e.event_type] ?? meta.document_ingested
                const Icon = m.icon
                const alarm = m.tone === 'alarm'
                return (
                  <li key={e.id}
                    className={`grid grid-cols-[28px_112px_1fr_52px] items-start gap-3 border-r border-b border-line px-5 py-3.5 ${alarm ? 'bg-high-soft' : ''}`}>
                    <span className={`mt-px flex h-7 w-7 items-center justify-center rounded-[8px] ${
                      alarm ? 'bg-high text-white' : m.tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-quiet text-ink-3'
                    }`}>
                      <Icon size={13} />
                    </span>
                    <span className={`pt-1.5 text-[12px] font-medium ${alarm ? 'text-high' : 'text-ink-2'}`}>{m.label}</span>
                    <p className={`pt-1 text-[13px] leading-[1.55] ${alarm ? 'font-medium text-high' : 'text-ink'}`}>{e.description}</p>
                    <span className="mono pt-1.5 text-right text-ink-3">{timeShort(e.occurred_at)}</span>
                  </li>
                )
              })}
            </ol>
          </section>
        ))}
        {events.length === 0 && <p className="text-[13px] text-ink-3">Nothing recorded yet.</p>}
      </div>
    </div>
  )
}
