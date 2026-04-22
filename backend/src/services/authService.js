const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { mapErrorToResponse } = require("../utils/error");
const { exchangeLoginCode, fetchPhoneNumber } = require("./wechatService");

const SESSION_TTL_DAYS = 30;
const DEV_AUTH_MULTI_ACCOUNT =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_AUTH_MULTI_ACCOUNT !== "0";
const PHONE_LOGIN_RESULT_TTL_MS = 10 * 60 * 1000;
const WEB_BOSS_ACCOUNT_ENV_KEYS = ["WEB_BOSS_ACCOUNT", "WEB_ADMIN_BOSS_ACCOUNT"];
const WEB_BOSS_MOBILE_ENV_KEYS = ["WEB_BOSS_MOBILE", "WEB_ADMIN_BOSS_MOBILE"];
const WEB_BOSS_NICKNAME_ENV_KEYS = ["WEB_BOSS_NICKNAME", "WEB_ADMIN_BOSS_NICKNAME"];
const WEB_BOSS_AVATAR_ENV_KEYS = ["WEB_BOSS_AVATAR_URL", "WEB_ADMIN_BOSS_AVATAR_URL"];
const DEFAULT_DEV_WEB_BOSS_ACCOUNT = "boss";
const DEFAULT_DEV_WEB_BOSS_MOBILE = "18888888888";
const DEFAULT_DEV_WEB_BOSS_NICKNAME = "Boss";

const phoneLoginRequestCache = new Map();

