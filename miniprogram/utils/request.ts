const LOCAL_API_BASE_URLS = ['http://192.168.31.124:3000', 'http://127.0.0.1:3000']
const REMOTE_API_BASE_URLS = ['https://xuyinx.cn', 'https://xueyin.net.cn', 'https://www.guanxingyun.com']

export const API_BASE_URLS = LOCAL_API_BASE_URLS.concat(REMOTE_API_BASE_URLS)

let activeApiBaseUrl = LOCAL_API_BASE_URLS[0]

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  baseUrl?: string
  sessionToken?: string
}

function getMiniProgramEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    const miniProgram = accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram : null
    return miniProgram && miniProgram.envVersion ? miniProgram.envVersion : 'develop'
  } catch {
    return 'develop'
  }
}

function uniqueBaseUrls(baseUrls: string[]) {
  return baseUrls.filter((baseUrl, index) => baseUrls.indexOf(baseUrl) === index)
}

function getPreferredBaseUrls() {
  const envVersion = getMiniProgramEnvVersion()

  if (envVersion === 'release' || envVersion === 'trial') {
    return uniqueBaseUrls([activeApiBaseUrl].concat(REMOTE_API_BASE_URLS, LOCAL_API_BASE_URLS))
  }

  return uniqueBaseUrls([activeApiBaseUrl].concat(LOCAL_API_BASE_URLS, REMOTE_API_BASE_URLS))
}

function shouldRetryByStatusCode(statusCode: number) {
  return statusCode === 404 || statusCode >= 500
}

export function getApiBaseUrl() {
  return activeApiBaseUrl
}

export function setApiBaseUrl(baseUrl: string) {
  activeApiBaseUrl = baseUrl
}

export function request<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const candidateBaseUrls = options.baseUrl ? [options.baseUrl] : getPreferredBaseUrls()

    const tryRequest = (candidateIndex: number) => {
      const baseUrl = candidateBaseUrls[candidateIndex]
      const requestUrl = `${baseUrl}${options.url}`

      console.log('[request] start', {
        url: requestUrl,
        method: options.method || 'GET',
        data: options.data || null,
      })

      wx.request({
        url: requestUrl,
        method: options.method || 'GET',
        data: options.data,
        timeout: 8000,
        header: {
          'content-type': 'application/json',
          ...(options.sessionToken ? { 'x-session-token': options.sessionToken } : {}),
        },
        success(res) {
          console.log('[request] success', {
            url: requestUrl,
            statusCode: res.statusCode,
            data: res.data,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            activeApiBaseUrl = baseUrl
            resolve(res.data as T)
            return
          }

          if (!options.baseUrl && shouldRetryByStatusCode(res.statusCode) && candidateIndex < candidateBaseUrls.length - 1) {
            tryRequest(candidateIndex + 1)
            return
          }

          const responseData = res.data as { message?: string } | undefined
          const errorMessage = responseData && responseData.message ? responseData.message : '请求失败'
          reject(new Error(errorMessage))
        },
        fail(error) {
          console.error('[request] fail', {
            url: requestUrl,
            error,
          })

          if (!options.baseUrl && candidateIndex < candidateBaseUrls.length - 1) {
            tryRequest(candidateIndex + 1)
            return
          }

          const errMsg =
            error && typeof error === 'object' && 'errMsg' in error
              ? String((error as { errMsg?: string }).errMsg || '请求失败')
              : '请求失败'
          reject(new Error(errMsg))
        },
      })
    }

    tryRequest(0)
  })
}
