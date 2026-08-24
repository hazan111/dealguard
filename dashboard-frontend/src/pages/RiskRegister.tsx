import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Download, ExternalLink, FileCheck2, Link2, X } from 'lucide-react'
import { api, downloadCsv, type Finding } from '../api'
import { Button, Domain, SectionLabel, SeverityPill, StatusPill } from '../components/ui'

const severityRank = { high: 0, medium: 1, low: 2 }

function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div className="flex h-8 items-center rounded-md border border-line-strong bg-raised p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`h-full whitespace-nowrap rounded px-2.5 text-[12px] font-medium transition-colors duration-150 ${
            value === o.value ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:text-ink'
          }`}
        >
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
    setConfirmResolve(false)
    setExceptionUrl(null)
    if (id) setParams({ f: id }); else setParams({})
  }

  async function resolve(f: Finding) {
    setBusy(true)
    try {
      await api(`/api/risk-register/${f.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_by: 'Maya Chen' }),
      })
      setConfirmResolve(false)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function draftException(f: Finding) {
    setBusy(true)
    try {
      const { doc_url } = await api<{ doc_url: string }>(`/api/risk-register/${f.id}/draft-exception`, { method: 'POST' })
      setExceptionUrl(doc_url)
      await refresh()
    } catch (e) {
      alert(String(e))
    } finally {
      setBusy(false)
    }
  }

  const linked = selected ? selected.cross_referenced_finding_ids.map(id => byId.get(id)).filter(Boolean) as Finding[] : []

  return (
    <div className="flex min-h-screen">
      <div className="min-w-0 flex-1 px-8 py-7">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="shrink-0">
            <h1 className="text-[20px] font-semibold tracking-tight">Risk register</h1>
            <p className="t-meta mt-0.5 whitespace-nowrap">{rows.length} of {findings.length} findings shown · sorted by severity</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Segmented value={domain} onChange={setDomain} options={[
              { value: 'all', label: 'All domains' }, { value: 'legal', label: 'Legal' },
              { value: 'financial', label: 'Financial' }, { value: 'hr', label: 'HR / Comp' }, { value: 'ip', label: 'IP' },
            ]} />
            <Segmented value={status} onChange={setStatus} options={[
              { value: 'all', label: 'Any status' }, { value: 'open', label: 'Open' },
              { value: 'needs_review', label: 'Needs review' }, { value: 'resolved', label: 'Resolved' },
            ]} />
            <Button variant="secondary" onClick={downloadCsv}><Download size={13} /> CSV</Button>
          </div>
        </header>

        <table className="table">
          <thead>
            <tr>
              <th className="w-[92px]">Severity</th>
              <th className="w-[88px]">Domain</th>
              <th>Finding</th>
              {!selected && <th className="w-[200px]">Source</th>}
              <th className="w-[56px] text-right">Links</th>
              <th className="w-[112px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(f => (
              <tr key={f.id} className={`clickable ${selected?.id === f.id ? 'selected' : ''}`} onClick={() => select(f.id)}>
                <td><SeverityPill severity={f.severity} /></td>
                <td><Domain domain={f.domain} /></td>
                <td className="max-w-0">
                  <div className="truncate">{f.summary}</div>
                  <div className="t-meta truncate">{f.red_flag_pattern}</div>
                </td>
                {!selected && <td className="t-mono truncate text-ink-2">{f.document_name}</td>}
                <td className="text-right">
                  {f.cross_referenced_finding_ids.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[12px] text-accent"><Link2 size={12} />{f.cross_referenced_finding_ids.length}</span>
                  )}
                </td>
                <td><StatusPill status={f.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={selected ? 5 : 6} className="h-20 text-center text-ink-2">No findings match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <aside className="panel-enter w-[440px] shrink-0 overflow-y-auto border-l border-line bg-panel px-6 py-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SeverityPill severity={selected.severity} />
              <StatusPill status={selected.status} />
              <Domain domain={selected.domain} />
            </div>
            <button onClick={() => select(null)} aria-label="Close" className="btn btn-ghost h-7 w-7 justify-center px-0"><X size={15} /></button>
          </div>

          <h2 className="text-[15px] font-semibold leading-[1.35] tracking-tight">{selected.summary}</h2>
          <p className="t-meta mt-1.5">{selected.red_flag_pattern}</p>

          <div className="mt-5">
            <SectionLabel>Evidence</SectionLabel>
            <div className="rounded-md border border-line bg-raised p-3">
              <p className="font-mono text-[12px] leading-[1.6] text-ink">{selected.citation}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="t-mono text-ink-2">{selected.document_name}</span>
                <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${selected.citation_verified ? 'text-ok' : 'text-warn'}`}>
                  {selected.citation_verified ? <><Check size={12} /> Verified against source</> : <><X size={12} /> Not found in source</>}
                </span>
              </div>
            </div>
          </div>

          {linked.length > 0 && (
            <div className="mt-5">
              <SectionLabel>Linked findings</SectionLabel>
              <ul className="divide-y divide-line border-y border-line">
                {linked.map(o => (
                  <li key={o.id} className="flex cursor-pointer items-start gap-2.5 py-2 hover:text-accent" onClick={() => select(o.id)}>
                    <SeverityPill severity={o.severity} />
                    <span className="text-[12px] leading-4"><span className="font-medium text-ink-2">{o.domain.toUpperCase()}</span> · {o.summary}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
            <span className="t-label self-center">Suggested</span>
            <span className="capitalize">{selected.recommended_action}</span>
            <span className="t-label self-center">Finding id</span>
            <span className="t-mono text-ink-2">{selected.id}</span>
          </div>

          {selected.suggested_followup_question && (
            <div className="mt-5">
              <SectionLabel>Ask the seller</SectionLabel>
              <p className="max-w-[60ch] text-[13px] leading-5 text-ink">{selected.suggested_followup_question}</p>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2.5 border-t border-line pt-5">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => draftException(selected)} disabled={busy || selected.drafted_to_exceptions}>
                <FileCheck2 size={13} />{selected.drafted_to_exceptions ? 'In Schedule of Exceptions' : 'Draft into Schedule of Exceptions'}
              </Button>
              {exceptionUrl && (
                <a href={exceptionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                  Open doc <ExternalLink size={12} />
                </a>
              )}
            </div>
            {selected.status !== 'resolved' ? (
              confirmResolve ? (
                <div className="rounded-md border border-ok/40 bg-ok-soft p-3">
                  <p className="mb-2.5 text-[13px] leading-5">This records your name against the finding and cannot be undone by an agent.</p>
                  <div className="flex gap-2">
                    <Button variant="ok" onClick={() => resolve(selected)} disabled={busy}><Check size={13} /> Resolve as Maya Chen</Button>
                    <Button variant="ghost" onClick={() => setConfirmResolve(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setConfirmResolve(true)}>Mark resolved</Button>
              )
            ) : (
              <p className="t-meta">Resolved by {selected.resolved_by}</p>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
