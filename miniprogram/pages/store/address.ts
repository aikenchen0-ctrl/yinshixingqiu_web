import { clearSession, getStoredSession, savePendingLoginRedirect, shouldClearSessionByError } from '../../utils/auth'
import { normalizeMallUserFacingErrorMessage } from '../../utils/mall-error'
import {
  buildMallAddressFormState,
  buildMallShippingAddressView,
  buildMallShippingAddressViews,
  buildMallAddressRegionText,
  normalizeMallAddressFormValue,
  validateMallAddressForm,
  buildMallAddressManagerUrl,
  normalizeMallAddressRedirectUrl,
  normalizeMallAddressAutoBack,
  peekMallCheckoutSelectedAddressId,
  saveMallCheckoutSelectedAddressId,
  type MallShippingAddressView,
} from '../../utils/mall-address'
import {
  fetchMallShippingAddress,
  upsertMallShippingAddress,
  setDefaultMallShippingAddress,
  deleteMallShippingAddress,
  type MallShippingAddressApiItem,
} from '../../utils/store-api'

const DEFAULT_REDIRECT_URL = '/pages/store/index'
const TAB_PAGE_PATHS = [
  '/pages/index/index',
  '/pages/course/list',
  '/pages/articles/index',
  '/pages/store/index',
  '/pages/profile/index',
]

function buildMallAddressLoginUrl(redirectUrl: string, autoBack: boolean) {
  const currentPageUrl = buildMallAddressManagerUrl({
    redirectUrl,
    autoBack,
    fallbackRedirectUrl: DEFAULT_REDIRECT_URL,
  })
  return `/pages/auth/login?redirect=${encodeURIComponent(currentPageUrl)}`
}

