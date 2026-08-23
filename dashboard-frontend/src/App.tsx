import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RiskRegister from './pages/RiskRegister'
import AuditTrail from './pages/AuditTrail'
import { getToken } from './api'

function Protected({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/risk-register" element={<Protected><RiskRegister /></Protected>} />
        <Route path="/audit-trail" element={<Protected><AuditTrail /></Protected>} />
      </Routes>
    </HashRouter>
  )
}
