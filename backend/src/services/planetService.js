const { prisma } = require("../db/prisma");

function generateSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
    .slice(0, 15);
  const random = Math.random().toString(36).slice(2, 6);
  return `${base}_${random}`;
}

function buildGroupProfile(group, ownerProfile, options = {}) {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    avatarImageUrl: group.avatarUrl || "",
    coverImageUrl: group.coverUrl || "",
    intro: group.intro || "",
    price: Number(group.priceAmount),
    priceLabel: group.joinType === "FREE" ? "免费加入" : `¥ ${group.priceAmount}/年`,
    joinType: group.billingPeriod === "YEAR" ? "rolling" : "calendar",
    isFree: group.joinType === "FREE",
    requireInviteCode: group.joinType === "INVITE_ONLY",
    ownerName: ownerProfile?.nickname || "未知",
    ownerTagline: ownerProfile?.bio || "",
    category: "其他",
    memberCount: group.memberCount,
    postCount: group.contentCount,
    createdAt: group.createdAt.toISOString().split("T")[0],
    joined: typeof options.joined === "boolean" ? options.joined : undefined,
  };
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

async function getActiveSession(sessionToken) {
  if (!sessionToken) {
    return {
      error: { statusCode: 401, payload: { ok: false, message: "请先登录" } },
    };
  }

  const session = await prisma.authSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  if (!session || session.status !== "ACTIVE") {
    return {
      error: { statusCode: 401, payload: { ok: false, message: "登录态无效" } },
    };
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    return {
      error: { statusCode: 401, payload: { ok: false, message: "登录态已过期" } },
    };
  }

  return { session };
}

async function createPlanet(sessionToken, input) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const { name, price, joinType } = input;

  if (!name || !name.trim()) {
    return { statusCode: 400, payload: { ok: false, message: "请输入星球名称" } };
  }

  if (name.trim().length > 15) {
    return { statusCode: 400, payload: { ok: false, message: "星球名称不能超过15字" } };
  }

  if (price === undefined || price === null || price < 0) {
    return { statusCode: 400, payload: { ok: false, message: "请输入有效的价格" } };
  }

  if (joinType && !["rolling", "calendar"].includes(joinType)) {
    return { statusCode: 400, payload: { ok: false, message: "加入类型参数无效" } };
  }

  const slug = generateSlug(name.trim());
  const isFree = price === 0;
  const joinTypeEnum = isFree ? "FREE" : "PAID";
  const billingPeriod = joinType === "calendar" ? "YEAR" : "YEAR";

  const group = await prisma.$transaction(async (tx) => {
    const newGroup = await tx.group.create({
      data: {
        name: name.trim(),
        slug,
        ownerUserId: session.userId,
        joinType: joinTypeEnum,
        billingPeriod,
        priceAmount: price,
        status: "ACTIVE",
        publishedAt: new Date(),
        permissionPolicy: {
          create: {},
        },
        renewalSetting: isFree
          ? undefined
          : {
              create: {
                amount: price,
                originalAmount: price,
                advanceAmount: 0,
                graceAmount: 0,
                mode: "period",
                duration: "1Y",
              },
            },
      },
      include: {
        permissionPolicy: true,
        renewalSetting: true,
      },
    });

    await tx.groupStaff.create({
      data: {
        groupId: newGroup.id,
        userId: session.userId,
        role: "OWNER",
        isActive: true,
      },
    });

    return newGroup;
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildGroupProfile(group, session.user.profile, {
        joined: true,
      }),
    },
  };
}

async function getMyPlanets(sessionToken) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const groups = await prisma.group.findMany({
    where: {
      ownerUserId: session.userId,
      status: { in: ["ACTIVE", "HIDDEN"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const groupsWithProfile = groups.map((group) =>
    buildGroupProfile(group, session.user.profile, {
      joined: true,
    })
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: groupsWithProfile,
    },
  };
}

async function getJoinedPlanets(sessionToken) {
  const sessionResult = await getActiveSession(sessionToken);
  if (sessionResult.error) {
    return sessionResult.error;
  }

  const { session } = sessionResult;

  const memberships = await prisma.groupMember.findMany({
    where: {
      userId: session.userId,
      status: "ACTIVE",
    },
    include: {
      group: {
        include: {
          owner: {
            include: {
              profile: true,
            },
          },
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const joinedGroups = memberships
    .filter((membership) => membershipIsActive(membership) && membership.group)
    .map((membership) =>
      buildGroupProfile(membership.group, membership.group.owner?.profile, {
        joined: true,
      })
    );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: joinedGroups,
    },
  };
}

async function getDiscoverPlanets(sessionToken, input = {}) {
  const limitValue = Number(input.limit || 12);
  const take = Number.isFinite(limitValue)
    ? Math.min(Math.max(Math.floor(limitValue), 1), 30)
    : 12;

  let sessionUserId = "";

  if (sessionToken) {
    const sessionResult = await getActiveSession(sessionToken);
    if (!sessionResult.error) {
      sessionUserId = sessionResult.session.userId;
    }
  }

  const activeMemberships = sessionUserId
    ? await prisma.groupMember.findMany({
        where: {
          userId: sessionUserId,
          status: "ACTIVE",
        },
        select: {
          groupId: true,
          status: true,
          expireAt: true,
        },
      })
    : [];

  const excludedGroupIds = activeMemberships
    .filter((membership) => membershipIsActive(membership))
    .map((membership) => membership.groupId);

  const where = {
    status: "ACTIVE",
    publishedAt: {
      not: null,
    },
    permissionPolicy: {
      is: {
        allowJoin: true,
        allowPreview: true,
        allowSearch: true,
      },
    },
  };

  if (sessionUserId) {
    where.ownerUserId = {
      not: sessionUserId,
    };
  }

  if (excludedGroupIds.length) {
    where.id = {
      notIn: excludedGroupIds,
    };
  }

  const groups = await prisma.group.findMany({
    where,
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
    },
    orderBy: [{ memberCount: "desc" }, { publishedAt: "desc" }],
    take,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: groups.map((group) => buildGroupProfile(group, group.owner.profile)),
    },
  };
}

module.exports = {
  createPlanet,
  getDiscoverPlanets,
  getJoinedPlanets,
  getMyPlanets,
};
