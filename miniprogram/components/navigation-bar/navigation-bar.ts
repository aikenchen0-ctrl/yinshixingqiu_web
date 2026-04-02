Component({
  options: {
    // 启用多插槽
    multipleSlots: true,
  },
  properties: {
    extClass: {
      type: String,
      value: '',
    },
    title: {
      type: String,
      value: '',
    },
    background: {
      type: String,
      value: '',
    },
    color: {
      type: String,
      value: '',
    },
    back: {
      type: Boolean,
      value: true,
    },
    loading: {
      type: Boolean,
      value: false,
    },
    homeButton: {
      type: Boolean,
      value: false,
    },
    animated: {
      // 控制显隐动画
      type: Boolean,
      value: true,
    },
    show: {
      // 控制导航栏显隐
      type: Boolean,
      value: true,
      observer: '_showChange',
    },
    delta: {
      // 返回层级
      type: Number,
      value: 1,
    },
    backUrl: {
      type: String,
      value: '',
    },
  },
  data: {
    displayStyle: '',
  },
  lifetimes: {
    attached() {
      const rect = wx.getMenuButtonBoundingClientRect()
      wx.getSystemInfo({
        success: (res) => {
          const isAndroid = res.platform === 'android'
          const isDevtools = res.platform === 'devtools'
          this.setData({
            ios: !isAndroid,
            innerPaddingRight: `padding-right: ${res.windowWidth - rect.left}px`,
            leftWidth: `width: ${res.windowWidth - rect.left}px`,
            safeAreaTop: isDevtools || isAndroid
              ? `height: calc(var(--height) + ${res.safeArea.top}px); padding-top: ${res.safeArea.top}px`
              : '',
          })
        },
      })
    },
  },
  methods: {
    _showChange(show: boolean) {
      const animated = this.data.animated
      let displayStyle = ''
      if (animated) {
        displayStyle = `opacity: ${show ? '1' : '0'};transition:opacity 0.5s;`
      } else {
        displayStyle = `display: ${show ? '' : 'none'}`
      }
      this.setData({
        displayStyle,
      })
    },
    back() {
      const data = this.data
      const backUrl = (data.backUrl || '').trim()

      if (backUrl) {
        const tabBarPages = [
          '/pages/index/index',
          '/pages/calendar/index',
          '/pages/articles/index',
          '/pages/store/index',
          '/pages/profile/index',
        ]

        if (tabBarPages.includes(backUrl)) {
          wx.switchTab({
            url: backUrl,
          })
        } else {
          wx.redirectTo({
            url: backUrl,
          })
        }
        this.triggerEvent('back', { delta: data.delta, backUrl }, {})
        return
      }

      if (data.delta) {
        wx.navigateBack({
          delta: data.delta,
        })
      }
      this.triggerEvent('back', { delta: data.delta }, {})
    },
    home() {
      wx.switchTab({
        url: '/pages/index/index',
      })
      this.triggerEvent('home', {}, {})
    },
  },
})
