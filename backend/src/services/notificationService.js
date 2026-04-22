const { prisma } = require("../db/prisma");

async function resolveViewerIdentity(sessionToken, userId) {
  if (sessionToken) {
    const session = await prisma.authSession.findUnique({
      where: { sessionToken },
    });

    if (session && session.status === "ACTIVE" && session.expiresAt.getTime() > Date.now()) {
      return session.userId;
    }
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (user) {
      return user.id;
    }
  }

  return "";
}

function membershipIsActive(membership) {
  if (!membership) {
    return false;
  }

  if (membership.status !== "ACTIVE") {
    return false;
  }

  if (!membership.expireAt) {
    return true;
  }

  return new Date(membership.expireAt).getTime() > Date.now();
}

async function updateGroupSubscription(input = {}) {
  const { groupId, enabled, sessionToken, userId: inputUserId } = input;

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const userId = await resolveViewerIdentity(sessionToken, inputUserId || "");
  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const [group, membership, staff] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        ownerUserId: true,
      },
    }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    }),
    prisma.groupStaff.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        id: true,
        isActive: true,
      },
    }),
  ]);

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const canAccess = Boolean(
    group.ownerUserId === userId ||
      (staff && staff.isActive) ||
      membershipIsActive(membership)
  );

  if (!canAccess) {
    return { statusCode: 403, payload: { ok: false, message: "请先加入星球再订阅通知" } };
  }

  const nextEnabled = enabled !== false;
  const subscription = await prisma.groupNotificationSubscription.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId,
      },
    },
    create: {
      groupId,
      userId,
      enabled: nextEnabled,
      lastSubscribedAt: nextEnabled ? new Date() : null,
    },
    update: {
      enabled: nextEnabled,
      lastSubscribedAt: nextEnabled ? new Date() : null,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId,
        enabled: subscription.enabled,
        groupName: group.name,
      },
    },
  };
}

module.exports = {
  updateGroupSubscription,
};
