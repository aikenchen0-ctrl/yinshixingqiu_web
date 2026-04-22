Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '切换优惠券',
    },
    subtitle: {
      type: String,
      value: '',
    },
    closeText: {
      type: String,
      value: '收起',
    },
    emptyText: {
      type: String,
      value: '当前暂无可切换的优惠券',
    },
    theme: {
      type: String,
      value: 'detail',
    },
    overlayZIndex: {
      type: Number,
      value: 60,
    },
    options: {
      type: Array,
      value: [],
    },
  },
  methods: {
    noop() {},
    onClose() {
      this.triggerEvent('close')
    },
    onSelect(event: WechatMiniprogram.TouchEvent) {
      this.triggerEvent('select', {
        selectionMode: String(event.currentTarget.dataset.selectionMode || 'AUTO'),
        couponCode: String(event.currentTarget.dataset.couponCode || ''),
      })
    },
  },
})