function getSessionExpireAt() {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function buildAvatarUrl(nickname) {
  const encoded = encodeURIComponent(nickname || "user");
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encoded}`;
}

function buildSessionPayload(user, profile, session) {
  return {
    id: user.id,
    nickname: profile.nickname,
    mobile: user.mobile || "",
    avatarUrl: profile.avatarUrl || "",
    sessionToken: session.sessionToken,
    registeredAt: user.createdAt.getTime(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.getTime() : Date.now(),
    expiresAt: session.expiresAt.getTime(),
  };
}

function buildWechatIdentityKeys(wechatIdentity, mobile) {
  if (!DEV_AUTH_MULTI_ACCOUNT) {
    return {
      openId: wechatIdentity.openId,
      unionId: wechatIdentity.unionId,
    };
  }

  const mobileSuffix = String(mobile || "").trim();
  return {
    openId: `${wechatIdentity.openId}::${mobileSuffix}`,
    unionId: wechatIdentity.unionId ? `${wechatIdentity.unionId}::${mobileSuffix}` : null,
  };
}

function selectExistingUserForLogin(input = {}) {
  const normalizedMobile = input.normalizedMobile || null;
  const existingByMobile = input.existingByMobile || null;
  const existingByOpenId = input.existingByOpenId || null;
  const preferredDevUser = input.preferredDevUser || null;
  const fallbackDevUser = input.fallbackDevUser || null;

  if (existingByMobile) {
    return existingByMobile;
  }

  if (existingByOpenId && existingByOpenId.mobile) {
    return existingByOpenId;
  }

  if (!normalizedMobile) {
    return existingByOpenId || null;
  }

  return preferredDevUser || existingByOpenId || fallbackDevUser || null;
}

function normalizeMobile(mobile) {
  const mobileValue = String(mobile || "").trim();
  return /^1\d{10}$/.test(mobileValue) ? mobileValue : null;
}

function normalizeAccount(value) {
  return String(value || "").trim().toLowerCase();
}

function readFirstEnvValue(envKeys, normalizer = (value) => String(value || "").trim()) {
  for (const envKey of envKeys) {
    const rawValue = process.env[envKey];
    const normalizedValue = normalizer(rawValue);
    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
}

function resolveWebBossConfig() {
  const configuredAccount = readFirstEnvValue(WEB_BOSS_ACCOUNT_ENV_KEYS, normalizeAccount);
  const configuredMobile = readFirstEnvValue(WEB_BOSS_MOBILE_ENV_KEYS, normalizeMobile);
  const configuredNickname = readFirstEnvValue(WEB_BOSS_NICKNAME_ENV_KEYS);
  const configuredAvatarUrl = readFirstEnvValue(WEB_BOSS_AVATAR_ENV_KEYS);
  const hasExplicitConfig = Boolean(configuredAccount && configuredMobile);

  if (hasExplicitConfig) {
    const nickname = configuredNickname || DEFAULT_DEV_WEB_BOSS_NICKNAME;
    return {
      enabled: true,
      account: configuredAccount,
      mobile: configuredMobile,
      nickname,
      avatarUrl: configuredAvatarUrl || buildAvatarUrl(nickname),
      source: "ENV",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    return {
      enabled: true,
      account: DEFAULT_DEV_WEB_BOSS_ACCOUNT,
      mobile: DEFAULT_DEV_WEB_BOSS_MOBILE,
      nickname: DEFAULT_DEV_WEB_BOSS_NICKNAME,
      avatarUrl: buildAvatarUrl(DEFAULT_DEV_WEB_BOSS_NICKNAME),
      source: "DEV_DEFAULT",
    };
  }

  return {
    enabled: false,
    account: "",
    mobile: "",
    nickname: "",
    avatarUrl: "",
    source: "DISABLED",
  };
}

function matchesWebBossAccount(account) {
  const bossConfig = resolveWebBossConfig();
  return bossConfig.enabled && normalizeAccount(account) === bossConfig.account;
}

async function findLatestDevUserByWechatIdentity(tx, wechatIdentity) {
  if (!DEV_AUTH_MULTI_ACCOUNT) {
    return null;
  }

  const candidates = await tx.user.findMany({
    where: {
      OR: [
        {
          openId: {
            startsWith: `${wechatIdentity.openId}::`,
          },
        },
        wechatIdentity.unionId
          ? {
              unionId: {
                startsWith: `${wechatIdentity.unionId}::`,
              },
            }
          : undefined,
      ].filter(Boolean),
    },
    include: {
      profile: true,
    },
    orderBy: [{ lastLoginAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1,
  });

  return candidates[0] || null;
}

async function findPreferredDevUserByWechatIdentity(tx, wechatIdentity) {
  if (!DEV_AUTH_MULTI_ACCOUNT) {
    return null;
  }

  const candidates = await tx.user.findMany({
    where: {
      OR: [
        {
          openId: {
            startsWith: `${wechatIdentity.openId}::`,
          },
        },
        wechatIdentity.unionId
          ? {
              unionId: {
                startsWith: `${wechatIdentity.unionId}::`,
              },
            }
          : undefined,
      ].filter(Boolean),
    },
    include: {
      profile: true,
    },
    orderBy: [{ lastLoginAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const mobileBoundUser = candidates.find((item) => Boolean(item.mobile));
  return mobileBoundUser || candidates[0] || null;
}

async function findAnonymousDevUserByWechatIdentity(tx, wechatIdentity, excludeUserId) {
  if (!DEV_AUTH_MULTI_ACCOUNT) {
    return null;
  }

  const candidates = await tx.user.findMany({
    where: {
      id: excludeUserId
        ? {
            not: excludeUserId,
          }
        : undefined,
      OR: [
        {
          openId: `${wechatIdentity.openId}::`,
        },
        wechatIdentity.unionId
          ? {
              unionId: `${wechatIdentity.unionId}::`,
            }
          : undefined,
      ].filter(Boolean),
    },
    include: {
      members: true,
    },
    orderBy: [{ lastLoginAt: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    take: 1,
  });

  return candidates[0] || null;
}

async function migrateAnonymousDevMemberships(tx, fromUserId, toUserId, mobile) {
  const memberships = await tx.groupMember.findMany({
    where: {
      userId: fromUserId,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  for (const membership of memberships) {
    const existingTargetMembership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId: membership.groupId,
          userId: toUserId,
        },
      },
    });

    if (existingTargetMembership) {
      const nextExpireAt =
        membership.expireAt &&
        (!existingTargetMembership.expireAt ||
          new Date(membership.expireAt).getTime() > new Date(existingTargetMembership.expireAt).getTime())
          ? membership.expireAt
          : existingTargetMembership.expireAt;

      await tx.groupMember.update({
        where: { id: existingTargetMembership.id },
        data: {
          status:
            existingTargetMembership.status === "ACTIVE" || membership.status !== "ACTIVE"
              ? existingTargetMembership.status
              : membership.status,
          isPaid: existingTargetMembership.isPaid || membership.isPaid,
          expireAt: nextExpireAt,
          joinedAt:
            existingTargetMembership.joinedAt &&
            membership.joinedAt &&
            new Date(existingTargetMembership.joinedAt).getTime() <
              new Date(membership.joinedAt).getTime()
              ? existingTargetMembership.joinedAt
              : membership.joinedAt || existingTargetMembership.joinedAt,
          firstJoinedAt:
            existingTargetMembership.firstJoinedAt || membership.firstJoinedAt || membership.joinedAt,
          lastActiveAt: membership.lastActiveAt || existingTargetMembership.lastActiveAt,
          renewTimes: Math.max(existingTargetMembership.renewTimes, membership.renewTimes),
          phone: mobile || existingTargetMembership.phone || membership.phone,
          wechatNo: existingTargetMembership.wechatNo || membership.wechatNo,
          sourceOrderId: existingTargetMembership.sourceOrderId || membership.sourceOrderId,
        },
      });

      await tx.groupMember.delete({
        where: { id: membership.id },
      });
      continue;
    }

    await tx.groupMember.update({
      where: { id: membership.id },
      data: {
        userId: toUserId,
        phone: mobile || membership.phone,
      },
    });
  }

  await tx.authSession.updateMany({
    where: {
      userId: fromUserId,
      status: "ACTIVE",
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });
}

function cleanupPhoneLoginRequestCache() {
  const now = Date.now();

  phoneLoginRequestCache.forEach((entry, requestId) => {
    if (entry.expiresAt <= now) {
      phoneLoginRequestCache.delete(requestId);
    }
  });
}

function getCachedPhoneLoginResult(requestId) {
  cleanupPhoneLoginRequestCache();
  return phoneLoginRequestCache.get(requestId) || null;
}

function cachePhoneLoginPromise(requestId, promise) {
  phoneLoginRequestCache.set(requestId, {
    promise,
    expiresAt: Date.now() + PHONE_LOGIN_RESULT_TTL_MS,
  });
}

function cachePhoneLoginResult(requestId, result) {
  phoneLoginRequestCache.set(requestId, {
    result,
    expiresAt: Date.now() + PHONE_LOGIN_RESULT_TTL_MS,
  });
}

async function exchangeWechatIdentity(loginCode) {
  if (!loginCode) {
    throw new Error("缺少微信登录 code");
  }

  const wechatIdentity = await exchangeLoginCode(loginCode);
  console.log("[authService] code2session ok", {
    openId: wechatIdentity.openId,
    hasUnionId: Boolean(wechatIdentity.unionId),
  });
  return wechatIdentity;
}

async function createOrLoginSession(input) {
  const { loginCode, wechatIdentity, nickname, mobile, avatarUrl } = input;
  const normalizedMobile = normalizeMobile(mobile);

  if (mobile && !normalizedMobile) {
    return { statusCode: 400, payload: { ok: false, message: "手机号格式不正确" } };
  }

  const result = await prisma.$transaction(async (tx) => {
    const identityKeys = buildWechatIdentityKeys(wechatIdentity, normalizedMobile);

    const existingByMobile = normalizedMobile
      ? await tx.user.findUnique({
          where: { mobile: normalizedMobile },
          include: { profile: true },
        })
      : null;

    const existingByOpenId = await tx.user.findUnique({
      where: { openId: identityKeys.openId },
      include: { profile: true },
    });

    const preferredDevUser =
      !normalizedMobile && !existingByMobile
        ? await findPreferredDevUserByWechatIdentity(tx, wechatIdentity)
        : null;

    const fallbackDevUser =
      !normalizedMobile && !existingByMobile && !existingByOpenId
        ? preferredDevUser || (await findLatestDevUserByWechatIdentity(tx, wechatIdentity))
        : null;

    if (existingByMobile && existingByOpenId && existingByMobile.id !== existingByOpenId.id) {
      return {
        error: {
          statusCode: 409,
          payload: {
            ok: false,
            message: DEV_AUTH_MULTI_ACCOUNT
              ? "该手机号已绑定其他测试账号，请更换手机号后再试"
              : "该微信账号与手机号已分别绑定不同账户，请确认后再登录",
          },
        },
      };
    }

    let user = selectExistingUserForLogin({
      normalizedMobile,
      existingByMobile,
      existingByOpenId,
      preferredDevUser,
      fallbackDevUser,
    });
    const shouldPreserveDevIdentityKeys =
      DEV_AUTH_MULTI_ACCOUNT &&
      !normalizedMobile &&
      Boolean(user && user.mobile) &&
      Boolean(user && user.openId);
    const nextOpenId = shouldPreserveDevIdentityKeys ? user.openId : identityKeys.openId;
    const nextUnionId = shouldPreserveDevIdentityKeys ? user.unionId : identityKeys.unionId;
    const fallbackNickname = `微信用户${wechatIdentity.openId.slice(-4)}`;
    const finalNickname =
      (nickname && nickname.trim()) ||
      (user && user.profile ? user.profile.nickname : "") ||
      fallbackNickname;
    const finalAvatarUrl =
      (avatarUrl && avatarUrl.trim()) ||
      (user && user.profile ? user.profile.avatarUrl : "") ||
      buildAvatarUrl(finalNickname);

    if (!user) {
      user = await tx.user.create({
        data: {
          mobile: normalizedMobile,
          openId: nextOpenId,
          unionId: nextUnionId,
          lastLoginAt: new Date(),
          profile: {
            create: {
              nickname: finalNickname,
              avatarUrl: finalAvatarUrl,
            },
          },
        },
        include: { profile: true },
      });
    } else {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          mobile: normalizedMobile || user.mobile,
          openId: nextOpenId,
          unionId: nextUnionId,
          lastLoginAt: new Date(),
          profile: {
            upsert: {
              update: {
                nickname: finalNickname,
                avatarUrl: finalAvatarUrl,
              },
              create: {
                nickname: finalNickname,
                avatarUrl: finalAvatarUrl,
              },
            },
          },
        },
        include: { profile: true },
      });
    }

    if (normalizedMobile) {
      const anonymousDevUser = await findAnonymousDevUserByWechatIdentity(
        tx,
        wechatIdentity,
        user.id
      );

      if (anonymousDevUser) {
        await migrateAnonymousDevMemberships(
          tx,
          anonymousDevUser.id,
          user.id,
          normalizedMobile
        );
      }
    }

    await tx.authSession.updateMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
      },
    });

    const session = await tx.authSession.create({
      data: {
        userId: user.id,
        sessionToken: crypto.randomBytes(24).toString("hex"),
        loginCode,
        sessionKey: wechatIdentity.sessionKey,
        expiresAt: getSessionExpireAt(),
      },
    });

    return { user, session };
  });

  if (result.error) {
    return result.error;
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildSessionPayload(result.user, result.user.profile, result.session),
    },
  };
}

async function loginOrRegister(input) {
  const { loginCode, nickname, mobile, avatarUrl } = input;

  try {
    const wechatIdentity = await exchangeWechatIdentity(loginCode);
    return await createOrLoginSession({
      loginCode,
      wechatIdentity,
      nickname,
      mobile,
      avatarUrl,
    });
  } catch (error) {
    console.error("[authService] code2session failed", error.message || error);
    const mappedError = mapErrorToResponse(error, "微信登录暂不可用");
    return {
      statusCode: mappedError.statusCode,
      payload: {
        ok: false,
        message: mappedError.message,
      },
    };
  }
}

async function runPhoneLogin(input) {
  const { loginCode, phoneCode } = input;
  const wechatIdentity = await exchangeWechatIdentity(loginCode);
  const phoneResult = await fetchPhoneNumber(phoneCode);

  return createOrLoginSession({
    loginCode,
    wechatIdentity,
    mobile: phoneResult.phoneNumber,
  });
}

async function loginOrRegisterByPhone(input) {
  const { loginCode, phoneCode, requestId } = input;

  if (!phoneCode) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少手机号授权 code",
      },
    };
  }

  if (!requestId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少请求标识",
      },
    };
  }

  const cachedEntry = getCachedPhoneLoginResult(requestId);
  if (cachedEntry) {
    if (cachedEntry.result) {
      return cachedEntry.result;
    }

    if (cachedEntry.promise) {
      return cachedEntry.promise;
    }
  }

  const phoneLoginPromise = runPhoneLogin({
    loginCode,
    phoneCode,
  })
    .then((result) => {
      cachePhoneLoginResult(requestId, result);
      return result;
    })
    .catch((error) => {
      phoneLoginRequestCache.delete(requestId);
      console.error("[authService] phone login failed", error.message || error);
      const mappedError = mapErrorToResponse(error, "手机号一键登录暂不可用");
      return {
        statusCode: mappedError.statusCode,
        payload: {
          ok: false,
          message: mappedError.message,
        },
      };
    });

  cachePhoneLoginPromise(requestId, phoneLoginPromise);
  return phoneLoginPromise;
}

async function getSessionProfile(sessionToken) {
  const sessionResult = await resolveActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildSessionPayload(session.user, session.user.profile, session),
    },
  };
}

async function createWebSessionForUser(tx, userId, loginCode) {
  await tx.authSession.updateMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });

  return tx.authSession.create({
    data: {
      userId,
      sessionToken: crypto.randomBytes(24).toString("hex"),
      loginCode,
      sessionKey: "",
      expiresAt: getSessionExpireAt(),
    },
  });
}

async function resolveActiveSession(sessionToken) {
  if (!sessionToken) {
    return {
      error: {
        statusCode: 401,
        payload: {
          ok: false,
          message: "缺少登录态",
        },
      },
    };
  }

  const session = await prisma.authSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!session || session.status !== "ACTIVE") {
    return {
      error: {
        statusCode: 401,
        payload: {
          ok: false,
          message: "登录态无效",
        },
      },
    };
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        status: "EXPIRED",
      },
    });

    return {
      error: {
        statusCode: 401,
        payload: {
          ok: false,
          message: "登录态已过期",
        },
      },
    };
  }

  return { session };
}

async function updateSessionProfile(input) {
  const sessionToken = String((input && input.sessionToken) || "").trim();
  const nickname = String((input && input.nickname) || "").trim();
  const avatarUrl = String((input && input.avatarUrl) || "").trim();

  if (!nickname && !avatarUrl) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少可更新的资料",
      },
    };
  }

  const sessionResult = await resolveActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;
  const currentProfile = session.user && session.user.profile ? session.user.profile : null;
  const nextNickname =
    nickname ||
    (currentProfile && currentProfile.nickname ? String(currentProfile.nickname).trim() : "") ||
    `微信用户${String(session.user.id || "").slice(-4)}`;
  const nextAvatarUrl =
    avatarUrl ||
    (currentProfile && currentProfile.avatarUrl ? String(currentProfile.avatarUrl).trim() : "");

  const updatedUser = await prisma.user.update({
    where: {
      id: session.user.id,
    },
    data: {
      profile: {
        upsert: {
          update: {
            nickname: nextNickname,
            avatarUrl: nextAvatarUrl,
          },
          create: {
            nickname: nextNickname,
            avatarUrl: nextAvatarUrl,
          },
        },
      },
    },
    include: {
      profile: true,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildSessionPayload(updatedUser, updatedUser.profile, session),
    },
  };
}

async function logoutSession(sessionToken) {
  if (!sessionToken) {
    return { statusCode: 400, payload: { ok: false, message: "缺少登录态" } };
  }

  await prisma.authSession.updateMany({
    where: {
      sessionToken,
      status: "ACTIVE",
    },
    data: {
      status: "REVOKED",
      revokedAt: new Date(),
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      message: "已退出登录",
    },
  };
}

async function loginWebByBossAccount() {
  const bossConfig = resolveWebBossConfig();

  if (!bossConfig.enabled) {
    return {
      statusCode: 403,
      payload: {
        ok: false,
        message: "当前环境未启用 boss 账号登录",
      },
    };
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: {
          mobile: bossConfig.mobile,
        },
        include: {
          profile: true,
        },
      });

      const user = existingUser
        ? await tx.user.update({
            where: {
              id: existingUser.id,
            },
            data: {
              mobile: bossConfig.mobile,
              lastLoginAt: new Date(),
              profile: {
                upsert: {
                  update: {
                    nickname: bossConfig.nickname,
                    avatarUrl: bossConfig.avatarUrl,
                  },
                  create: {
                    nickname: bossConfig.nickname,
                    avatarUrl: bossConfig.avatarUrl,
                  },
                },
              },
            },
            include: {
              profile: true,
            },
          })
        : await tx.user.create({
            data: {
              mobile: bossConfig.mobile,
              lastLoginAt: new Date(),
              profile: {
                create: {
                  nickname: bossConfig.nickname,
                  avatarUrl: bossConfig.avatarUrl,
                },
              },
            },
            include: {
              profile: true,
            },
          });

      const session = await createWebSessionForUser(tx, user.id, `web-boss:${bossConfig.account}`);
      return { user, session };
    });
  } catch (error) {
    console.error("[authService] boss web login failed", error.message || error);
    const mappedError = mapErrorToResponse(error, "boss 登录暂不可用，请稍后重试");
    return {
      statusCode: mappedError.statusCode,
      payload: {
        ok: false,
        message: mappedError.message,
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildSessionPayload(result.user, result.user.profile, result.session),
    },
  };
}

async function loginWebByMobile(input) {
  const normalizedMobile = normalizeMobile(input.mobile);
  const bossConfig = resolveWebBossConfig();

  if (!normalizedMobile) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入正确的手机号",
      },
    };
  }

  if (bossConfig.enabled && normalizedMobile === bossConfig.mobile) {
    return {
      statusCode: 403,
      payload: {
        ok: false,
        message: `该账号已切换为 boss 专用登录，请直接输入账号 ${bossConfig.account} 登录`,
      },
    };
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: {
        mobile: normalizedMobile,
      },
      include: {
        profile: true,
      },
    });
  } catch (error) {
    console.error("[authService] web mobile login failed", error.message || error);
    const mappedError = mapErrorToResponse(error, "登录暂不可用，请稍后重试");
    return {
      statusCode: mappedError.statusCode,
      payload: {
        ok: false,
        message: mappedError.message,
      },
    };
  }

  if (!user) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "该手机号未绑定账号，请先去小程序完成注册并绑定手机号",
      },
    };
  }

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          lastLoginAt: new Date(),
        },
      });

      return createWebSessionForUser(tx, user.id, `web-mobile:${normalizedMobile}`);
    });
  } catch (error) {
    console.error("[authService] web mobile session create failed", error.message || error);
    const mappedError = mapErrorToResponse(error, "登录暂不可用，请稍后重试");
    return {
      statusCode: mappedError.statusCode,
      payload: {
        ok: false,
        message: mappedError.message,
      },
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildSessionPayload(
        {
          ...user,
          lastLoginAt: new Date(),
        },
        user.profile,
        result
      ),
    },
  };
}

async function loginWeb(input) {
  const account = String(((input && input.account) || (input && input.mobile) || "").trim());

  if (!account) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入手机号或 boss 账号",
      },
    };
  }

  if (matchesWebBossAccount(account)) {
    return loginWebByBossAccount();
  }

  const normalizedMobile = normalizeMobile(account);
  if (!normalizedMobile) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "请输入正确的手机号，或使用 boss 账号登录",
      },
    };
  }

  return loginWebByMobile({
    ...input,
    mobile: normalizedMobile,
  });
}

module.exports = {
  loginOrRegister,
  loginOrRegisterByPhone,
  loginWeb,
  loginWebByMobile,
  getSessionProfile,
  updateSessionProfile,
  logoutSession,
  __test__: {
    selectExistingUserForLogin,
  },
};
