const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8085'

export function getToken(): string | null {
  try { return localStorage.getItem('dg_token') } catch { return null }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem('dg_token', token)
    else localStorage.removeItem('dg_token')
  } catch { /* storage unavailable — session-only auth */ }
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const resp = await fetch(`${BASE}${path}`, { ...init, headers })
  if (resp.status === 401) {
    setToken(null)
    window.location.hash = '#/login'
    throw new Error('unauthorized')
  }
  if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`)
  return resp
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await request(path, init)
  return resp.json() as Promise<T>
}

export async function login(username: string, password: string): Promise<string> {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!resp.ok) throw new Error('Invalid credentials')
  const { token } = await resp.json()
  setToken(token)
  return token
}

export async function fetchAudio(): Promise<string> {
  const resp = await request('/api/briefings/latest/audio')
  return URL.createObjectURL(await resp.blob())
}

export async function downloadCsv(): Promise<void> {
  const resp = await request('/api/risk-register/export')
  const url = URL.createObjectURL(await resp.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = 'dealguard-risk-register.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export interface Finding {
  id: string
  domain: 'legal' | 'financial' | 'hr' | 'ip'
  summary: string
  red_flag_pattern: string
  citation: string
  citation_verified: boolean
  severity: 'low' | 'medium' | 'high'
  recommended_action: string
  suggested_followup_question: string | null
  status: 'open' | 'under_review' | 'needs_review' | 'resolved'
  entities: string[]
  cross_referenced_finding_ids: string[]
  document_id: string
  document_name: string
  drive_url: string
  created_at: string
  resolved_by: string | null
  drafted_to_exceptions?: boolean
}

export interface Summary {
  total_findings: number
  open_risks: number
  needs_review: number
  resolved: number
  documents_processed: number
  blocked_injections: number
}

export interface TimelineEvent {
  id: string
  event_type: string
  description: string
  related_document_id: string | null
  related_finding_id: string | null
  occurred_at: string
}
