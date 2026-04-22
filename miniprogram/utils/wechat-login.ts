import { getStoredSession, saveSession, type UserSession } from './auth'
import { loginByPhoneNumber, loginByWechat } from './auth-api'

let loginTask: Promise<UserSession> | null = null

function createRequestId() {
  return `plogin_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
}

function runWxLogin() {
  return new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
    wx.login({
      success: resolve,
      fail: reject,
    })
  })
}

function applySession(session: UserSession) {
  saveSession(session)

  const app = getApp<IAppOption>()
  app.globalData.userSession = session
}

export function getCurrentSession() {
  return getStoredSession()
}

export async function ensureWechatSession(forceRefresh = false) {
  const storedSession = getStoredSession()

  if (!forceRefresh && storedSession && storedSession.sessionToken) {
    applySession(storedSession)
    return storedSession
  }

  if (loginTask) {
    return loginTask
  }

  loginTask = (async () => {
    const loginResult = await runWxLogin()
    const response = await loginByWechat({
      loginCode: loginResult.code || '',
    })
    const session = response.data

    applySession(session)
    return session
  })()

  try {
    return await loginTask
  } finally {
    loginTask = null
  }
}

export async function loginWithPhoneCode(phoneCode: string) {
  const loginResult = await runWxLogin()
  const response = await loginByPhoneNumber({
    loginCode: loginResult.code || '',
    phoneCode,
    requestId: createRequestId(),
  })
  const session = response.data

  applySession(session)
  return session
}