Page({
  data: {
    statusBarHeight: 28,
    loading: true,
    submitting: false,
    redirectUrl: DEFAULT_REDIRECT_URL,
    autoBack: false,
    selectMode: false,
    shippingAddressItems: [] as MallShippingAddressApiItem[],
    shippingAddresses: [] as MallShippingAddressView[],
    shippingAddress: null as MallShippingAddressView | null,
    selectedAddressId: '',
    hasAddress: false,
    addressFormVisible: false,
    editingAddressId: '',
    recipientName: '',
    phone: '',
    region: [] as string[],
    regionText: '',
    hasRegion: false,
    detailAddress: '',
  },

  onLoad(options: Record<string, string>) {
    const statusBarHeight = (() => {
      try {
        return wx.getSystemInfoSync().statusBarHeight || 28
      } catch {
        return 28
      }
    })()

    this.setData({
      statusBarHeight,
      redirectUrl: normalizeMallAddressRedirectUrl(options.redirect, DEFAULT_REDIRECT_URL),
      autoBack: normalizeMallAddressAutoBack(options.autoback || options.autoBack),
      selectMode: normalizeMallAddressAutoBack(options.autoback || options.autoBack),
    })

    this.loadAddress()
  },

  promptLogin() {
    wx.showModal({
      title: '请先登录',
      content: '收货地址会统一放在“我的 - 商城服务”里管理，登录后会回到当前地址页继续操作。',
      confirmText: '去登录',
      showCancel: false,
      success: ({ confirm }) => {
        if (!confirm) {
          return
        }

        savePendingLoginRedirect(
          buildMallAddressManagerUrl({
            redirectUrl: this.data.redirectUrl,
            autoBack: this.data.autoBack,
            fallbackRedirectUrl: DEFAULT_REDIRECT_URL,
          }),
        )
        wx.redirectTo({
          url: buildMallAddressLoginUrl(this.data.redirectUrl, this.data.autoBack),
        })
      },
    })
  },

  handleActionError(error: unknown, fallbackMessage: string) {
    if (shouldClearSessionByError(error)) {
      clearSession()
      wx.showModal({
        title: '登录已失效',
        content: '请重新登录后再继续管理收货地址。',
        confirmText: '去登录',
        showCancel: false,
        success: ({ confirm }) => {
          if (!confirm) {
            return
          }

          savePendingLoginRedirect(
            buildMallAddressManagerUrl({
              redirectUrl: this.data.redirectUrl,
              autoBack: this.data.autoBack,
              fallbackRedirectUrl: DEFAULT_REDIRECT_URL,
            }),
          )
          wx.redirectTo({
            url: buildMallAddressLoginUrl(this.data.redirectUrl, this.data.autoBack),
          })
        },
      })
      return
    }

    wx.showToast({
      title: normalizeMallUserFacingErrorMessage(error, fallbackMessage),
      icon: 'none',
    })
  },

  async loadAddress() {
    const session = getStoredSession()
    if (!session) {
      this.setData({
        loading: false,
      })
      this.promptLogin()
      return
    }

    this.setData({
      loading: true,
    })

    try {
      const response = await fetchMallShippingAddress(session.sessionToken)
      this.applyAddressCollection(response.data)
      this.setData({
        loading: false,
      })
    } catch (error) {
      this.setData({
        loading: false,
      })
      this.handleActionError(error, '收货地址加载失败')
    }
  },

  applyAddressCollection(
    payload: {
      item: MallShippingAddressApiItem | null
      defaultItem: MallShippingAddressApiItem | null
      selectedItem?: MallShippingAddressApiItem | null
      savedItem?: MallShippingAddressApiItem | null
      items: MallShippingAddressApiItem[]
    },
    preferredAddressId = '',
  ) {
    const items = Array.isArray(payload.items) ? payload.items : []
    const shippingAddresses = buildMallShippingAddressViews(items)
    const selectedAddressIdFromCheckout = peekMallCheckoutSelectedAddressId()
    const nextSelectedId =
      preferredAddressId ||
      selectedAddressIdFromCheckout ||
      String((payload.selectedItem && payload.selectedItem.id) || '') ||
      String((payload.savedItem && payload.savedItem.id) || '') ||
      String((payload.defaultItem && payload.defaultItem.id) || '') ||
      String((items[0] && items[0].id) || '')

    const selectedAddress =
      items.find((item) => item.id === nextSelectedId) ||
      payload.selectedItem ||
      payload.savedItem ||
      payload.defaultItem ||
      null

    const hasAddress = items.length > 0

    this.setData({
      shippingAddressItems: items,
      shippingAddresses,
      shippingAddress: buildMallShippingAddressView(selectedAddress),
      selectedAddressId: selectedAddress ? String(selectedAddress.id || '') : '',
      hasAddress,
      addressFormVisible: hasAddress ? this.data.addressFormVisible : true,
    })

    if (!hasAddress) {
      this.clearAddressForm()
    }
  },

  clearAddressForm() {
    this.setData({
      editingAddressId: '',
      ...buildMallAddressFormState(null),
    })
  },

  fillAddressForm(address: MallShippingAddressApiItem) {
    this.setData({
      editingAddressId: String(address.id || ''),
      ...buildMallAddressFormState(address),
    })
  },

  getAddressFormValue() {
    return {
      recipientName: String(this.data.recipientName || ''),
      phone: String(this.data.phone || ''),
      region: Array.isArray(this.data.region) ? this.data.region : [],
      detailAddress: String(this.data.detailAddress || ''),
    }
  },

  navigateAfterSave() {
    const redirectUrl = this.data.redirectUrl || DEFAULT_REDIRECT_URL
    const redirectPath = redirectUrl.split('?')[0]

    if (getCurrentPages().length > 1) {
      wx.navigateBack({
        delta: 1,
        fail: () => {
          if (TAB_PAGE_PATHS.indexOf(redirectPath) >= 0) {
            wx.switchTab({
              url: redirectPath,
            })
            return
          }

          wx.redirectTo({
            url: redirectUrl,
          })
        },
      })
      return
    }

    if (TAB_PAGE_PATHS.indexOf(redirectPath) >= 0) {
      wx.switchTab({
        url: redirectPath,
      })
      return
    }

    wx.redirectTo({
      url: redirectUrl,
    })
  },

  async saveShippingAddress(showSuccessToast = true) {
    const session = getStoredSession()
    if (!session) {
      this.promptLogin()
      return false
    }

    const formValue = this.getAddressFormValue()
    const validationMessage = validateMallAddressForm(formValue)
    if (validationMessage) {
      wx.showToast({
        title: validationMessage,
        icon: 'none',
      })
      return false
    }

    const normalizedValue = normalizeMallAddressFormValue(formValue)
    const editingAddress = this.data.shippingAddressItems.find((item) => item.id === this.data.editingAddressId) || null

    this.setData({
      submitting: true,
      regionText: buildMallAddressRegionText(normalizedValue.region),
      hasRegion: normalizedValue.hasRegion,
    })

    try {
      const response = await upsertMallShippingAddress({
        sessionToken: session.sessionToken,
        addressId: this.data.editingAddressId || '',
        createNew: !this.data.editingAddressId,
        isDefault: editingAddress ? Boolean(editingAddress.isDefault) : this.data.shippingAddressItems.length === 0,
        recipientName: normalizedValue.recipientName,
        phone: normalizedValue.phone,
        province: normalizedValue.region[0] || '',
        city: normalizedValue.region[1] || '',
        district: normalizedValue.region[2] || '',
        detailAddress: normalizedValue.detailAddress,
      })
      const savedAddressId = String((response.data.savedItem && response.data.savedItem.id) || (response.data.selectedItem && response.data.selectedItem.id) || '')

      this.applyAddressCollection(response.data, savedAddressId)
      this.setData({
        submitting: false,
        addressFormVisible: false,
        editingAddressId: '',
      })

      if (showSuccessToast) {
        wx.showToast({
          title: '地址已保存',
          icon: 'success',
        })
      }

      if (this.data.autoBack) {
        setTimeout(() => {
          this.navigateAfterSave()
        }, 280)
      }

      return true
    } catch (error) {
      this.setData({
        submitting: false,
      })
      this.handleActionError(error, '保存收货地址失败')
      return false
    }
  },

  onRecipientNameInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      recipientName: String(event.detail.value || ''),
    })
  },

  onPhoneInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      phone: String(event.detail.value || '').replace(/[^\d]/g, '').slice(0, 11),
    })
  },

  onRegionChange(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) {
    const region = Array.isArray(event.detail.value) ? event.detail.value.map((item) => String(item || '')) : []

    this.setData({
      region,
      regionText: buildMallAddressRegionText(region),
      hasRegion: region.length === 3,
    })
  },

  onDetailAddressInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      detailAddress: String(event.detail.value || ''),
    })
  },

  onAddAddress() {
    this.clearAddressForm()
    this.setData({
      addressFormVisible: true,
    })
  },

  onCancelAddressEdit() {
    if (!this.data.shippingAddressItems.length) {
      return
    }

    this.clearAddressForm()
    this.setData({
      addressFormVisible: false,
    })
  },

  onSelectAddress(event: WechatMiniprogram.BaseEvent) {
    const addressId = String(event.currentTarget.dataset.id || '')
    const address = this.data.shippingAddressItems.find((item) => item.id === addressId) || null

    if (!address) {
      return
    }

    this.setData({
      selectedAddressId: addressId,
      shippingAddress: buildMallShippingAddressView(address),
    })

    if (!this.data.autoBack) {
      return
    }

    saveMallCheckoutSelectedAddressId(addressId)
    this.navigateAfterSave()
  },

  onEditAddress(event: WechatMiniprogram.BaseEvent) {
    const addressId = String(event.currentTarget.dataset.id || '')
    const address = this.data.shippingAddressItems.find((item) => item.id === addressId) || null

    if (!address) {
      return
    }

    this.fillAddressForm(address)
    this.setData({
      addressFormVisible: true,
    })
  },

  async onSetDefaultAddress(event: WechatMiniprogram.BaseEvent) {
    const session = getStoredSession()
    const addressId = String(event.currentTarget.dataset.id || '')

    if (!session) {
      this.promptLogin()
      return
    }

    if (!addressId) {
      return
    }

    try {
      const response = await setDefaultMallShippingAddress({
        sessionToken: session.sessionToken,
        addressId,
      })

      this.applyAddressCollection(response.data, addressId)
      wx.showToast({
        title: '已设为默认地址',
        icon: 'success',
      })

      if (this.data.autoBack) {
        setTimeout(() => {
          this.navigateAfterSave()
        }, 280)
      }
    } catch (error) {
      this.handleActionError(error, '设置默认地址失败')
    }
  },

  onDeleteAddress(event: WechatMiniprogram.BaseEvent) {
    const session = getStoredSession()
    const addressId = String(event.currentTarget.dataset.id || '')

    if (!session) {
      this.promptLogin()
      return
    }

    if (!addressId) {
      return
    }

    wx.showModal({
      title: '删除地址',
      content: '删除后这条收货地址将不再参与后续下单，是否继续？',
      success: async ({ confirm }) => {
        if (!confirm) {
          return
        }

        try {
          const response = await deleteMallShippingAddress({
            sessionToken: session.sessionToken,
            addressId,
          })

          this.applyAddressCollection(response.data)
          this.setData({
            addressFormVisible: response.data.items.length === 0,
          })
          wx.showToast({
            title: '地址已删除',
            icon: 'success',
          })
        } catch (error) {
          this.handleActionError(error, '删除地址失败')
        }
      },
    })
  },

  onBack() {
    this.navigateAfterSave()
  },

  onSaveAddress() {
    void this.saveShippingAddress()
  },
})
