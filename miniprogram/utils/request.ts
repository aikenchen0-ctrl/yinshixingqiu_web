const LOCAL_API_BASE_URLS = [
  'http://192.168.31.123:3000',
  'http://192.168.133.150:3000',
  'http://192.168.188.128:3000',
  'http://127.0.0.1:3000',
  'http://192.168.31.126:3000',
  'http://192.168.31.124:3000',
]
const REMOTE_API_BASE_URLS = ['https://xueyinx.cn']

const REMOTE_API_FALLBACK_STORAGE_KEY = 'xueyin_enable_remote_api_fallback'

function isRemoteApiFallbackEnabled() {
  try {
    return wx.getStorageSync(REMOTE_API_FALLBACK_STORAGE_KEY) === true
  } catch {
    return false
  }
}

function getAvailableApiBaseUrls() {
  const envVersion = getMiniProgramEnvVersion()

  if (envVersion === 'release' || envVersion === 'trial') {
    return REMOTE_API_BASE_URLS.slice()
  }

  if (isRemoteApiFallbackEnabled()) {
    return LOCAL_API_BASE_URLS.concat(REMOTE_API_BASE_URLS)
  }

  return LOCAL_API_BASE_URLS.slice()
}

export const API_BASE_URLS = getAvailableApiBaseUrls()

function pickDefaultLocalApiBaseUrl() {
  const preferredLanBaseUrl = LOCAL_API_BASE_URLS.find((baseUrl) => isPrivateIpv4Host(getBaseHost(baseUrl)))
  return preferredLanBaseUrl || LOCAL_API_BASE_URLS[0]
}

function pickDefaultApiBaseUrl() {
  const envVersion = getMiniProgramEnvVersion()
  if (envVersion === 'release' || envVersion === 'trial') {
    return REMOTE_API_BASE_URLS[0]
  }

  return pickDefaultLocalApiBaseUrl()
}

let activeApiBaseUrl = pickDefaultApiBaseUrl()

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  baseUrl?: string
  sessionToken?: string
  timeout?: number
  retryOnRouteNotFound?: boolean
  routeNotFoundMessage?: string
}

interface ParsedHttpUrl {
  origin: string
  hostname: string
  pathname: string
  search: string
  hash: string
}

const preparedImageDisplayUrlCache: Record<string, Promise<string>> = {}

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

