// app.ts
App<IAppOption>({
  globalData: {
    // 用户与会员状态由后续后端驱动，这里先做小程序态占位
    isMember: false,
    userSession: null,
  },
  onLaunch() {
    // 应用启动时的基础初始化
    const launchAt = Date.now()
    wx.setStorageSync('launchAt', launchAt)

    try {
      const userSession = wx.getStorageSync('xueyin_user_session') || null
      if (userSession) {
        this.globalData.userSession = userSession
      }
    } catch {
      this.globalData.userSession = null
    }
  },
})
