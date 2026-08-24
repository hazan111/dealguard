import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, FileText, Link2, Mic, Pause, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { api, fetchAudio, type DocumentRecord, type Finding, type Summary, type TimelineEvent } from '../api'
import { Button, Domain, SectionLabel, SeverityPill, Stat, timeShort } from '../components/ui'
import { DataRoomStrip, RiskClusters, SeverityGauge } from '../components/visuals'

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
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const navigate = useNavigate()

  const refresh = useCallback(async () => {
    const [s, f, d, t, b] = await Promise.all([
      api<Summary>('/api/summary'),
      api<{ findings: Finding[] }>('/api/risk-register'),
      api<{ documents: DocumentRecord[] }>('/api/documents').catch(() => ({ documents: [] })),
      api<{ events: TimelineEvent[] }>('/api/timeline'),
      api<{ briefing: Briefing | null }>('/api/briefings/latest'),
    ])
    setSummary(s)
    setFindings(f.findings)
    setDocuments(d.documents)
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
  const lastEvent = events[0]
  const openFinding = (id: string) => navigate(`/risk-register?f=${id}`)

  return (
    <div className="mx-auto max-w-[1180px] px-10 py-10">
      <header className="mb-10 flex items-end justify-between gap-10">
        <div>
          <p className="t-label mb-2">Due diligence · week 3 of 4</p>
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight">Project Kestrel</h1>
          <p className="mt-1.5 max-w-[52ch] text-[14px] leading-6 text-ink-2">
            Solvane Search Partners acquiring Kestrel Robotics, a lower-middle-market warehouse-automation company.
            {lastEvent && <> Last agent activity at <span className="t-mono text-ink">{timeShort(lastEvent.occurred_at)}</span>.</>}
          </p>
        </div>
        <SeverityGauge findings={findings} />
      </header>

      <div className="mb-12 flex divide-x divide-line border-y border-line py-5 [&>*]:pl-8 [&>*:first-child]:pl-0">
        <Stat label="Needs review" value={summary?.needs_review ?? '–'} tone={(summary?.needs_review ?? 0) > 0 ? 'warn' : undefined} />
        <Stat label="Resolved" value={summary?.resolved ?? '–'} />
        <Stat label="Documents read" value={summary?.documents_processed ?? '–'} />
        <Stat label="Blocked by Model Armor" value={summary?.blocked_injections ?? '–'} tone={(summary?.blocked_injections ?? 0) > 0 ? 'high' : undefined} />
        <Stat label="Cross-domain links" value={findings.reduce((n, f) => n + f.cross_referenced_finding_ids.length, 0) / 2 | 0} />
      </div>

      <section className="mb-12">
        <SectionLabel>Data room</SectionLabel>
        <DataRoomStrip documents={documents} />
      </section>

      <section className="mb-12">
        <SectionLabel right={<span className="t-meta">Findings from different documents that point at the same customer, person or asset</span>}>
          Risk clusters
        </SectionLabel>
        <RiskClusters findings={findings} onSelect={openFinding} />
      </section>

      <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-12">
        <section>
          <SectionLabel right={
            <button onClick={() => navigate('/risk-register')} className="text-[12px] font-medium text-accent hover:underline">
              Open the register
            </button>
          }>
            Open risks, by severity
          </SectionLabel>
          <ul className="divide-y divide-line border-y border-line">
            {open.slice(0, 8).map(f => (
              <li key={f.id} className="flex cursor-pointer items-start gap-4 py-3.5 hover:bg-raised" onClick={() => openFinding(f.id)}>
                <div className="w-[84px] shrink-0 pt-0.5"><SeverityPill severity={f.severity} /></div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[13px] leading-5">{f.summary}</p>
                  <p className="t-meta mt-1 flex items-center gap-2">
                    <Domain domain={f.domain} />
                    <span>·</span>
                    <span className="truncate">{f.red_flag_pattern}</span>
                    {f.cross_referenced_finding_ids.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-accent"><Link2 size={11} />{f.cross_referenced_finding_ids.length}</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
            {open.length === 0 && <li className="py-8 text-center text-ink-2">No open risks. Drop documents into the data room to start.</li>}
          </ul>
        </section>

        <div className="flex flex-col gap-10">
          <section>
            <SectionLabel right={
              <Button variant="secondary" onClick={generate} disabled={generating}>
                <Mic size={13} />{generating ? 'Generating' : briefing ? 'Regenerate' : 'Generate'}
              </Button>
            }>
              Voice briefing
            </SectionLabel>
            {briefing ? (
              <div className="rounded-lg border border-line bg-raised p-5">
                <div className="flex items-start gap-4">
                  <button
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause briefing' : 'Play briefing'}
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
                  >
                    {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
                  </button>
                  <div className="min-w-0">
                    <div className="t-mono text-ink-2">{briefing.briefing_date}</div>
                    <p className={`mt-1.5 max-w-[60ch] text-[13px] leading-[1.6] text-ink ${expanded ? '' : 'line-clamp-4'}`}>
                      {briefing.script_text}
                    </p>
                    <button onClick={() => setExpanded(v => !v)} className="mt-2 text-[12px] font-medium text-accent hover:underline">
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
              {events.slice(0, 6).map(e => {
                const Icon = eventIcon[e.event_type] ?? FileText
                const block = e.event_type === 'model_armor_block'
                return (
                  <li key={e.id} className="flex items-start gap-3 py-2.5">
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
