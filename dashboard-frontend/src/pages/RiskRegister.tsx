import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Download, ExternalLink, FileCheck2, Link2, X } from 'lucide-react'
import { api, downloadCsv, type Finding } from '../api'
import { Button, DomainChip, SeverityChip, StatusChip } from '../components/ui'

const severityRank = { high: 0, medium: 1, low: 2 }

function Pills({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`h-8 rounded-full px-3.5 text-[12.5px] font-medium transition-colors duration-200 ${
            value === o.value ? 'bg-accent text-white' : 'bg-sunk text-ink-2 hover:text-ink'
          }`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function RiskRegister() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [domain, setDomain] = useState('all')
  const [status, setStatus] = useState('all')
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('f')
  const [confirmResolve, setConfirmResolve] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exceptionUrl, setExceptionUrl] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { findings } = await api<{ findings: Finding[] }>('/api/risk-register')
    setFindings(findings)
  }, [])

  useEffect(() => {
    refresh()
    const timer = setInterval(refresh, 10_000)
    return () => clearInterval(timer)
  }, [refresh])

  const rows = useMemo(() =>
    findings
      .filter(f => domain === 'all' || f.domain === domain)
      .filter(f => status === 'all' || f.status === status)
      .sort((a, b) => severityRank[a.severity] - severityRank[b.severity]),
    [findings, domain, status])

  const byId = useMemo(() => new Map(findings.map(f => [f.id, f])), [findings])
  const selected = selectedId ? byId.get(selectedId) ?? null : null

  function select(id: string | null) {
    setConfirmResolve(false); setExceptionUrl(null)
    if (id) setParams({ f: id }); else setParams({})
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
    <div className="mx-auto max-w-[1320px] pb-8">
      <header className="rise mb-6 flex flex-wrap items-end justify-between gap-5 px-2 pt-2">
        <div>
          <p className="label">{rows.length} of {findings.length} findings</p>
          <h1 className="display mt-2 text-[34px] leading-none">Risk register</h1>
        </div>
        <Button variant="soft" onClick={downloadCsv}><Download size={14} /> Export CSV</Button>
      </header>

      <div className={`grid gap-5 ${selected ? 'grid-cols-1 xl:grid-cols-[minmax(0,1fr)_452px]' : 'grid-cols-1'}`}>
        <div className="card rise">
          <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Pills value={domain} onChange={setDomain} options={[
              { value: 'all', label: 'All' }, { value: 'legal', label: 'Legal' },
              { value: 'financial', label: 'Financial' }, { value: 'hr', label: 'HR / Comp' }, { value: 'ip', label: 'IP' },
            ]} />
            <div className="h-5 w-px bg-hair" />
            <Pills value={status} onChange={setStatus} options={[
              { value: 'all', label: 'Any status' }, { value: 'open', label: 'Open' },
              { value: 'needs_review', label: 'Needs review' }, { value: 'resolved', label: 'Resolved' },
            ]} />
          </div>

          <ul className="-mx-3 flex flex-col">
            {rows.map(f => {
              const active = selected?.id === f.id
              return (
                <li key={f.id} onClick={() => select(f.id)}
                  className={`cursor-pointer rounded-[var(--radius-inner)] px-3 py-3.5 transition-colors duration-200 ${active ? 'bg-accent-soft' : 'hover:bg-sunk'}`}>
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] leading-[1.45]">{f.summary}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <SeverityChip severity={f.severity} />
                        <DomainChip domain={f.domain} />
                        <StatusChip status={f.status} />
                        <span className="text-[11.5px] text-ink-3">{f.red_flag_pattern}</span>
                        {f.cross_referenced_finding_ids.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-accent">
                            <Link2 size={11} />{f.cross_referenced_finding_ids.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
            {rows.length === 0 && (
              <li className="py-14 text-center text-[13px] text-ink-3">Nothing matches these filters.</li>
            )}
          </ul>
        </div>

        {selected && (
          <aside className="drawer-in card h-fit xl:sticky xl:top-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityChip severity={selected.severity} />
                <DomainChip domain={selected.domain} />
                <StatusChip status={selected.status} />
              </div>
              <button onClick={() => select(null)} aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-sunk hover:text-ink">
                <X size={16} />
              </button>
            </div>

            <h2 className="display text-[21px] leading-[1.25]">{selected.summary}</h2>
            <p className="mt-2 text-[12.5px] text-ink-3">{selected.red_flag_pattern}</p>

            <div className="mt-6 rounded-[var(--radius-inner)] bg-sunk p-4">
              <p className="label">From the document</p>
              <p className="quote mt-2 text-[14.5px] leading-[1.6]">{selected.citation}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-hair pt-3">
                <span className="text-[12px] text-ink-3">{selected.document_name}</span>
                <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${selected.citation_verified ? 'text-ok' : 'text-med'}`}>
                  {selected.citation_verified ? <><Check size={13} /> Found in source</> : <><X size={13} /> Not found in source</>}
                </span>
              </div>
            </div>

            {linked.length > 0 && (
              <div className="mt-6">
                <p className="label">Linked across departments</p>
                <ul className="mt-2.5 flex flex-col gap-2">
                  {linked.map(o => (
                    <li key={o.id} onClick={() => select(o.id)}
                      className="cursor-pointer rounded-[var(--radius-inner)] bg-sunk p-3 transition-colors hover:bg-accent-soft">
                      <div className="mb-1.5 flex items-center gap-2">
                        <DomainChip domain={o.domain} />
                        <SeverityChip severity={o.severity} />
                      </div>
                      <p className="line-clamp-2 text-[12.5px] leading-[1.45] text-ink-2">{o.summary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="label">Suggested treatment</span>
                <span className="text-[13.5px] font-medium capitalize">{selected.recommended_action}</span>
              </div>
              {selected.suggested_followup_question && (
                <div>
                  <span className="label">Ask the seller</span>
                  <p className="quote mt-1.5 text-[14px] leading-[1.55] text-ink-2">{selected.suggested_followup_question}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-hair pt-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="soft" onClick={() => draftException(selected)} disabled={busy || selected.drafted_to_exceptions}>
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
                  <div className="rounded-[var(--radius-inner)] bg-ok-soft p-4">
                    <p className="text-[13px] leading-[1.5]">Your name goes on the record against this finding. No agent can undo it.</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="ok" onClick={() => resolve(selected)} disabled={busy}>
                        <Check size={14} /> Resolve as Maya Chen
                      </Button>
                      <Button variant="quiet" onClick={() => setConfirmResolve(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="soft" onClick={() => setConfirmResolve(true)}>Mark resolved</Button>
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
