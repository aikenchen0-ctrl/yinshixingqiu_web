import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getCurrentSession } from '../services/authWebService'

export function RequireSession({ loginPath = '/login' }: { loginPath?: string }) {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function verifySession() {
      setLoading(true)
      const session = await getCurrentSession()
      if (cancelled) return
      setAuthenticated(Boolean(session))
      setLoading(false)
    }

    void verifySession()

    return () => {
      cancelled = true
    }
  }, [location.pathname])

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-card auth-card-compact">
          <div className="auth-title">正在验证登录状态...</div>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    const redirect = `${location.pathname}${location.search}${location.hash}`
    return <Navigate replace state={{ from: redirect }} to={loginPath} />
  }

  return <Outlet />
}
