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
      setError('Invalid credentials')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar">
      <form onSubmit={submit} className="w-80 rounded-lg bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-2">
          <Shield size={24} className="text-accent" />
          <span className="text-lg font-semibold">DealGuard</span>
        </div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-secondary">Username</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="mb-4 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          autoFocus
        />
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-secondary">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mb-3 text-sm text-open">{error}</p>}
        <button
          disabled={busy}
          className="w-full rounded-md bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