function parseHttpUrl(url: string): ParsedHttpUrl | null {
  const matched = String(url || '').trim().match(/^(https?:)\/\/([^\/?#]+)([^?#]*)?(\?[^#]*)?(#.*)?$/i)
  if (!matched) {
    return null
  }

  const protocol = matched[1]
  const authority = matched[2]
  const pathname = matched[3] || '/'
  const search = matched[4] || ''
  const hash = matched[5] || ''
  const authorityWithoutAuth = authority.indexOf('@') >= 0 ? authority.slice(authority.lastIndexOf('@') + 1) : authority

  let hostname = authorityWithoutAuth
  if (hostname.startsWith('[')) {
    const ipv6EndIndex = hostname.indexOf(']')
    hostname = ipv6EndIndex >= 0 ? hostname.slice(0, ipv6EndIndex + 1) : hostname
  } else if (hostname.indexOf(':') >= 0) {
    hostname = hostname.split(':')[0]
  }

  return {
    origin: `${protocol}//${authority}`,
    hostname: hostname.toLowerCase(),
    pathname,
    search,
    hash,
  }
}

function getPreferredBaseUrls() {
  const envVersion = getMiniProgramEnvVersion()
  const availableApiBaseUrls = getAvailableApiBaseUrls()
  const localApiBaseUrls = availableApiBaseUrls.filter((baseUrl) => LOCAL_API_BASE_URLS.indexOf(baseUrl) >= 0)
  const remoteApiBaseUrls = availableApiBaseUrls.filter((baseUrl) => REMOTE_API_BASE_URLS.indexOf(baseUrl) >= 0)

  if (envVersion === 'release' || envVersion === 'trial') {
    const preferredActiveBaseUrl = remoteApiBaseUrls.indexOf(activeApiBaseUrl) >= 0 ? activeApiBaseUrl : remoteApiBaseUrls[0]
    return uniqueBaseUrls([preferredActiveBaseUrl].concat(remoteApiBaseUrls))
  }

  if (!remoteApiBaseUrls.length) {
    return uniqueBaseUrls([activeApiBaseUrl].concat(localApiBaseUrls))
  }

  return uniqueBaseUrls([activeApiBaseUrl].concat(localApiBaseUrls, remoteApiBaseUrls))
}

function shouldRetryByStatusCode(statusCode: number) {
  // 404 usually means the current backend/environment does not have this route or resource.
  // Retrying another host on a business 404 can silently switch environments and show wrong data.
  return statusCode >= 500
}

function isRouteNotFoundResponse(
  statusCode: number,
  responseData: { message?: string; path?: string } | undefined,
  requestPath: string
) {
  if (statusCode !== 404) {
    return false
  }

  const message = String((responseData && responseData.message) || '').trim().toLowerCase()
  const path = String((responseData && responseData.path) || '').trim()
  return message === 'not found' && (!path || path === requestPath)
}

function sanitizeUrlForLog(url: string) {
  return url.replace(/([?&]sessionToken=)[^&]+/gi, '$1***')
}

function sanitizeDataForLog(data?: Record<string, unknown>) {
  if (!data) {
    return null
  }

  return Object.keys(data).reduce<Record<string, unknown>>((result, key) => {
    result[key] = key === 'sessionToken' ? '***' : data[key]
    return result
  }, {})
}

export function getApiBaseUrl() {
  return activeApiBaseUrl
}

export function setApiBaseUrl(baseUrl: string) {
  activeApiBaseUrl = baseUrl
}

function getBaseOrigin(baseUrl: string) {
  const parsedBaseUrl = parseHttpUrl(baseUrl)
  return parsedBaseUrl ? parsedBaseUrl.origin : baseUrl.replace(/\/+$/, '')
}

function getBaseHost(baseUrl: string) {
  const parsedBaseUrl = parseHttpUrl(baseUrl)
  return parsedBaseUrl ? parsedBaseUrl.hostname : ''
}

function isPrivateIpv4Host(hostname: string) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true
  }

  const matched = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/)
  if (!matched) {
    return false
  }

  const secondOctet = Number(matched[1])
  return secondOctet >= 16 && secondOctet <= 31
}

function isLocalAssetHost(hostname: string) {
  const normalizedHostname = (hostname || '').toLowerCase()
  if (!normalizedHostname) {
    return false
  }

  return (
    normalizedHostname === '127.0.0.1' ||
    normalizedHostname === 'localhost' ||
    normalizedHostname === '::1' ||
    normalizedHostname === '[::1]' ||
    isPrivateIpv4Host(normalizedHostname)
  )
}

function pickPreferredAssetOrigin() {
  const activeOrigin = getBaseOrigin(activeApiBaseUrl)
  if (activeOrigin) {
    return activeOrigin
  }

  const preferredBaseUrl = getPreferredBaseUrls()[0]
  if (preferredBaseUrl) {
    return getBaseOrigin(preferredBaseUrl)
  }

  return getBaseOrigin(pickDefaultLocalApiBaseUrl())
}

function getAssetCandidateOrigins() {
  const candidateBaseUrls = uniqueBaseUrls([activeApiBaseUrl].concat(REMOTE_API_BASE_URLS, getPreferredBaseUrls(), LOCAL_API_BASE_URLS))
  const candidateOrigins = candidateBaseUrls
    .map((baseUrl) => getBaseOrigin(baseUrl))
    .filter((origin) => Boolean(origin))

  return uniqueBaseUrls(candidateOrigins)
}

function isKnownAssetCandidateHost(hostname: string) {
  const normalizedHostname = String(hostname || '').toLowerCase()
  if (!normalizedHostname) {
    return false
  }

  return getAssetCandidateOrigins().some((origin) => getBaseHost(origin) === normalizedHostname)
}

