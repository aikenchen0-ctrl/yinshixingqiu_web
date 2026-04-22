Component({
  properties: {
    extClass: {
      type: String,
      value: '',
    },
    color: {
      type: String,
      value: '#ffffff',
    },
    text: {
      type: String,
      value: '返回',
    },
    showText: {
      type: Boolean,
      value: false,
    },
    delta: {
      type: Number,
      value: 1,
    },
    fallbackUrl: {
      type: String,
      value: '',
    },
    fallbackMode: {
      type: String,
      value: 'redirect',
    },
  },
  methods: {
    onTap() {
      const pages = getCurrentPages()
      const delta = this.data.delta > 0 ? this.data.delta : 1
      const fallbackUrl = String(this.data.fallbackUrl || '').trim()
      const fallbackMode = String(this.data.fallbackMode || 'redirect')

      if (pages.length > 1) {
        wx.navigateBack({
          delta,
        })
        this.triggerEvent('back', { mode: 'navigateBack', delta }, {})
        return
      }

      if (fallbackUrl) {
        if (fallbackMode === 'switchTab') {
          wx.switchTab({
            url: fallbackUrl,
          })
        } else if (fallbackMode === 'navigateTo') {
          wx.navigateTo({
            url: fallbackUrl,
          })
        } else {
          wx.redirectTo({
            url: fallbackUrl,
          })
        }

        this.triggerEvent('back', { mode: fallbackMode, fallbackUrl }, {})
        return
      }

      wx.switchTab({
        url: '/pages/index/index',
      })
      this.triggerEvent('back', { mode: 'switchTab', fallbackUrl: '/pages/index/index' }, {})
    },
  },
})
