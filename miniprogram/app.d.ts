import type { UserSession } from './utils/auth'

declare global {
  interface IAppOption {
    globalData: {
      isMember: boolean
      userSession: UserSession | null
    }
  }
}

export {}
