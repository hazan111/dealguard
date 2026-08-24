import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Ban, FileText, Link2, Mic, Pause, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { api, fetchAudio, type DocumentRecord, type Finding, type Summary, type TimelineEvent } from '../api'
import { Button, CellHead, DomainTag, SeverityTag, timeShort } from '../components/ui'
import { Constellation, DataRoom, DomainDonut, EvidenceBars, ExposurePanel } from '../components/visuals'

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
    setSummary(s); setFindings(f.findings); setDocuments(d.documents); setEvents(t.events); setBriefing(b.briefing)
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
    } finally { setGenerating(false) }
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

  const open = findings.filter(f => f.status !== 'resolved').sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
  const openFinding = (id: string) => navigate(`/risk-register?f=${id}`)
  const links = findings.reduce((n, f) => n + f.cross_referenced_finding_ids.length, 0) / 2 | 0

  return (
    <div className="px-8 py-7">
      <header className="rise mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="tight text-[30px] font-bold leading-none">Project Kestrel</h1>
          <p className="mt-2.5 text-[13.5px] text-ink-2">
            Due diligence, week 3 of 4 · Solvane Search Partners acquiring Kestrel Robotics
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-surface px-3.5 text-[12.5px] text-ink-2">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            Fleet live
            {events[0] && <span className="text-ink-3">· {timeShort(events[0].occurred_at)}</span>}
          </span>
          <Button variant="primary" onClick={() => navigate('/risk-register')}>
            Open register <ArrowUpRight size={14} />
          </Button>
        </div>
      </header>

      <div className="grid-shell rise grid grid-cols-12" style={{ animationDelay: '60ms' }}>
        <section className="cell col-span-12 flex flex-col lg:col-span-4">
          <CellHead title="Exposure" hint="What is still open, how severe, and the treatment each finding asks for" />
          <ExposurePanel findings={findings} />
        </section>

        <section className="cell col-span-12 flex flex-col md:col-span-6 lg:col-span-4">
          <CellHead title="Where it sits" hint="Which of the four specialists raised it" />
          <div className="flex flex-1 items-center">
            <DomainDonut findings={findings} />
          </div>
        </section>

        <section className="cell col-span-12 flex flex-col md:col-span-6 lg:col-span-4">
          <CellHead title="Evidence" hint="Claims quoted verbatim from the source, or held back" />
          <div className="flex-1"><EvidenceBars findings={findings} /></div>
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5">
            <div>
              <p className="tight text-[24px] font-black leading-none">{summary?.documents_processed ?? '–'}</p>
              <p className="label mt-2">documents</p>
            </div>
            <div>
              <p className="tight text-[24px] font-black leading-none text-high">{summary?.blocked_injections ?? '–'}</p>
              <p className="label mt-2">blocked</p>
            </div>
            <div>
              <p className="tight text-[24px] font-black leading-none">{links}</p>
              <p className="label mt-2">cross links</p>
            </div>
          </div>
        </section>

        <section className="cell col-span-12">
          <CellHead title="Data room"
            hint="Model Armor screens every file before any agent reasoning touches it" />
          <DataRoom documents={documents} />
        </section>

        <section className="cell col-span-12">
          <CellHead title="Connected risk"
            hint="One entity surfacing in several departments — the pattern a solo reviewer misses" />
          <Constellation findings={findings} onSelect={openFinding} />
        </section>

        <section className="cell col-span-12 lg:col-span-7">
          <CellHead title="Highest severity first"
            right={<Button variant="ghost" onClick={() => navigate('/risk-register')}>All {findings.length}</Button>} />
          <ul className="-mx-2.5">
            {open.slice(0, 5).map(f => (
              <li key={f.id} onClick={() => openFinding(f.id)}
                className="hoverable cursor-pointer rounded-[10px] px-2.5 py-2.5">
                <p className="line-clamp-2 text-[13px] leading-[1.45]">{f.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <SeverityTag severity={f.severity} />
                  <DomainTag domain={f.domain} />
                  {f.cross_referenced_finding_ids.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
                      <Link2 size={11} />{f.cross_referenced_finding_ids.length}
                    </span>
                  )}
                </div>
              </li>
            ))}
            {open.length === 0 && <li className="py-10 text-center text-[13px] text-ink-3">Nothing open yet.</li>}
          </ul>
        </section>

        <section className="cell col-span-12 order-last">
          <CellHead title="Daily briefing" hint="The current risk state, spoken"
            right={<Button variant="outline" onClick={generate} disabled={generating}>
              <Mic size={14} />{generating ? 'Generating' : briefing ? 'Regenerate' : 'Generate'}
            </Button>} />
          {briefing ? (
            <div className="flex items-start gap-5">
              <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform duration-200 hover:scale-105 active:scale-95">
                {playing ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
              </button>
              <div className="min-w-0">
                <p className="mono text-ink-3">{briefing.briefing_date}</p>
                <p className={`mt-2 max-w-[68ch] text-[13.5px] leading-[1.6] text-ink-2 ${expanded ? '' : 'line-clamp-3'}`}>
                  {briefing.script_text}
                </p>
                <button onClick={() => setExpanded(v => !v)} className="mt-2 text-[12.5px] font-medium text-accent hover:underline">
                  {expanded ? 'Show less' : 'Read the full script'}
                </button>
              </div>
              <audio ref={audioRef} onEnded={() => setPlaying(false)} />
            </div>
          ) : (
            <p className="text-[13px] text-ink-3">No briefing yet. Generate one to hear the current risk state read aloud.</p>
          )}
        </section>

        <section className="cell col-span-12 lg:col-span-5">
          <CellHead title="Activity"
            right={<Button variant="ghost" onClick={() => navigate('/audit-trail')}>Full trail</Button>} />
          <ul className="flex flex-col">
            {events.slice(0, 5).map(e => {
              const Icon = eventIcon[e.event_type] ?? FileText
              const block = e.event_type === 'model_armor_block'
              return (
                <li key={e.id} className="flex items-start gap-3 border-b border-line py-2.5 last:border-0">
                  <span className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] ${block ? 'bg-high text-white' : 'bg-quiet text-ink-3'}`}>
                    <Icon size={12} />
                  </span>
                  <p className={`line-clamp-2 flex-1 text-[12.5px] leading-[1.45] ${block ? 'font-medium text-high' : 'text-ink-2'}`}>{e.description}</p>
                  <span className="mono shrink-0 text-ink-3">{timeShort(e.occurred_at)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
