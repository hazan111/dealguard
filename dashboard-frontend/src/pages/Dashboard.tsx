import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileText, ShieldAlert, ShieldCheck, Ban, Play, Pause, Mic } from 'lucide-react'
import { api, fetchAudio, type Summary } from '../api'
import { Button, SummaryTile } from '../components/ui'

interface Briefing { id: string; briefing_date: string; script_text: string }

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [generating, setGenerating] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const refresh = useCallback(async () => {
    setSummary(await api<Summary>('/api/summary'))
    const { briefing } = await api<{ briefing: Briefing | null }>('/api/briefings/latest')
    setBriefing(briefing)
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
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      return
    }
    if (!audioUrl) {
      const url = await fetchAudio()
      setAudioUrl(url)
      audioRef.current.src = url
    }
    await audioRef.current.play()
    setPlaying(true)
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Deal Overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <SummaryTile label="Total findings" value={summary?.total_findings ?? '–'} icon={<ShieldAlert size={16} />} />
        <SummaryTile label="Open risks" value={summary?.open_risks ?? '–'} icon={<AlertTriangle size={16} />} alert={(summary?.open_risks ?? 0) > 0} />
        <SummaryTile label="Needs review" value={summary?.needs_review ?? '–'} icon={<ShieldCheck size={16} />} />
        <SummaryTile label="Documents processed" value={summary?.documents_processed ?? '–'} icon={<FileText size={16} />} />
        <SummaryTile label="Blocked injections" value={summary?.blocked_injections ?? '–'} icon={<Ban size={16} />} alert={(summary?.blocked_injections ?? 0) > 0} />
      </div>

      <div className="mt-8 rounded-lg border border-line bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic size={16} className="text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-secondary">Daily voice briefing</h2>
          </div>
          <Button onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate briefing'}
          </Button>
        </div>
        {briefing ? (
          <div className="flex items-start gap-4">
            <button
              onClick={togglePlay}
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
            >
              {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>
            <div>
              <p className="text-xs font-medium text-ink-secondary">{briefing.briefing_date}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink">{briefing.script_text}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-secondary">No briefing yet — generate one to hear the current risk state.</p>
        )}
        <audio ref={audioRef} onEnded={() => setPlaying(false)} />
      </div>
    </div>
  )
}
