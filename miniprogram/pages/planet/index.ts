import { loadPlanets, PlanetProfile } from '../../utils/planet'

Page({
  data: {
    searchValue: '',
    planets: [] as PlanetProfile[],
    displayPlanets: [] as PlanetProfile[],
  },

  onLoad() {
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
    const id = e.currentTarget.dataset.id || 'planet_1'
    const name = e.currentTarget.dataset.name || 'Datawhale'
    const creator = e.currentTarget.dataset.creator || 'Datawhale 团队'

    wx.navigateTo({
      url: `/pages/planet/home?id=${id}&name=${encodeURIComponent(name)}&creator=${encodeURIComponent(creator)}`,
    })
  },

  onBottomNavTap(e: WechatMiniprogram.TouchEvent) {
    const key = e.currentTarget.dataset.key

    if (key === 'discover') {
      wx.redirectTo({
        url: '/pages/planet/lobby',
      })
      return
    }

    if (key === 'mine') {
      wx.redirectTo({
        url: '/pages/planet/mine',
      })
    }
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/planet/create',
    })
  },
})
