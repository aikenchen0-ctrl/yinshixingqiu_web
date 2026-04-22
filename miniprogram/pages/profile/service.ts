import { buildMallAddressManagerUrl } from '../../utils/mall-address'

type ServiceEntryId = 'mallAddress' | 'mallOrders' | 'mallRefunds' | 'mallCommission'

interface ServiceEntryItem {
  id: ServiceEntryId
  title: string
  desc: string
  actionText: string
}

const SERVICE_ENTRIES: ServiceEntryItem[] = [
  {
    id: 'mallAddress',
    title: '收货地址管理',
    desc: '统一新增、编辑和切换默认收货地址，商城下单会直接带出。',
    actionText: '去管理',
  },
  {
    id: 'mallOrders',
    title: '订单管理',
    desc: '查看待支付、待发货、已发货等订单状态和订单详情。',
    actionText: '去查看',
  },
  {
    id: 'mallRefunds',
    title: '商城退款',
    desc: '直接查看退款相关订单，提交退款申请后也会在这里跟进状态。',
    actionText: '去处理',
  },
  {
    id: 'mallCommission',
    title: '分享佣金',
    desc: '查看分享成交后的佣金订单、结算状态和佣金金额。',
    actionText: '去查看',
  },
]

Page({
  data: {
    entries: SERVICE_ENTRIES,
  },

  onEntryTap(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '') as ServiceEntryId

    if (id === 'mallAddress') {
      wx.navigateTo({
        url: buildMallAddressManagerUrl({
          redirectUrl: '/pages/profile/service',
        }),
      })
      return
    }

    if (id === 'mallRefunds') {
      wx.navigateTo({
        url: '/pages/store/orders?filter=refund',
      })
      return
    }

    if (id === 'mallCommission') {
      wx.navigateTo({
        url: '/pages/store/commission',
      })
      return
    }

    wx.navigateTo({
      url: '/pages/store/orders',
    })
  },
})
