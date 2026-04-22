import { getStoredSession } from '../../utils/auth'
import { createLocalPlanetColumn, getLocalPlanetColumnDetail, listLocalPlanetColumns } from '../../utils/column'
import { createPlanetColumn, fetchColumnDetail, fetchPlanetColumns } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'

interface ColumnItem {
  id: string
  title: string
  count: number
  expanded: boolean
  loading: boolean
  loaded: boolean
  items: string[]
}

Page({
  data: {
    groupId: '',
    groupName: '专栏',
    totalColumnsText: '0',
    canCreateColumn: false,
    loading: true,
    columns: [] as ColumnItem[],
    createPopupVisible: false,
    createTitle: '',
    creating: false,
  },

  onLoad(options: Record<string, string | undefined>) {
    const groupId = resolvePlanetIdFromOptions(options, ['groupId', 'planetId'])
    if (!groupId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    this.setData({ groupId })
    void this.loadColumns()
  },

  async loadColumns() {
    if (!this.data.groupId) {
      this.setData({ loading: false })
      wx.showToast({ title: '缺少星球ID', icon: 'none' })
      return
    }

    const session = getStoredSession()
    this.setData({ loading: true })

    try {
      const timeout = setTimeout(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '请求超时，请检查网络', icon: 'none' })
      }, 5000)

      const response = await fetchPlanetColumns({
        groupId: this.data.groupId,
        sessionToken: session ? session.sessionToken : '',
        userId: session ? session.id : '',
      })

      clearTimeout(timeout)

      if (!response.ok || !response.data) {
        throw new Error('获取专栏列表失败')
      }

      const payload = response.data
      const columns: ColumnItem[] = payload.items.map((item) => ({
        id: item.id,
        title: item.title,
        count: item.count,
        expanded: false,
        loading: false,
        loaded: false,
        items: [],
      }))

      this.setData({
        loading: false,
        groupName: payload.groupName || '专栏',
        totalColumnsText: String(payload.totalColumns),
        canCreateColumn: payload.canCreateColumn === true,
        columns,
      })
    } catch {
      const localColumns = listLocalPlanetColumns(this.data.groupId)
      const columns: ColumnItem[] = localColumns.items.map((item) => ({
        id: item.id,
        title: item.title,
        count: item.count,
        expanded: false,
        loading: false,
        loaded: false,
        items: [],
      }))

      this.setData({
        loading: false,
        groupName: localColumns.groupName || '专栏',
        totalColumnsText: String(localColumns.totalColumns),
        canCreateColumn: localColumns.canCreateColumn === true,
        columns,
      })
    }
  },

  async loadColumnDetail(columnId: string) {
    if (!columnId || !this.data.groupId) return

    const currentColumn = this.data.columns.find((item) => item.id === columnId)
    if (!currentColumn || currentColumn.loading || currentColumn.loaded) return

    const session = getStoredSession()
    const loadingColumns = this.data.columns.map((item) =>
      item.id === columnId ? { ...item, loading: true } : item
    )
    this.setData({ columns: loadingColumns })

    try {
      const timeout = setTimeout(() => {
        const nextColumns = this.data.columns.map((item) =>
          item.id === columnId ? { ...item, loading: false } : item
        )
        this.setData({ columns: nextColumns })
        wx.showToast({ title: '请求超时', icon: 'none' })
      }, 5000)

      const response = await fetchColumnDetail({
        columnId,
        groupId: this.data.groupId,
        sessionToken: session ? session.sessionToken : '',
        userId: session ? session.id : '',
      })

      clearTimeout(timeout)

      if (!response.ok || !response.data) {
        throw new Error('加载失败')
      }

      const payload = response.data
      const items = payload.items.map((item) => {
        const text = String(item.title || item.content || '').trim()
        return text.length > 48 ? `${text.slice(0, 48)}...` : text
      })

      const nextColumns = this.data.columns.map((item) =>
        item.id === columnId ? { ...item, loading: false, loaded: true, items } : item
      )
      this.setData({ columns: nextColumns })
    } catch {
      const localDetail = getLocalPlanetColumnDetail(columnId, this.data.groupId)
      if (localDetail) {
        const nextColumns = this.data.columns.map((item) =>
          item.id === columnId ? { ...item, loading: false, loaded: true, items: localDetail.items } : item
        )
        this.setData({ columns: nextColumns })
        return
      }

      const nextColumns = this.data.columns.map((item) =>
        item.id === columnId ? { ...item, loading: false } : item
      )
      this.setData({ columns: nextColumns })
    }
  },

  onToggleColumn(e: WechatMiniprogram.TouchEvent) {
    const id = String(e.currentTarget.dataset.id || '')
    if (!id) return

    const targetColumn = this.data.columns.find((column) => column.id === id)
    if (!targetColumn) return

    const nextExpanded = !targetColumn.expanded

    const nextColumns = this.data.columns.map((column) =>
      column.id === id ? { ...column, expanded: nextExpanded } : { ...column, expanded: false }
    )

    this.setData({ columns: nextColumns })

    if (nextExpanded) {
      void this.loadColumnDetail(id)
    }
  },

  onOpenCreatePopup() {
    if (!this.data.canCreateColumn || this.data.creating) {
      return
    }

    this.setData({
      createPopupVisible: true,
      createTitle: '',
    })
  },

  onCloseCreatePopup() {
    if (this.data.creating) {
      return
    }

    this.setData({
      createPopupVisible: false,
      createTitle: '',
    })
  },

  onCreatePopupTap() {},

  onCreateTitleInput(e: WechatMiniprogram.Input) {
    this.setData({
      createTitle: String(e.detail.value || '').slice(0, 24),
    })
  },

  async onCreateColumnConfirm() {
    const title = this.data.createTitle.trim()
    if (!title) {
      wx.showToast({
        title: '请输入专栏标题',
        icon: 'none',
      })
      return
    }

    if (!this.data.groupId) {
      wx.showToast({
        title: '缺少星球ID',
        icon: 'none',
      })
      return
    }

    const session = getStoredSession()

    this.setData({
      creating: true,
    })

    wx.showLoading({
      title: '创建中',
      mask: true,
    })

    try {
      let useLocalFallback = false

      try {
        if (!session || !session.sessionToken || !session.id) {
          throw new Error('使用本地专栏创建')
        }

        const response = await createPlanetColumn({
          groupId: this.data.groupId,
          title,
          sessionToken: session.sessionToken,
          userId: session.id,
        })

        if (!response.ok || !response.data) {
          throw new Error('创建专栏失败')
        }
      } catch {
        useLocalFallback = true
        createLocalPlanetColumn({
          groupId: this.data.groupId,
          title,
        })
      }

      wx.hideLoading()
      this.setData({
        createPopupVisible: false,
        createTitle: '',
        creating: false,
      })

      wx.showToast({
        title: useLocalFallback ? '已创建本地专栏' : '专栏已创建',
        icon: 'success',
      })

      await this.loadColumns()
    } catch (error) {
      wx.hideLoading()
      this.setData({
        creating: false,
      })

      wx.showToast({
        title: error instanceof Error ? error.message : '创建专栏失败',
        icon: 'none',
      })
    }
  },
})
