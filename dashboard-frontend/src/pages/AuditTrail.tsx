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

/* The day's events on a real time lane: one mark per event at its actual
   clock position, red where Model Armor blocked something. Shows the burst
   pattern of a fleet reading a data room, not a fabricated trend line. */
function DayLane({ events }: { events: TimelineEvent[] }) {
  const marks = useMemo(() => {
    const times = events.map(e => new Date(e.occurred_at).getTime())
    if (times.length === 0) return null
    const from = Math.min(...times), to = Math.max(...times)
    const span = Math.max(to - from, 60_000)
    return {
      from, to,
      points: events.map(e => ({
        id: e.id,
        x: ((new Date(e.occurred_at).getTime() - from) / span) * 100,
        blocked: e.event_type === 'model_armor_block',
        label: `${timeShort(e.occurred_at)} — ${e.description.slice(0, 80)}`,
      })),
    }
  }, [events])

  if (!marks) return null
  const minutes = Math.max(1, Math.round((marks.to - marks.from) / 60_000))

  return (
    <div>
      <div className="relative h-11">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" aria-hidden />
        {marks.points.map(p => (
          <span key={p.id} title={p.label}
            className={`absolute top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-full ${p.blocked ? 'bg-high' : 'bg-ink'}`}
            style={{ left: `calc(${p.x}% - 1.5px)`, height: p.blocked ? 26 : 18 }} />
        ))}
      </div>
      <div className="mono mt-1.5 flex items-center justify-between text-ink-3">
        <span>{timeShort(new Date(marks.from).toISOString())}</span>
        <span className="text-[11px]">{minutes} min of work</span>
        <span>{timeShort(new Date(marks.to).toISOString())}</span>
      </div>
    </div>
  )
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

      <div className="rise max-w-[1020px]">
        {groups.map(([day, list]) => {
          const count = (t: string) => list.filter(e => e.event_type === t).length
          const stats = [
            { n: count('document_ingested'), label: 'documents read' },
            { n: count('finding_created'), label: 'findings raised' },
            { n: count('finding_updated'), label: 'updates' },
            { n: count('model_armor_block'), label: 'blocked', alarm: true },
          ]
          return (
            <section key={day} className="grid-shell mb-6">
              <div className="grid grid-cols-1 border-r border-b border-line md:grid-cols-[1fr_300px]">
                <div className="p-6">
                  <p className="label">{day}</p>
                  <div className="mt-4 flex flex-wrap gap-x-9 gap-y-4">
                    {stats.map(s => (
                      <div key={s.label}>
                        <p className={`tight text-[26px] font-black leading-none ${s.alarm && s.n > 0 ? 'text-high' : ''}`}>{s.n}</p>
                        <p className="label mt-2">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="border-t border-line p-6 md:border-t-0 md:border-l">
                  <p className="label mb-3">When the fleet was working</p>
                  <DayLane events={list} />
                </div>
              </div>

              <ol className="relative">
                {list.map((e, i) => {
                  const m = meta[e.event_type] ?? meta.document_ingested
                  const Icon = m.icon
                  const alarm = m.tone === 'alarm'
                  const last = i === list.length - 1
                  return (
                    <li key={e.id}
                      className={`relative grid grid-cols-[36px_120px_1fr_52px] items-start gap-3 border-r border-b border-line px-6 py-4 ${alarm ? 'bg-high-soft' : ''}`}>
                      {!last && <span className="absolute left-[41px] top-[46px] bottom-0 w-px bg-line" aria-hidden />}
                      <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-[10px] ${
                        alarm ? 'bg-high text-white' : m.tone === 'accent' ? 'bg-ink text-white' : 'bg-quiet text-ink-2'
                      }`}>
                        <Icon size={14} />
                      </span>
                      <span className={`pt-2 text-[12px] font-medium ${alarm ? 'text-high' : 'text-ink-2'}`}>{m.label}</span>
                      <p className={`pt-1.5 text-[13px] leading-[1.55] ${alarm ? 'font-medium text-high' : 'text-ink'}`}>{e.description}</p>
                      <span className="mono pt-2 text-right text-ink-3">{timeShort(e.occurred_at)}</span>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
        {events.length === 0 && <p className="text-[13px] text-ink-3">Nothing recorded yet.</p>}
      </div>
    </div>
  )
}
