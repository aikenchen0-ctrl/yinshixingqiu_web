Component({
  properties: {
    activeKey: {
      type: String,
      value: 'planet',
    },
  },

  data: {
    isNavigating: false,
  },

  methods: {
    onItemTap(e: WechatMiniprogram.TouchEvent) {
      const key = String(e.currentTarget.dataset.key || '')
      const activeKey = String(this.data.activeKey || '')

      if (!key || key === activeKey || this.data.isNavigating) {
        return
      }

      this.setData({
        isNavigating: true,
      })

      wx.hideKeyboard()
      this.triggerEvent('change', { key })

      setTimeout(() => {
        this.setData({
          isNavigating: false,
        })
      }, 300)
    },
  },
})
