import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Shield } from 'lucide-react'
import { login } from '../api'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await login(username, password)
      navigate('/')
    } catch {
      setError('That username and password did not match.')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="rise w-[368px] rounded-[18px] border border-line bg-surface p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-ink text-white">
          <Shield size={18} strokeWidth={2.2} />
        </span>
        <h1 className="tight mt-5 text-[24px] font-bold leading-none">DealGuard</h1>
        <p className="mt-2.5 text-[13.5px] text-ink-2">Sign in to the Project Kestrel deal file.</p>

        <label className="label mt-7 mb-2 block">Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} className="field w-full" autoFocus placeholder="maya" />

        <label className="label mt-4 mb-2 block">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="field w-full" placeholder="••••••••" />

        {error && <p className="mt-3 text-[13px] text-high">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary mt-6 h-10 w-full justify-center">
          {busy ? 'Signing in' : <>Sign in <ArrowRight size={15} /></>}
        </button>
      </form>
    </div>
  )
}
