interface ProfileMenuItem {
  id: string
  title: string
  value: string
  iconType: 'wallet' | 'planet'
  actionText: string
}

Page({
  data: {
    nickname: '(*´∀`)σ',
    avatarUrl: 'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=240&q=80',
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
      wx.showToast({
        title: '暂无星球豆明细',
        icon: 'none',
      })
      return
    }

    if (id === 'about') {
      wx.navigateTo({
        url: '/pages/planet/index',
      })
    }
  },
})
