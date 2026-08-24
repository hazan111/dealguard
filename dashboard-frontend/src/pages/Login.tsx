import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { login } from '../api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('That username and password did not match.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-panel">
      <form onSubmit={submit} className="w-[340px] rounded-lg border border-line bg-raised p-7">
        <div className="mb-6 flex items-center gap-2">
          <Shield size={18} strokeWidth={2.2} className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">DealGuard</span>
        </div>
        <p className="mb-5 text-[13px] text-ink-2">Sign in to the Project Kestrel deal file.</p>

        <label className="t-label mb-1.5 block">Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} className="input mb-4 w-full" autoFocus />

        <label className="t-label mb-1.5 block">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input mb-5 w-full" />

        {error && <p className="mb-3 text-[13px] text-sev-high">{error}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary w-full justify-center">
          {busy ? 'Signing in' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
