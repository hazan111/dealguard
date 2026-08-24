import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Ban, FileText, Link2, Mic, Pause, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { api, fetchAudio, type DocumentRecord, type Finding, type Summary, type TimelineEvent } from '../api'
import { Button, CardHead, DomainChip, timeShort } from '../components/ui'
import { Constellation, DataRoom, DomainDonut, EvidenceBars, ExposureArc } from '../components/visuals'

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
    <div className="mx-auto max-w-[1320px] pb-8">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-6 px-2 pt-2">
        <div>
          <p className="label">Due diligence · week 3 of 4</p>
          <h1 className="display mt-2 text-[38px] leading-[1.05]">Project Kestrel</h1>
          <p className="mt-2 max-w-[46ch] text-[13.5px] leading-5 text-ink-2">
            Solvane Search Partners acquiring Kestrel Robotics, a warehouse-automation company.
            Four specialist agents are reading the data room.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-full bg-card px-4 py-2" style={{ boxShadow: 'var(--shadow-card)' }}>
            <span className="h-2 w-2 rounded-full bg-ok" />
            <span className="text-[12.5px] text-ink-2">Fleet live</span>
            {events[0] && <span className="text-[12.5px] text-ink-3">· last read {timeShort(events[0].occurred_at)}</span>}
          </div>
          <Button variant="primary" onClick={() => navigate('/risk-register')}>
            Open the register <ArrowUpRight size={15} />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-5">
        <section className="card rise col-span-12 flex flex-col lg:col-span-4" style={{ animationDelay: '40ms' }}>
          <CardHead title="Exposure" hint="Everything still open, weighted by severity" />
          <div className="flex flex-1 items-center justify-center pb-1">
            <ExposureArc findings={findings} />
          </div>
        </section>

        <section className="card rise col-span-12 flex flex-col md:col-span-6 lg:col-span-4" style={{ animationDelay: '80ms' }}>
          <CardHead title="Where the risk sits" hint="Findings by department" />
          <div className="flex flex-1 items-center justify-center">
            <DomainDonut findings={findings} />
          </div>
        </section>

        <section className="card rise col-span-12 md:col-span-6 lg:col-span-4" style={{ animationDelay: '120ms' }}>
          <CardHead title="Evidence" hint="Every claim quoted verbatim from its source, or held back" />
          <EvidenceBars findings={findings} />
          <div className="mt-5 flex items-center gap-6 border-t border-hair pt-4">
            <div>
              <p className="display text-[26px] leading-7">{summary?.documents_processed ?? '–'}</p>
              <p className="label mt-0.5">documents read</p>
            </div>
            <div>
              <p className="display text-[26px] leading-7 text-high">{summary?.blocked_injections ?? '–'}</p>
              <p className="label mt-0.5">blocked by armor</p>
            </div>
            <div>
              <p className="display text-[26px] leading-7">{links}</p>
              <p className="label mt-0.5">cross links</p>
            </div>
          </div>
        </section>

        <section className="card rise col-span-12" style={{ animationDelay: '160ms' }}>
          <CardHead title="Data room"
            hint="Each file is screened by Model Armor, then routed to the specialist that owns it" />
          <DataRoom documents={documents} />
        </section>

        <section className="card rise col-span-12 flex flex-col lg:col-span-7" style={{ animationDelay: '200ms' }}>
          <CardHead title="Connected risk"
            hint="One entity, several departments — the pattern a solo reviewer misses" />
          <div className="flex flex-1 items-center">
            <Constellation findings={findings} onSelect={openFinding} />
          </div>
        </section>

        <section className="card rise col-span-12 lg:col-span-5" style={{ animationDelay: '240ms' }}>
          <CardHead title="Highest severity first"
            right={<Button variant="quiet" onClick={() => navigate('/risk-register')}>All {findings.length}</Button>} />
          <ul className="-mx-2 flex flex-col">
            {open.slice(0, 5).map(f => (
              <li key={f.id} onClick={() => openFinding(f.id)}
                className="rowlink cursor-pointer rounded-[var(--radius-inner)] px-2 py-2.5">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: f.severity === 'high' ? 'var(--color-high)' : f.severity === 'medium' ? 'var(--color-med)' : 'var(--color-low)' }} />
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[13px] leading-[1.45]">{f.summary}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <DomainChip domain={f.domain} />
                      {f.cross_referenced_finding_ids.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-3">
                          <Link2 size={11} />{f.cross_referenced_finding_ids.length} linked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
            {open.length === 0 && <li className="py-8 text-center text-[13px] text-ink-3">Nothing open. Drop a document into the data room to start.</li>}
          </ul>
        </section>

        <section className="card rise col-span-12 flex flex-col lg:col-span-7" style={{ animationDelay: '280ms' }}>
          <CardHead title="Daily briefing" hint="The day's risk state, spoken"
            right={<Button variant="soft" onClick={generate} disabled={generating}>
              <Mic size={14} />{generating ? 'Generating' : briefing ? 'Regenerate' : 'Generate'}
            </Button>} />
          {briefing ? (
            <div className="flex flex-1 items-center gap-5">
              <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover">
                {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
              </button>
              <div className="min-w-0">
                <p className="label">{briefing.briefing_date}</p>
                <p className={`quote mt-2 max-w-[64ch] text-[15px] leading-[1.6] text-ink ${expanded ? '' : 'line-clamp-3'}`}>
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

        <section className="card rise col-span-12 lg:col-span-5" style={{ animationDelay: '320ms' }}>
          <CardHead title="Activity"
            right={<Button variant="quiet" onClick={() => navigate('/audit-trail')}>Full trail</Button>} />
          <ul className="flex flex-col gap-3.5">
            {events.slice(0, 5).map(e => {
              const Icon = eventIcon[e.event_type] ?? FileText
              const block = e.event_type === 'model_armor_block'
              return (
                <li key={e.id} className="flex items-start gap-3">
                  <span className={`mt-px flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${block ? 'bg-high text-white' : 'bg-sunk text-ink-3'}`}>
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0">
                    <p className={`line-clamp-2 text-[12.5px] leading-[1.45] ${block ? 'font-medium text-high' : 'text-ink'}`}>{e.description}</p>
                    <p className="mt-0.5 text-[11.5px] text-ink-3">{timeShort(e.occurred_at)}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
