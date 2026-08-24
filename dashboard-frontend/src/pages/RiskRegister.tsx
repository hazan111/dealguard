import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Check, Download, ExternalLink, FileCheck2, Link2, Search, X } from 'lucide-react'
import { api, downloadCsv, type Finding } from '../api'
import { ActionTag, Button, DeptGlyph, DomainTag, Segmented, SeverityTag, StatusTag } from '../components/ui'
import { usePoll } from '../usePoll'

const severityRank = { high: 0, medium: 1, low: 2 }

export default function RiskRegister() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [params, setParams] = useSearchParams()
  const domain = params.get('domain') ?? 'all'
  const selectedId = params.get('f')
  const [status, setStatus] = useState('all')
  const [query, setQuery] = useState('')
  const [confirmResolve, setConfirmResolve] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exceptionUrl, setExceptionUrl] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { findings } = await api<{ findings: Finding[] }>('/api/risk-register')
    setFindings(findings)
  }, [])

  usePoll(refresh, 30_000)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return findings
      .filter(f => domain === 'all' || f.domain === domain)
      .filter(f => status === 'all' || f.status === status)
      .filter(f => !q || `${f.summary} ${f.red_flag_pattern} ${f.document_name} ${f.entities.join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
  }, [findings, domain, status, query])

  const byId = useMemo(() => new Map(findings.map(f => [f.id, f])), [findings])
  const selected = selectedId ? byId.get(selectedId) ?? null : null

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value); else next.delete(key)
    setParams(next)
  }

  function select(id: string | null) {
    setConfirmResolve(false); setExceptionUrl(null)
    setParam('f', id)
  }

  async function resolve(f: Finding) {
    setBusy(true)
    try {
      await api(`/api/risk-register/${f.id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_by: 'Maya Chen' }),
      })
      setConfirmResolve(false)
      await refresh()
    } finally { setBusy(false) }
  }

  async function draftException(f: Finding) {
    setBusy(true)
    try {
      const { doc_url } = await api<{ doc_url: string }>(`/api/risk-register/${f.id}/draft-exception`, { method: 'POST' })
      setExceptionUrl(doc_url)
      await refresh()
    } catch (e) { alert(String(e)) } finally { setBusy(false) }
  }

  const linked = selected
    ? selected.cross_referenced_finding_ids.map(id => byId.get(id)).filter(Boolean) as Finding[]
    : []

  return (
    <div className="px-8 py-7">
      <header className="rise mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="tight text-[30px] font-bold leading-none">Risk register</h1>
          <p className="mt-2.5 text-[13.5px] text-ink-2">
            {rows.length} of {findings.length} findings · sorted by severity
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search findings"
              className="field w-[220px] pl-8" />
          </div>
          <Segmented value={status} onChange={setStatus} options={[
            { value: 'all', label: 'All' }, { value: 'open', label: 'Open' },
            { value: 'needs_review', label: 'Review' }, { value: 'resolved', label: 'Resolved' },
          ]} />
          <Button variant="outline" onClick={downloadCsv}><Download size={14} /> CSV</Button>
        </div>
      </header>

      <div className={`rise grid gap-6 ${selected ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_444px]' : 'grid-cols-1'}`}>
        <div className="grid-shell">
          <div className="flex flex-wrap items-center gap-2 border-r border-b border-line px-5 py-3.5">
            <Segmented value={domain} onChange={v => setParam('domain', v)} options={[
              { value: 'all', label: 'All departments' }, { value: 'legal', label: 'Legal' },
              { value: 'financial', label: 'Financial' }, { value: 'hr', label: 'HR / Comp' }, { value: 'ip', label: 'IP' },
            ]} />
          </div>

          <ul>
            {rows.map(f => {
              const active = selected?.id === f.id
              return (
                <li key={f.id} onClick={() => select(f.id)}
                  className={`cursor-pointer border-r border-b border-line px-5 py-4 transition-colors duration-200 ${active ? 'bg-accent-soft' : 'hover:bg-quiet'}`}>
                  <div className="flex items-start gap-4">
                    <DeptGlyph domain={f.domain} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-6">
                        <p className="text-[13.5px] leading-[1.5]">{f.summary}</p>
                        <span className="mono hidden shrink-0 text-ink-3 lg:block">{f.document_name}</span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <SeverityTag severity={f.severity} />
                        <DomainTag domain={f.domain} />
                        <StatusTag status={f.status} />
                        <ActionTag action={f.recommended_action} />
                        <span className="text-[11.5px] text-ink-3">{f.red_flag_pattern}</span>
                        {f.cross_referenced_finding_ids.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-accent">
                            <Link2 size={11} />{f.cross_referenced_finding_ids.length}
                          </span>
                        )}
                        {!f.citation_verified && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-high">
                            <AlertTriangle size={11} /> quote unverified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
            {rows.length === 0 && (
              <li className="border-r border-b border-line px-5 py-16 text-center text-[13px] text-ink-3">
                Nothing matches these filters.
              </li>
            )}
          </ul>
        </div>

        {selected && (
          <aside className="slide-in h-fit rounded-[18px] border border-line bg-surface p-6 xl:sticky xl:top-7">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityTag severity={selected.severity} />
                <DomainTag domain={selected.domain} />
                <StatusTag status={selected.status} />
              </div>
              <button onClick={() => select(null)} aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-[9px] text-ink-3 transition-colors hover:bg-quiet hover:text-ink">
                <X size={16} />
              </button>
            </div>

            <div className="flex items-start gap-3.5">
              <DeptGlyph domain={selected.domain} size={44} />
              <div className="min-w-0">
                <h2 className="tight text-[19px] font-bold leading-[1.3]">{selected.summary}</h2>
                <p className="mt-2 text-[12.5px] text-ink-3">{selected.red_flag_pattern}</p>
              </div>
            </div>

            <div className="mt-6 rounded-[12px] border border-line bg-quiet p-4">
              <p className="label">From the document</p>
              <p className="mono mt-2.5 leading-[1.65] text-ink">{selected.citation}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <span className="mono text-ink-3">{selected.document_name}</span>
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${selected.citation_verified ? 'text-ink-2' : 'text-high'}`}>
                  {selected.citation_verified ? <><Check size={13} /> Found in source</> : <><X size={13} /> Not found in source</>}
                </span>
              </div>
            </div>

            {linked.length > 0 && (
              <div className="mt-6">
                <p className="label">Linked across departments</p>
                <ul className="mt-2.5 overflow-hidden rounded-[12px] border border-line">
                  {linked.map(o => (
                    <li key={o.id} onClick={() => select(o.id)}
                      className="hoverable cursor-pointer border-b border-line p-3.5 last:border-0">
                      <div className="mb-1.5 flex items-center gap-2">
                        <DomainTag domain={o.domain} />
                        <SeverityTag severity={o.severity} />
                      </div>
                      <p className="line-clamp-2 text-[12.5px] leading-[1.45] text-ink-2">{o.summary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex items-baseline justify-between border-b border-line pb-3">
              <span className="label">Suggested treatment</span>
              <span className="text-[13.5px] font-medium capitalize">{selected.recommended_action}</span>
            </div>

            {selected.suggested_followup_question && (
              <div className="mt-4">
                <p className="label">Ask the seller</p>
                <p className="mt-2 text-[13px] leading-[1.6] text-ink-2">{selected.suggested_followup_question}</p>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => draftException(selected)} disabled={busy || selected.drafted_to_exceptions}>
                  <FileCheck2 size={14} />
                  {selected.drafted_to_exceptions ? 'In the schedule' : 'Draft into Schedule of Exceptions'}
                </Button>
                {exceptionUrl && (
                  <a href={exceptionUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
                    Open doc <ExternalLink size={12} />
                  </a>
                )}
              </div>
              {selected.status !== 'resolved' ? (
                confirmResolve ? (
                  <div className="rounded-[12px] border border-ok/30 bg-ok-soft p-4">
                    <p className="text-[13px] leading-[1.5]">Your name goes on the record against this finding. No agent can undo it.</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="ok" onClick={() => resolve(selected)} disabled={busy}>
                        <Check size={14} /> Resolve as Maya Chen
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmResolve(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="primary" onClick={() => setConfirmResolve(true)}>Mark resolved</Button>
                )
              ) : (
                <p className="text-[12.5px] text-ink-3">Resolved by {selected.resolved_by}</p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
