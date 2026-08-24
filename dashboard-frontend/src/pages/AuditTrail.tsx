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
    <div className="mx-auto max-w-[900px] pb-8">
      <header className="rise mb-6 px-2 pt-2">
        <p className="label">{events.length} events · {blocked} blocked before any agent read them</p>
        <h1 className="display mt-2 text-[34px] leading-none">Audit trail</h1>
      </header>

      {groups.map(([day, list], gi) => (
        <section key={day} className="card rise mb-5" style={{ animationDelay: `${gi * 60}ms` }}>
          <p className="label mb-5">{day}</p>
          <ol className="relative flex flex-col gap-5 pl-9">
            <span className="absolute left-[13px] top-3 bottom-3 w-[1.5px] rounded-full bg-hair" aria-hidden />
            {list.map(e => {
              const m = meta[e.event_type] ?? meta.document_ingested
              const Icon = m.icon
              const alarm = m.tone === 'alarm'
              return (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-9 top-0 flex h-[27px] w-[27px] items-center justify-center rounded-full ${
                    alarm ? 'bg-high text-white' : m.tone === 'accent' ? 'bg-accent-soft text-accent' : 'bg-sunk text-ink-3'
                  }`}>
                    <Icon size={13} />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <span className={`text-[12px] font-medium ${alarm ? 'text-high' : 'text-ink-2'}`}>{m.label}</span>
                    <span className="text-[11.5px] text-ink-3">{timeShort(e.occurred_at)}</span>
                  </div>
                  <p className={`mt-1 max-w-[74ch] text-[13.5px] leading-[1.5] ${alarm ? 'font-medium text-high' : 'text-ink'}`}>
                    {e.description}
                  </p>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      {events.length === 0 && <p className="px-2 text-[13px] text-ink-3">Nothing recorded yet.</p>}
    </div>
  )
}
