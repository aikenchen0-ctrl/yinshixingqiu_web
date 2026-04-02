import { loadPlanets, PlanetProfile, upsertRemotePlanets } from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { fetchJoinedPlanets, fetchMyPlanets } from '../../utils/planet-api'
import { ensureWechatSession } from '../../utils/wechat-login'

const filterPlanets = (planets: PlanetProfile[], keyword: string) => {
  if (!keyword) {
    return planets
  }

  return planets.filter((planet) => planet.name.toLowerCase().includes(keyword))
}

Page({
  data: {
    searchValue: '',
    joinedPlanetIds: [] as string[],
    myPlanetIds: [] as string[],
    allPlanets: [] as PlanetProfile[],
    joinedPlanets: [] as PlanetProfile[],
    userPlanets: [] as PlanetProfile[],
    searchResults: [] as PlanetProfile[],
  },

  onLoad() {
    this.refreshPlanets()
    void this.syncPlanetsFromServer()
  },

  onShow() {
    this.refreshPlanets()
    void this.syncPlanetsFromServer()
  },

  async ensurePlanetSession() {
    const session = getStoredSession()
    if (session && session.sessionToken) {
      return session
    }

    try {
      return await ensureWechatSession()
    } catch {
      // 知识星球首页不阻塞主流程，静默登录失败时由“我的”页兜底重试
      return null
    }
  },

  async syncPlanetsFromServer() {
    const session = await this.ensurePlanetSession()

    if (!session || !session.sessionToken) {
      this.setData({
        joinedPlanetIds: [],
        myPlanetIds: [],
      })
      this.refreshPlanets()
      return
    }

    try {
      const [joinedResponse, myResponse] = await Promise.all([
        fetchJoinedPlanets(session.sessionToken),
        fetchMyPlanets(session.sessionToken),
      ])

      if (
        !joinedResponse.ok ||
        !Array.isArray(joinedResponse.data) ||
        !myResponse.ok ||
        !Array.isArray(myResponse.data)
      ) {
        return
      }

      const joinedPlanetIds = joinedResponse.data.map((planet) => planet.id)
      const myPlanetIds = myResponse.data.map((planet) => planet.id)

      upsertRemotePlanets(
        joinedResponse.data.map((planet) => ({
          ...planet,
          joined: true,
        }))
      )
      upsertRemotePlanets(
        myResponse.data.map((planet) => ({
          ...planet,
          joined: true,
        }))
      )
      this.setData({
        joinedPlanetIds,
        myPlanetIds,
      })
      this.refreshPlanets()
    } catch {
      // 星球首页优先保证可用，接口失败时保留本地缓存展示
    }
  },

  refreshPlanets() {
    const localPlanets = loadPlanets()
    const joinedPlanetIdSet = new Set(this.data.joinedPlanetIds)
    const myPlanetIdSet = new Set(this.data.myPlanetIds)
    const joinedPlanets = localPlanets.filter((planet) => joinedPlanetIdSet.has(planet.id))
    const userPlanets = localPlanets.filter((planet) => myPlanetIdSet.has(planet.id))
    const visiblePlanets = [...joinedPlanets]

    userPlanets.forEach((planet) => {
      if (!visiblePlanets.some((item) => item.id === planet.id)) {
        visiblePlanets.push(planet)
      }
    })

    const keyword = this.data.searchValue.trim().toLowerCase()
    const searchResults = filterPlanets(visiblePlanets, keyword)

    this.setData({
      allPlanets: visiblePlanets,
      joinedPlanets,
      userPlanets,
      searchResults,
    })
  },

  onSearchInput(e: WechatMiniprogram.Input) {
    const searchValue = e.detail.value
    const keyword = searchValue.trim().toLowerCase()
    const searchResults = filterPlanets(this.data.allPlanets, keyword)

    this.setData({
      searchValue,
      searchResults,
    })
  },

  onPlanetTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id || 'planet_1'
    const name = e.currentTarget.dataset.name || 'Datawhale'
    const creator = e.currentTarget.dataset.creator || 'Datawhale 团队'
    const joined = !!e.currentTarget.dataset.joined
    const source = joined ? 'joined' : 'discover'

    wx.navigateTo({
      url: `/pages/planet/home?id=${id}&name=${encodeURIComponent(name)}&creator=${encodeURIComponent(creator)}&source=${source}`,
    })
  },

  onPlanetTabChange(e: WechatMiniprogram.CustomEvent<{ key: string }>) {
    const key = String((e.detail && e.detail.key) || '')

    if (!key || key === 'planet') {
      return
    }

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
      return
    }

    if (key === 'debug') {
      wx.redirectTo({
        url: '/pages/planet/debug',
      })
    }
  },

  goCreate() {
    wx.navigateTo({
      url: '/pages/planet/create',
    })
  },
})
