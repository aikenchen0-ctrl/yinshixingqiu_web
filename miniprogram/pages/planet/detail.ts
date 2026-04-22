import { loadPlanets, PlanetProfile } from '../../utils/planet'
import { rememberActivePlanetId } from '../../utils/planet-route'

Page({
  data: {
    searchValue: '',
    planets: [] as PlanetProfile[],
    displayPlanets: [] as PlanetProfile[],
  },

  onLoad() {
    wx.redirectTo({
      url: '/pages/planet/index',
    })
    return
  },

  onLoadLegacy() {
    this.refreshPlanets()
  },

  onShow() {
    this.refreshPlanets()
  },

  refreshPlanets() {
    const planets = loadPlanets()
    this.setData({
      planets,
      displayPlanets: planets,
    })
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const searchValue = e.detail.value
    const keyword = searchValue.trim().toLowerCase()
    const displayPlanets = this.data.planets.filter((planet) => {
      if (!keyword) return true
      return planet.name.toLowerCase().includes(keyword)
    })

    this.setData({
      searchValue,
      displayPlanets,
    })
  },

  onPlanetTap(e: WechatMiniprogram.TouchEvent) {
    const id = rememberActivePlanetId(String(e.currentTarget.dataset.id || ''))
    if (!id) {
      return
    }

    const name = e.currentTarget.dataset.name || 'Datawhale AI成长星球'
    const creator = e.currentTarget.dataset.creator || '星主A'

    wx.navigateTo({
      url: `/pages/planet/home?id=${id}&name=${encodeURIComponent(name)}&creator=${encodeURIComponent(creator)}`,
    })
  },

  onBottomNavTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key
    if (key === 'mine') {
      wx.switchTab({
        url: '/pages/profile/index',
      })
      return
    }

    if (key === 'discover') {
      wx.navigateTo({
        url: '/pages/planet/index',
      })
    }
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/planet/create',
    })
  },
})
