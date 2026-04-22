function buildMallShippingRedirectUrl(options: Record<string, string>) {
  const query = Object.keys(options || {})
    .map((key) => [key, String(options[key] || '').trim()] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')

  return `/pages/store/shipping${query ? `?${query}` : ''}`
}

Page({
  data: {
    redirecting: true,
  },

  onLoad(options: Record<string, string>) {
    const targetUrl = buildMallShippingRedirectUrl(options)

    wx.redirectTo({
      url: targetUrl,
      fail: () => {
        wx.reLaunch({
          url: targetUrl,
        })
      },
    })
  },
})
