const crypto = require("crypto");
const { prisma } = require("../db/prisma");
const { exchangeLoginCode, fetchPhoneNumber } = require("./wechatService");

const SESSION_TTL_DAYS = 30;
const DEV_AUTH_MULTI_ACCOUNT =
  process.env.NODE_ENV !== "production" &&
  process.env.DEV_AUTH_MULTI_ACCOUNT !== "0";
const PHONE_LOGIN_RESULT_TTL_MS = 10 * 60 * 1000;

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

function normalizeMobile(mobile) {
  const mobileValue = String(mobile || "").trim();
  return /^1\d{10}$/.test(mobileValue) ? mobileValue : null;
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

    let user =
      existingByMobile ||
      (existingByOpenId && existingByOpenId.mobile ? existingByOpenId : null) ||
      preferredDevUser ||
      existingByOpenId ||
      fallbackDevUser;
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
    return {
      statusCode: 503,
      payload: {
        ok: false,
        message: error.message || "微信登录暂不可用",
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
      return {
        statusCode: 503,
        payload: {
          ok: false,
          message: error.message || "手机号一键登录暂不可用",
        },
      };
    });

  cachePhoneLoginPromise(requestId, phoneLoginPromise);
  return phoneLoginPromise;
}

async function getSessionProfile(sessionToken) {
  if (!sessionToken) {
    return { statusCode: 401, payload: { ok: false, message: "缺少登录态" } };
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
    return { statusCode: 401, payload: { ok: false, message: "登录态无效" } };
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.authSession.update({
      where: { id: session.id },
      data: {
        status: "EXPIRED",
      },
    });

    return { statusCode: 401, payload: { ok: false, message: "登录态已过期" } };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildSessionPayload(session.user, session.user.profile, session),
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

module.exports = {
  loginOrRegister,
  loginOrRegisterByPhone,
  getSessionProfile,
  logoutSession,
};
