/// <reference path="./types/index.d.ts" />

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo,
    isMember?: boolean,
    userSession?: {
      id: string,
      nickname: string,
      mobile: string,
      avatarUrl: string,
      sessionToken: string,
      registeredAt: number,
      lastLoginAt: number,
      expiresAt: number,
    } | null,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}
