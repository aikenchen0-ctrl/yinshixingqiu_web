Component({
  properties: {
    statusBarHeight: {
      type: Number,
      value: 28,
    },
    avatarUrl: {
      type: String,
      value: '',
    },
    avatarFallbackText: {
      type: String,
      value: 'momo',
    },
    showAvatarEditChip: {
      type: Boolean,
      value: false,
    },
    avatarEditText: {
      type: String,
      value: '',
    },
    nickname: {
      type: String,
      value: '',
    },
    subtitle: {
      type: String,
      value: '',
    },
    panelCompact: {
      type: Boolean,
      value: false,
    },
    panelTitle: {
      type: String,
      value: '',
    },
    panelDesc: {
      type: String,
      value: '',
    },
    panelButtonText: {
      type: String,
      value: '',
    },
    panelButtonOpenType: {
      type: String,
      value: '',
    },
    panelButtonGhost: {
      type: Boolean,
      value: false,
    },
    panelButtonLoading: {
      type: Boolean,
      value: false,
    },
    menuItems: {
      type: Array,
      value: [],
    },
    showTipCard: {
      type: Boolean,
      value: false,
    },
    tipTitle: {
      type: String,
      value: '',
    },
    tipDesc: {
      type: String,
      value: '',
    },
  },
  methods: {
    onHeroTap() {
      this.triggerEvent('hero')
    },
    onAvatarError() {
      this.triggerEvent('avatarerror')
    },
    onPanelActionTap() {
      if (this.data.panelButtonOpenType === 'getPhoneNumber') {
        return
      }

      this.triggerEvent('panelaction')
    },
    onPanelGetPhoneNumber(event: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('panelgetphonenumber', event.detail)
    },
    onMenuTap(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('menu', {
        id: String(event.currentTarget.dataset.id || ''),
      })
    },
  },
})
