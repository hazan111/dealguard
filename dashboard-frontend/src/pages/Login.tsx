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

  const field = 'h-11 w-full rounded-full bg-sunk px-4 text-[14px] text-ink outline-none transition-shadow placeholder:text-ink-3 focus:shadow-[0_0_0_2px_var(--color-accent)]'

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card rise w-[380px] p-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
          <Shield size={19} strokeWidth={2.1} />
        </div>
        <h1 className="display mt-5 text-[26px] leading-tight">DealGuard</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-2">Sign in to the Project Kestrel deal file.</p>

        <label className="label mt-7 mb-2 block">Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} className={field} autoFocus placeholder="maya" />

        <label className="label mt-4 mb-2 block">Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={field} placeholder="••••••••" />

        {error && <p className="mt-3 text-[13px] text-high">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary mt-6 h-11 w-full justify-center">
          {busy ? 'Signing in' : <>Sign in <ArrowRight size={15} /></>}
        </button>
      </form>
    </div>
  )
}
