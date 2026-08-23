import { useCallback, useEffect, useState } from 'react'
import { Ban, FileText, Mic, ShieldAlert, RefreshCw } from 'lucide-react'
import { api, type TimelineEvent } from '../api'

const eventMeta: Record<string, { icon: typeof FileText; color: string }> = {
  document_ingested: { icon: FileText, color: 'text-ink-secondary' },
  finding_created: { icon: ShieldAlert, color: 'text-accent' },
  finding_updated: { icon: RefreshCw, color: 'text-accent' },
  model_armor_block: { icon: Ban, color: 'text-open' },
  voice_briefing_generated: { icon: Mic, color: 'text-resolved' },
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

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Audit Trail</h1>
      <div className="rounded-lg border border-line bg-white">
        <ul className="divide-y divide-line">
          {events.map(e => {
            const meta = eventMeta[e.event_type] ?? eventMeta.document_ingested
            const Icon = meta.icon
            const isBlock = e.event_type === 'model_armor_block'
            return (
              <li key={e.id} className={`flex items-start gap-3 px-5 py-3.5 ${isBlock ? 'bg-open/5' : ''}`}>
                <Icon size={16} className={`mt-0.5 shrink-0 ${meta.color}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-relaxed ${isBlock ? 'font-medium text-open' : 'text-ink'}`}>
                    {e.description}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">
                    {new Date(e.occurred_at).toLocaleString('en-US')} · {e.event_type.replace(/_/g, ' ')}
                  </p>
                </div>
              </li>
            )
          })}
          {events.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-ink-secondary">No events yet.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
