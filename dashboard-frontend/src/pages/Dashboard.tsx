import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, FileText, Link2, Mic, Pause, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { api, fetchAudio, type Finding, type Summary, type TimelineEvent } from '../api'
import { Button, Domain, SectionLabel, SeverityPill, Stat, timeShort } from '../components/ui'

interface Briefing { id: string; briefing_date: string; script_text: string }

const severityRank = { high: 0, medium: 1, low: 2 }

const eventIcon: Record<string, typeof FileText> = {
  document_ingested: FileText,
  finding_created: ShieldAlert,
  finding_updated: RefreshCw,
  model_armor_block: Ban,
  voice_briefing_generated: Mic,
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [findings, setFindings] = useState<Finding[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    const [s, f, t, b] = await Promise.all([
      api<Summary>('/api/summary'),
      api<{ findings: Finding[] }>('/api/risk-register'),
      api<{ events: TimelineEvent[] }>('/api/timeline'),
      api<{ briefing: Briefing | null }>('/api/briefings/latest'),
    ])
    setSummary(s)
    setFindings(f.findings)
    setEvents(t.events)
    setBriefing(b.briefing)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 10_000)
    return () => clearInterval(timer)
  }, [refresh])

  async function generate() {
    setGenerating(true)
    try {
      await api('/api/briefings/generate', { method: 'POST' })
      setAudioUrl(null)
      await refresh()
    } finally {
      setGenerating(false)
    }
  }

  async function togglePlay() {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false); return }
    if (!audioUrl) {
      const url = await fetchAudio()
      setAudioUrl(url)
      audioRef.current.src = url
    }
    await audioRef.current.play()
    setPlaying(true)
  }

  const open = findings
    .filter(f => f.status !== 'resolved')
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
  const high = open.filter(f => f.severity === 'high').length
  const lastEvent = events[0]

  return (
    <div className="mx-auto max-w-[1240px] px-8 py-7">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Project Kestrel</h1>
          <p className="t-meta mt-0.5">Due diligence, week 3 of 4 · Kestrel Robotics, Inc. · warehouse automation, lower middle market</p>
        </div>
        {lastEvent && (
          <p className="t-meta">Last activity <span className="t-mono text-ink">{timeShort(lastEvent.occurred_at)}</span></p>
        )}
      </header>

      <div className="mb-8 flex divide-x divide-line border-y border-line py-4 [&>*]:pl-8 [&>*:first-child]:pl-0">
        <Stat label="Open risks" value={summary?.open_risks ?? '–'} tone={(summary?.open_risks ?? 0) > 0 ? 'high' : undefined} />
        <Stat label="High severity" value={high} tone={high > 0 ? 'high' : undefined} />
        <Stat label="Needs review" value={summary?.needs_review ?? '–'} tone={(summary?.needs_review ?? 0) > 0 ? 'warn' : undefined} />
        <Stat label="Resolved" value={summary?.resolved ?? '–'} />
        <Stat label="Documents read" value={summary?.documents_processed ?? '–'} />
        <Stat label="Blocked by Model Armor" value={summary?.blocked_injections ?? '–'} tone={(summary?.blocked_injections ?? 0) > 0 ? 'high' : undefined} />
      </div>

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10">
        <section>
          <SectionLabel right={
            <button onClick={() => navigate('/risk-register')} className="text-[12px] font-medium text-accent hover:underline">
              Open the register
            </button>
          }>
            Open risks, by severity
          </SectionLabel>
          <table className="table">
            <thead>
              <tr>
                <th className="w-[92px]">Severity</th>
                <th className="w-[88px]">Domain</th>
                <th>Finding</th>
                <th className="w-[56px] text-right">Links</th>
              </tr>
            </thead>
            <tbody>
              {open.slice(0, 10).map(f => (
                <tr key={f.id} className="clickable" onClick={() => navigate(`/risk-register?f=${f.id}`)}>
                  <td><SeverityPill severity={f.severity} /></td>
                  <td><Domain domain={f.domain} /></td>
                  <td className="max-w-0">
                    <div className="truncate">{f.summary}</div>
                    <div className="t-meta truncate">{f.red_flag_pattern} · {f.document_name}</div>
                  </td>
                  <td className="text-right">
                    {f.cross_referenced_finding_ids.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[12px] text-accent">
                        <Link2 size={12} />{f.cross_referenced_finding_ids.length}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {open.length === 0 && (
                <tr><td colSpan={4} className="h-20 text-center text-ink-2">No open risks. Drop documents into the data room to start.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <div className="flex flex-col gap-8">
          <section>
            <SectionLabel right={
              <Button variant="secondary" onClick={generate} disabled={generating}>
                <Mic size={13} />{generating ? 'Generating' : briefing ? 'Regenerate' : 'Generate'}
              </Button>
            }>
              Voice briefing
            </SectionLabel>
            {briefing ? (
              <div className="rounded-md border border-line bg-raised p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause briefing' : 'Play briefing'}
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
                  >
                    {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
                  </button>
                  <div className="min-w-0">
                    <div className="t-mono text-ink-2">{briefing.briefing_date}</div>
                    <p className={`mt-1 max-w-[62ch] text-[13px] leading-5 text-ink ${expanded ? '' : 'line-clamp-4'}`}>
                      {briefing.script_text}
                    </p>
                    <button onClick={() => setExpanded(v => !v)} className="mt-1.5 text-[12px] font-medium text-accent hover:underline">
                      {expanded ? 'Show less' : 'Read the full script'}
                    </button>
                  </div>
                </div>
                <audio ref={audioRef} onEnded={() => setPlaying(false)} />
              </div>
            ) : (
              <p className="t-meta">No briefing yet. Generate one to hear the current risk state read aloud.</p>
            )}
          </section>

          <section>
            <SectionLabel right={
              <button onClick={() => navigate('/audit-trail')} className="text-[12px] font-medium text-accent hover:underline">
                Full audit trail
              </button>
            }>
              Recent activity
            </SectionLabel>
            <ul className="divide-y divide-line border-y border-line">
              {events.slice(0, 8).map(e => {
                const Icon = eventIcon[e.event_type] ?? FileText
                const block = e.event_type === 'model_armor_block'
                return (
                  <li key={e.id} className="flex items-start gap-3 py-2">
                    <span className="t-mono w-11 shrink-0 pt-0.5 text-ink-3">{timeShort(e.occurred_at)}</span>
                    <Icon size={14} className={`mt-0.5 shrink-0 ${block ? 'text-sev-high' : 'text-ink-3'}`} />
                    <span className={`line-clamp-2 text-[13px] leading-5 ${block ? 'font-medium text-sev-high' : 'text-ink'}`}>{e.description}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
