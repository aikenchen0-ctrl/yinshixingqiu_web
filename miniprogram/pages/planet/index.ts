import { loadPlanets, PlanetProfile, upsertRemotePlanets } from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { fetchJoinedPlanets, fetchMyPlanets } from '../../utils/planet-api'
import { rememberActivePlanetId } from '../../utils/planet-route'
import { ensureWechatSession } from '../../utils/wechat-login'

interface PlanetListItem extends PlanetProfile {
  avatarText: string
}

const fallbackAvatarClass = 'avatar-sand'

const buildAvatarText = (name: string) => {
  const normalizedName = String(name || '').trim()
  return normalizedName ? normalizedName.slice(0, 1) : '星'
}

const decoratePlanet = (planet: PlanetProfile): PlanetListItem => ({
  ...planet,
  avatarClass: planet.avatarClass || fallbackAvatarClass,
  avatarImageUrl: typeof planet.avatarImageUrl === 'string' ? planet.avatarImageUrl.trim() : '',
  avatarText: buildAvatarText(planet.name),
})

const filterPlanets = (planets: PlanetListItem[], keyword: string) => {
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
    allPlanets: [] as PlanetListItem[],
    joinedPlanets: [] as PlanetListItem[],
    userPlanets: [] as PlanetListItem[],
    searchResults: [] as PlanetListItem[],
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
      // 饮视星球首页不阻塞主流程，静默登录失败时由“我的”页兜底重试
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
    const myPlanetIdSet = new Set(this.data.myPlanetIds)
    const userPlanets = localPlanets.filter((planet) => myPlanetIdSet.has(planet.id)).map(decoratePlanet)
    const joinedPlanetIdSet = new Set(this.data.joinedPlanetIds)
    const joinedPlanets = localPlanets.filter(
      (planet) => joinedPlanetIdSet.has(planet.id) && !myPlanetIdSet.has(planet.id)
    ).map(decoratePlanet)
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

  clearAvatarById(list: PlanetListItem[], planetId: string) {
    return list.map((planet) =>
      planet.id === planetId
        ? {
            ...planet,
            avatarImageUrl: '',
          }
        : planet
    )
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

  onAvatarError(e: WechatMiniprogram.CustomEvent) {
    const planetId = String(e.currentTarget.dataset.id || '')
    if (!planetId) {
      return
    }

    this.setData({
      allPlanets: this.clearAvatarById(this.data.allPlanets, planetId),
      joinedPlanets: this.clearAvatarById(this.data.joinedPlanets, planetId),
      userPlanets: this.clearAvatarById(this.data.userPlanets, planetId),
      searchResults: this.clearAvatarById(this.data.searchResults, planetId),
    })
  },

  onPlanetTap(e: WechatMiniprogram.TouchEvent) {
    const id = rememberActivePlanetId(String(e.currentTarget.dataset.id || ''))
    if (!id) {
      return
    }

    const name = e.currentTarget.dataset.name || 'Datawhale AI成长星球'
    const creator = e.currentTarget.dataset.creator || '星主A'
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