export function normalizeAssetUrl(url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) {
    return ''
  }

  if (/^\//.test(normalizedUrl)) {
    return `${pickPreferredAssetOrigin()}${normalizedUrl}`
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return normalizedUrl
  }

  const parsedUrl = parseHttpUrl(normalizedUrl)
  if (!parsedUrl) {
    return normalizedUrl
  }

  const hostname = parsedUrl.hostname
  const fallbackOrigin = pickPreferredAssetOrigin()
  const fallbackHost = getBaseHost(fallbackOrigin)

  if (!isLocalAssetHost(hostname)) {
    return normalizedUrl
  }

  if (fallbackHost && hostname === fallbackHost) {
    return normalizedUrl
  }

  return `${fallbackOrigin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
}

export function buildAssetUrlCandidates(url: string) {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) {
    return []
  }

  const primaryUrl = normalizeAssetUrl(normalizedUrl)
  if (/^\//.test(normalizedUrl)) {
    return uniqueBaseUrls([primaryUrl].concat(getAssetCandidateOrigins().map((origin) => `${origin}${normalizedUrl}`))).filter(
      Boolean,
    )
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return uniqueBaseUrls([primaryUrl, normalizedUrl].filter(Boolean))
  }

  const parsedUrl = parseHttpUrl(normalizedUrl)
  if (!parsedUrl) {
    return uniqueBaseUrls([primaryUrl, normalizedUrl].filter(Boolean))
  }

  const shouldRewriteCandidate =
    isLocalAssetHost(parsedUrl.hostname) ||
    isKnownAssetCandidateHost(parsedUrl.hostname) ||
    /^\/uploads(?:\/|$)/i.test(parsedUrl.pathname)

  if (!shouldRewriteCandidate) {
    return uniqueBaseUrls([primaryUrl, normalizedUrl].filter(Boolean))
  }

  const candidateUrls = [primaryUrl, normalizedUrl].concat(
    getAssetCandidateOrigins().map((origin) => `${origin}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`),
  )

  return uniqueBaseUrls(candidateUrls.filter(Boolean))
}

export function pickNextAssetUrl(currentUrl: string, attemptedUrls: string[] = []) {
  const normalizedAttemptedUrls = uniqueBaseUrls(
    attemptedUrls
      .concat(currentUrl)
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  )

  const candidateUrls = buildAssetUrlCandidates(currentUrl)
  return candidateUrls.find((item) => normalizedAttemptedUrls.indexOf(item) < 0) || ''
}

export function normalizeRichTextAssetUrls(html: string) {
  const normalizedHtml = String(html || '')
  if (!normalizedHtml.trim()) {
    return ''
  }

  return normalizedHtml.replace(/\b(src|href|poster)=(['"])([^'"]+)\2/gi, (_, attribute, quote, assetUrl) => {
    const nextUrl = normalizeAssetUrl(String(assetUrl || ''))
    return `${attribute}=${quote}${nextUrl}${quote}`
  })
}

function compressLocalImagePath(filePath: string): Promise<string> {
  const normalizedFilePath = String(filePath || '').trim()
  if (!normalizedFilePath) {
    return Promise.resolve('')
  }

  return new Promise((resolve) => {
    wx.compressImage({
      src: normalizedFilePath,
      quality: 92,
      success: (result) => {
        const tempFilePath = result && typeof result.tempFilePath === 'string' ? result.tempFilePath : ''
        resolve(tempFilePath || normalizedFilePath)
      },
      fail: () => resolve(normalizedFilePath),
    })
  })
}

export function prepareImageUploadPath(filePath: string): Promise<string> {
  const normalizedFilePath = String(filePath || '').trim()
  if (!normalizedFilePath || /^https?:\/\//i.test(normalizedFilePath)) {
    return Promise.resolve(normalizedFilePath)
  }

  return compressLocalImagePath(normalizedFilePath)
}

export function prepareAssetDisplayUrl(url: string): Promise<string> {
  const normalizedUrl = String(url || '').trim()
  if (!normalizedUrl) {
    return Promise.resolve('')
  }

  if (Object.prototype.hasOwnProperty.call(preparedImageDisplayUrlCache, normalizedUrl)) {
    return preparedImageDisplayUrlCache[normalizedUrl]
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    preparedImageDisplayUrlCache[normalizedUrl] = compressLocalImagePath(normalizedUrl)
      .then((resolvedUrl) => resolvedUrl || normalizedUrl)
      .catch(() => normalizedUrl)
    return preparedImageDisplayUrlCache[normalizedUrl]
  }

  preparedImageDisplayUrlCache[normalizedUrl] = new Promise((resolve) => {
    wx.downloadFile({
      url: normalizedUrl,
      success: (downloadResult) => {
        const statusCode = downloadResult && typeof downloadResult.statusCode === 'number' ? downloadResult.statusCode : 0
        const tempFilePath =
          downloadResult && typeof downloadResult.tempFilePath === 'string' ? downloadResult.tempFilePath : ''

        if (statusCode < 200 || statusCode >= 300 || !tempFilePath) {
          resolve(normalizedUrl)
          return
        }

        compressLocalImagePath(tempFilePath)
          .then((resolvedUrl) => resolve(resolvedUrl || tempFilePath))
          .catch(() => resolve(tempFilePath))
      },
      fail: () => resolve(normalizedUrl),
    })
  })

  return preparedImageDisplayUrlCache[normalizedUrl]
}

export function prepareAssetDisplayUrls(urls: string[]) {
  const normalizedUrls = Array.isArray(urls) ? urls.map((item) => String(item || '').trim()) : []
  return Promise.all(normalizedUrls.map((item) => prepareAssetDisplayUrl(item)))
}

function appendQueryParam(url: string, key: string, value: string) {
  const separator = url.indexOf('?') >= 0 ? '&' : '?'
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

export function request<T>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const candidateBaseUrls = options.baseUrl ? [options.baseUrl] : getPreferredBaseUrls()

    const tryRequest = (candidateIndex: number) => {
      const baseUrl = candidateBaseUrls[candidateIndex]
      const requestMethod = options.method || 'GET'
      let requestUrl = `${baseUrl}${options.url}`

      if (requestMethod === 'GET' && options.sessionToken && requestUrl.indexOf('sessionToken=') < 0) {
        requestUrl = appendQueryParam(requestUrl, 'sessionToken', options.sessionToken)
      }

      const safeRequestUrl = sanitizeUrlForLog(requestUrl)

      console.log('[request] start', {
        url: safeRequestUrl,
        method: requestMethod,
        data: sanitizeDataForLog(options.data),
      })

      wx.request({
        url: requestUrl,
        method: requestMethod,
        data: options.data,
        timeout: options.timeout || 8000,
        header: {
          'content-type': 'application/json',
          ...(options.sessionToken ? { 'x-session-token': options.sessionToken } : {}),
        },
        success(res) {
          console.log('[request] success', {
            url: safeRequestUrl,
            statusCode: res.statusCode,
            data: res.data,
          })

          if (res.statusCode >= 200 && res.statusCode < 300) {
            activeApiBaseUrl = baseUrl
            resolve(res.data as T)
            return
          }

          const responseData = res.data as { message?: string; path?: string } | undefined
          const shouldRetryOnRouteNotFound =
            !options.baseUrl &&
            options.retryOnRouteNotFound === true &&
            isRouteNotFoundResponse(res.statusCode, responseData, options.url) &&
            candidateIndex < candidateBaseUrls.length - 1

          if (shouldRetryOnRouteNotFound) {
            tryRequest(candidateIndex + 1)
            return
          }

          if (!options.baseUrl && shouldRetryByStatusCode(res.statusCode) && candidateIndex < candidateBaseUrls.length - 1) {
            tryRequest(candidateIndex + 1)
            return
          }

          const errorMessage =
            options.retryOnRouteNotFound === true && isRouteNotFoundResponse(res.statusCode, responseData, options.url)
              ? options.routeNotFoundMessage || '当前后端未部署所需接口，请更新后端服务后重试'
              : responseData && responseData.message
                ? responseData.message
                : '请求失败'
          reject(new Error(errorMessage))
        },
        fail(error) {
          console.error('[request] fail', {
            url: safeRequestUrl,
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
