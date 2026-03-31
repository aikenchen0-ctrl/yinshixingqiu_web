interface ProfileMenuItem {
  id: string
  title: string
  value: string
  iconType: 'wallet' | 'planet'
  actionText: string
}

Page({
  data: {
    nickname: '(*´V`)σ',
    avatarUrl: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=240&q=80',
    menuItems: [
      {
        id: 'balance',
        title: '星球豆余额',
        value: '0',
        iconType: 'wallet',
        actionText: '明细',
      },
      {
        id: 'about',
        title: '关于知识星球',
        value: '',
        iconType: 'planet',
        actionText: '',
      },
    ] as ProfileMenuItem[],
  },

  onMenuTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id

    if (id === 'balance') {
      wx.navigateTo({
        url: '/pages/planet/beans',
      })
      return
    }

    if (id === 'about') {
      wx.showToast({
        title: '知识星球是一款内容社群产品',
        icon: 'none',
      })
    }
  },

  onBottomNavTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key

    if (key === 'planet') {
      wx.redirectTo({
        url: '/pages/planet/index',
      })
      return
    }

    if (key === 'discover') {
      wx.redirectTo({
        url: '/pages/planet/lobby',
      })
    }
  },
})
