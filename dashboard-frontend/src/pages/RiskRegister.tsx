import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, FileCheck2, Link2, X } from 'lucide-react'
import { api, downloadCsv, type Finding } from '../api'
import { Button, DomainBadge, SeverityBadge, StatusBadge } from '../components/ui'

const severityRank = { high: 0, medium: 1, low: 2 }

export default function RiskRegister() {
  const [findings, setFindings] = useState<Finding[]>([])
  const [domain, setDomain] = useState('all')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState<Finding | null>(null)
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

  async function resolve(f: Finding) {
    setBusy(true)
    try {
      await api(`/api/risk-register/${f.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved_by: 'Maya Chen' }),
      })
      setConfirmResolve(false)
      setSelected(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function draftException(f: Finding) {
    setBusy(true)
    try {
      const { doc_url } = await api<{ doc_url: string }>(
        `/api/risk-register/${f.id}/draft-exception`, { method: 'POST' })
      setExceptionUrl(doc_url)
      await refresh()
    } catch (e) {
      alert(String(e))
    } finally {
      setBusy(false)
    }
  }

  const filter = 'rounded-md border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-accent'

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Risk Register</h1>
        <div className="flex items-center gap-2">
          <select value={domain} onChange={e => setDomain(e.target.value)} className={filter}>
            <option value="all">All domains</option>
            <option value="legal">Legal</option>
            <option value="financial">Financial</option>
            <option value="hr">HR/Comp</option>
            <option value="ip">IP</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className={filter}>
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="needs_review">Needs review</option>
            <option value="resolved">Resolved</option>
          </select>
          <Button variant="secondary" onClick={downloadCsv}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-surface text-left">
              {['Severity', 'Domain', 'Finding', 'Source', 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-ink-secondary">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(f => (
              <tr
                key={f.id}
                onClick={() => { setSelected(f); setConfirmResolve(false); setExceptionUrl(null) }}
                className="cursor-pointer border-b border-line last:border-0 hover:bg-surface"
              >
                <td className="px-4 py-3"><SeverityBadge severity={f.severity} /></td>
                <td className="px-4 py-3"><DomainBadge domain={f.domain} /></td>
                <td className="max-w-md px-4 py-3">
                  <span className="line-clamp-2">{f.summary}</span>
                  {f.cross_referenced_finding_ids.length > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-xs text-accent">
                      <Link2 size={12} /> {f.cross_referenced_finding_ids.length} cross-referenced
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-secondary">{f.document_name}</td>
                <td className="px-4 py-3"><StatusBadge status={f.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-secondary">No findings match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 z-10 flex justify-end bg-black/30" onClick={() => setSelected(null)}>
          <div className="h-full w-[480px] overflow-y-auto bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={selected.severity} />
                <DomainBadge domain={selected.domain} />
                <StatusBadge status={selected.status} />
              </div>
              <button onClick={() => setSelected(null)} className="text-ink-secondary hover:text-ink"><X size={18} /></button>
            </div>
            <h2 className="mb-2 text-base font-semibold leading-snug">{selected.summary}</h2>
            <p className="mb-4 text-xs font-medium uppercase tracking-wider text-accent">{selected.red_flag_pattern}</p>

            <Section label="Citation">
              <p className="text-sm leading-relaxed text-ink">{selected.citation}</p>
              <p className={`mt-1 text-xs font-medium ${selected.citation_verified ? 'text-resolved' : 'text-open'}`}>
                {selected.citation_verified
                  ? '✓ Quote verified against source document'
                  : '✗ Quote NOT verified — routed to needs_review'}
              </p>
              <p className="mt-1 text-xs text-ink-secondary">{selected.document_name}</p>
            </Section>

            {selected.cross_referenced_finding_ids.some(id => byId.has(id)) && (
              <Section label="Cross-referenced findings">
                <ul className="space-y-2">
                  {selected.cross_referenced_finding_ids.filter(id => byId.has(id)).map(id => {
                    const other = byId.get(id)!
                    return (
                      <li key={id} className="rounded-md border border-line bg-surface p-2.5 text-xs leading-relaxed">
                        <span className="mr-1.5 font-medium uppercase text-accent">{other.domain}</span>
                        {other.summary}
                      </li>
                    )
                  })}
                </ul>
              </Section>
            )}

            <Section label="Recommended action">
              <p className="text-sm capitalize">{selected.recommended_action}</p>
            </Section>

            {selected.suggested_followup_question && (
              <Section label="Suggested follow-up question for the seller">
                <p className="rounded-md border border-line bg-surface p-3 text-sm italic leading-relaxed">
                  “{selected.suggested_followup_question}”
                </p>
              </Section>
            )}

            <div className="mt-6 space-y-3 border-t border-line pt-4">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => draftException(selected)} disabled={busy || selected.drafted_to_exceptions}>
                  <FileCheck2 size={14} />
                  {selected.drafted_to_exceptions ? 'In Schedule of Exceptions' : 'Draft into Schedule of Exceptions'}
                </Button>
                {exceptionUrl && (
                  <a href={exceptionUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-accent hover:underline">
                    Open doc <ExternalLink size={13} />
                  </a>
                )}
              </div>
              {selected.status !== 'resolved' && (
                confirmResolve ? (
                  <div className="rounded-md border border-resolved/40 bg-resolved/5 p-3">
                    <p className="mb-2 text-sm">Resolving is an irreversible audit action recorded with your name. Confirm?</p>
                    <div className="flex gap-2">
                      <Button variant="danger" onClick={() => resolve(selected)} disabled={busy}>Confirm resolve</Button>
                      <Button variant="secondary" onClick={() => setConfirmResolve(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="secondary" onClick={() => setConfirmResolve(true)}>Mark resolved (human sign-off)</Button>
                )
              )}
              {selected.resolved_by && (
                <p className="text-xs text-ink-secondary">Resolved by {selected.resolved_by}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink-secondary">{label}</h3>
      {children}
    </div>
  )
}
