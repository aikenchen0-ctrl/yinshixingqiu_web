// app.ts
App<IAppOption>({
  globalData: {
    // 会员状态由后端驱动，这里仅做本地占位
    isMember: false,
  },
  onLaunch() {
    // 应用启动时的基础初始化
    const launchAt = Date.now()
    wx.setStorageSync('launchAt', launchAt)
  },
})
