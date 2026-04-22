import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../services/apiClient'
import { getCurrentSession, loginForWeb } from '../../services/authWebService'

function normalizeAccount(value: string) {
  const compactValue = value.replace(/\s+/g, '')
  if (/^[\d()+-]+$/.test(compactValue)) {
    return compactValue.replace(/\D/g, '').slice(0, 11)
  }

  return compactValue.slice(0, 32)
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const redirectFromQuery = new URLSearchParams(location.search).get('redirect')
  const redirectFromState = typeof (location.state as { from?: string } | null)?.from === 'string'
    ? (location.state as { from?: string }).from || '/'
    : '/'
  const isMallRoute = location.pathname.startsWith('/mall')
  const redirectFrom = redirectFromQuery || redirectFromState || (isMallRoute ? '/mall' : '/')
  const isMallLogin = isMallRoute || redirectFrom.startsWith('/mall/')
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isMobileAccount = /^\d{11}$/.test(account)
  const canSubmit = Boolean(isMobileAccount || account)

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      const session = await getCurrentSession()
      if (cancelled || !session) return

      navigate(redirectFrom, { replace: true })
    }

    void checkSession()

    return () => {
      cancelled = true
    }
  }, [navigate, redirectFrom])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await loginForWeb(account)
      navigate(redirectFrom, { replace: true })
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        setError(submitError.message)
      } else {
        setError('登录服务暂不可用，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          <div className="auth-brand-logo">C</div>
          <div>
            <div className="auth-brand-name">{isMallLogin ? '血饮商城' : '饮视星球'}</div>
            <div className="auth-brand-subtitle">{isMallLogin ? '独立商城后台登录' : 'admin-web 登录'}</div>
          </div>
        </div>

        <div className="auth-title">账号登录</div>
        <div className="auth-description">
          {isMallLogin
            ? '独立商城后台不提供注册。请输入已绑定手机号，或直接输入 boss 账号登录。'
            : 'web 端不提供注册。请输入已绑定手机号，或直接输入 boss 账号登录。'}
        </div>

        <label className="auth-field">
          <span>账号</span>
          <input
            autoComplete="username"
            inputMode={isMobileAccount ? 'numeric' : 'text'}
            maxLength={32}
            onChange={(event) => setAccount(normalizeAccount(event.target.value))}
            placeholder="请输入手机号或 boss"
            value={account}
          />
        </label>

        <button className="auth-submit" disabled={loading || !canSubmit} type="submit">
          {loading ? '登录中...' : '登录'}
        </button>

        {error ? <div className="auth-error">{error}</div> : null}

        <div className="auth-footnote">
          手机号登录仍沿用原链路；boss 账号不需要密码，走单独的网页后台登录链路。
        </div>
      </form>
    </div>
  )
}
