import { getPlanetById, PlanetProfile } from '../../utils/planet'
import { getStoredSession } from '../../utils/auth'
import { fetchPlanetHome } from '../../utils/planet-api'
import { navigateToPlanetIndex, resolvePlanetIdFromOptions } from '../../utils/planet-route'
import { normalizeAssetUrl } from '../../utils/request'

const fallbackPlanet: PlanetProfile = {
  id: 'grp_datawhale_001',
  name: 'Datawhale AI成长星球',
  avatarClass: 'avatar-sunset',
  avatarImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
  coverImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80',
  unread: '',
  badge: '',
  price: 50,
  priceLabel: '¥ 50/年',
  joinType: 'rolling',
  isFree: false,
  requireInviteCode: false,
  ownerName: '星主A',
  ownerTagline: 'Datawhale 星球主理人',
  category: 'AI学习',
  intro: '一个围绕 AI 学习与实践的付费星球',
  embedPath: 'pages/topics/topics?group_id=grp_datawhale_001',
  memberCount: 6,
  postCount: 3,
  createdAt: '2026/03/01',
}

Page({
  data: {
    planet: fallbackPlanet,
  },

  onLoad(options: Record<string, string>) {
    const planetId = resolvePlanetIdFromOptions(options, ['id', 'planetId', 'groupId'])
    if (!planetId) {
      navigateToPlanetIndex('请先选择星球')
      return
    }

    const planet = getPlanetById(planetId)

    if (planet) {
      this.setData({
        planet: {
          ...planet,
          ownerName: planet.ownerName.replace(/老师$/, ''),
        },
      })
    }

    void this.syncEmbedPlanet(planetId)
  },

  async syncEmbedPlanet(planetId: string) {
    if (!planetId) {
      return
    }

    const session = getStoredSession()
    const localPlanet = getPlanetById(planetId) || this.data.planet || fallbackPlanet

    try {
      const response = await fetchPlanetHome({
        groupId: planetId,
        sessionToken: session && session.sessionToken ? session.sessionToken : '',
        userId: session && session.id ? session.id : '',
      })

      if (!response.ok || !response.data || !response.data.group || !response.data.owner) {
        return
      }

      const group = response.data.group
      const owner = response.data.owner
      const priceAmount = Number(group.priceAmount || localPlanet.price || 0)

      this.setData({
        planet: {
          id: planetId,
          name: String(group.name || localPlanet.name || '饮视星球'),
          avatarClass: localPlanet.avatarClass || 'avatar-sunset',
          avatarImageUrl: normalizeAssetUrl(
            String(group.avatarUrl || owner.avatarUrl || localPlanet.avatarImageUrl || fallbackPlanet.avatarImageUrl)
          ),
          coverImageUrl: normalizeAssetUrl(
            String(group.coverUrl || group.avatarUrl || localPlanet.coverImageUrl || fallbackPlanet.coverImageUrl)
          ),
          unread: localPlanet.unread || '',
          badge: localPlanet.badge || '',
          price: priceAmount,
          priceLabel: group.joinType === 'FREE' ? '免费加入' : `¥ ${priceAmount}/年`,
          joinType: group.billingPeriod === 'YEAR' ? 'rolling' : 'calendar',
          isFree: group.joinType === 'FREE',
          requireInviteCode: group.joinType === 'INVITE_ONLY',
          ownerName: String(owner.nickname || localPlanet.ownerName || '星主').replace(/老师$/, ''),
          ownerTagline: String(owner.bio || localPlanet.ownerTagline || ''),
          category: localPlanet.category || fallbackPlanet.category,
          intro: String(group.intro || localPlanet.intro || ''),
          embedPath: localPlanet.embedPath || fallbackPlanet.embedPath,
          memberCount: Number(group.memberCount || localPlanet.memberCount || 0),
          postCount: Number(group.contentCount || localPlanet.postCount || 0),
          createdAt: String(group.createdAt || localPlanet.createdAt || '').slice(0, 10),
          joined: typeof localPlanet.joined === 'boolean' ? localPlanet.joined : false,
        },
      })
    } catch {
      // 嵌入页优先保证可展示，资料同步失败时保留本地回退数据
    }
  },

  onCopyPath() {
    wx.setClipboardData({
      data: this.data.planet.embedPath,
    })
  },

  onSavePoster() {
    wx.showLoading({
      title: '保存中',
      mask: true,
    })

    wx.downloadFile({
      url: this.data.planet.coverImageUrl,
      success: (downloadRes) => {
        if (downloadRes.statusCode !== 200) {
          wx.hideLoading()
          wx.showToast({
            title: '图片下载失败',
            icon: 'none',
          })
          return
        }

        wx.saveImageToPhotosAlbum({
          filePath: downloadRes.tempFilePath,
          success: () => {
            wx.hideLoading()
            wx.showToast({
              title: '图片已保存',
              icon: 'success',
            })
          },
          fail: () => {
            wx.hideLoading()
            wx.showModal({
              title: '无法保存图片',
              content: '请允许保存到相册后重试。',
              confirmText: '去设置',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting({})
                }
              },
            })
          },
        })
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({
          title: '图片下载失败',
          icon: 'none',
        })
      },
    })
  },
})
