const { prisma } = require("../db/prisma");

const DEFAULT_CHALLENGES = [
  {
    slug: "milestone-archive",
    title: "里程碑档案",
    description:
      "记录每一次精进的小结果，比如公域知乎达到4级、5级、6级公众号突破100、1000、2000、1w；私域突破更多。",
    status: "ONGOING",
    dayCount: 21,
    validityText: "长期有效",
    heroColor: "teal",
    sortOrder: 10,
  },
  {
    slug: "weekly-review",
    title: "周复盘",
    description: "每周固定复盘一次，把目标、动作、结果和下周调整写清楚，形成稳定节奏。",
    status: "ONGOING",
    dayCount: 21,
    validityText: "长期有效",
    heroColor: "mint",
    sortOrder: 20,
  },
  {
    slug: "writing-practice",
    title: "基本功｜刻意练习·短文写作",
    description: "固定练习短文表达，把一句话观点拆成更完整的内容，提高输出稳定性。",
    status: "ONGOING",
    dayCount: 21,
    validityText: "长期有效",
    heroColor: "teal",
    sortOrder: 30,
  },
  {
    slug: "private-domain-365",
    title: "私域运营365计划",
    description: "围绕私域运营动作做长期打卡，把增长、转化和复盘沉淀下来。",
    status: "ONGOING",
    dayCount: 21,
    validityText: "长期有效",
    heroColor: "mint",
    sortOrder: 40,
  },
  {
    slug: "sdk-training",
    title: "SDK测试训练营",
    description: "用于短周期测试的训练营挑战。",
    status: "ENDED",
    dayCount: 7,
    validityText: "打卡已结束",
    heroColor: "mint",
    sortOrder: 50,
  },
  {
    slug: "zhihu-ring",
    title: "知乎圆环任务挑战",
    description: "阶段性关闭的历史挑战。",
    status: "CLOSED",
    dayCount: 21,
    validityText: "打卡已关闭",
    heroColor: "teal",
    sortOrder: 60,
  },
];

const DEFAULT_CHALLENGE_SIGNATURES = DEFAULT_CHALLENGES.map((item) =>
  JSON.stringify({
    title: item.title,
    description: item.description,
    status: item.status,
    dayCount: item.dayCount,
    validityText: item.validityText,
    heroColor: item.heroColor,
    sortOrder: item.sortOrder,
  })
);

function toOptionalDateString(value) {
  return value ? new Date(value).toISOString() : null;
}

function formatPostTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}`;
}

function formatDateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(year, month) {
  return `${year}年${month}月`;
}

function getMonthRange(year, month) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { start, end };
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function getWeekdayMondayFirst(year, month, day) {
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 ? 6 : weekday - 1;
}

function normalizeMonthNumber(input, fallback) {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 1 || value > 12) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizeDayNumber(input, fallback, maxDay) {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 1 || value > maxDay) {
    return fallback;
  }
  return Math.floor(value);
}

function buildParticipantProfile(user) {
  const profile = user && user.profile ? user.profile : null;
  return {
    id: user ? user.id : "",
    nickname: profile && profile.nickname ? profile.nickname : "当前成员",
    avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : "",
  };
}

function buildCheckinStatsMap(posts) {
  const statsMap = new Map();

  posts.forEach((post) => {
    if (!post || !post.authorUserId) {
      return;
    }

    const userId = post.authorUserId;
    const createdAt = post.publishedAt || post.createdAt;
    const dateKey = formatDateKey(createdAt);
    const existing =
      statsMap.get(userId) ||
      {
        dates: new Set(),
        latestCheckinAt: null,
      };

    existing.dates.add(dateKey);
    if (!existing.latestCheckinAt || new Date(createdAt).getTime() > new Date(existing.latestCheckinAt).getTime()) {
      existing.latestCheckinAt = createdAt;
    }
    statsMap.set(userId, existing);
  });

  return statsMap;
}

function calculateStreakDays(dateSet) {
  const dateKeys = Array.from(dateSet || []).sort();
  if (!dateKeys.length) {
    return 0;
  }

  let streak = 1;
  for (let index = dateKeys.length - 1; index > 0; index -= 1) {
    const currentDate = new Date(`${dateKeys[index]}T00:00:00`);
    const previousDate = new Date(`${dateKeys[index - 1]}T00:00:00`);
    const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 1) {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

function mapRankingItem(user, stats, rank, mode, viewerId) {
  const profile = buildParticipantProfile(user);
  const dateSet = stats && stats.dates ? stats.dates : new Set();
  const streakDays = calculateStreakDays(dateSet);
  const totalDays = dateSet.size;
  const value = mode === "streak" ? streakDays : totalDays;

  return {
    rank,
    userId: profile.id,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
    value,
    valueText: `${value}天`,
    isViewer: Boolean(viewerId && viewerId === profile.id),
  };
}

async function loadChallengeWithViewer(input = {}) {
  const { challengeId, sessionToken, userId } = input;
  const viewer = await resolveViewer(sessionToken, userId);
  const challenge = await prisma.checkinChallenge.findUnique({
    where: { id: challengeId },
    include: {
      group: {
        select: {
          id: true,
          ownerUserId: true,
          name: true,
        },
      },
      participants: {
        where: { status: "ACTIVE" },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: [{ joinedAt: "asc" }],
      },
    },
  });

  return {
    viewer,
    challenge,
  };
}

async function loadChallengeCheckinPosts(challengeId, groupId, monthRange) {
  const where = {
    groupId,
    type: "CHECKIN",
    status: "PUBLISHED",
    metadata: {
      path: ["challengeId"],
      equals: challengeId,
    },
  };

  if (monthRange) {
    where.createdAt = {
      gte: monthRange.start,
      lt: monthRange.end,
    };
  }

  return prisma.post.findMany({
    where,
    include: {
      author: {
        include: {
          profile: true,
        },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
}

async function resolveViewer(sessionToken, inputUserId) {
  if (sessionToken) {
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

    if (session && session.status === "ACTIVE" && session.expiresAt.getTime() > Date.now()) {
      return session.user;
    }
  }

  if (!inputUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: inputUserId },
    include: { profile: true },
  });
}

function getChallengeSignature(challenge) {
  return JSON.stringify({
    title: challenge.title,
    description: challenge.description,
    status: challenge.status,
    dayCount: challenge.dayCount,
    validityText: challenge.validityText,
    heroColor: challenge.heroColor,
    sortOrder: challenge.sortOrder,
  });
}

async function cleanupLegacyDefaultChallenges(groupId) {
  if (!groupId) {
    return;
  }

  const challenges = await prisma.checkinChallenge.findMany({
    where: { groupId },
    include: {
      participants: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (challenges.length < DEFAULT_CHALLENGE_SIGNATURES.length) {
    return;
  }

  const removableBySignature = new Map();

  challenges.forEach((challenge) => {
    if (
      Number(challenge.joinedCount || 0) !== 0 ||
      Number(challenge.checkinCount || 0) !== 0 ||
      Number(challenge.completedCount || 0) !== 0 ||
      (Array.isArray(challenge.participants) && challenge.participants.length > 0)
    ) {
      return;
    }

    const signature = getChallengeSignature(challenge);
    if (!DEFAULT_CHALLENGE_SIGNATURES.includes(signature)) {
      return;
    }

    const currentList = removableBySignature.get(signature) || [];
    currentList.push(challenge);
    removableBySignature.set(signature, currentList);
  });

  const removableChallengeIds = [];

  for (let index = 0; index < DEFAULT_CHALLENGE_SIGNATURES.length; index += 1) {
    const signature = DEFAULT_CHALLENGE_SIGNATURES[index];
    const matchedChallenges = removableBySignature.get(signature) || [];
    if (matchedChallenges.length !== 1) {
      return;
    }
    removableChallengeIds.push(matchedChallenges[0].id);
  }

  await prisma.checkinChallenge.deleteMany({
    where: {
      id: {
        in: removableChallengeIds,
      },
    },
  });
}

function mapParticipantAvatar(participant) {
  const profile = participant.user && participant.user.profile ? participant.user.profile : null;
  return {
    id: participant.userId,
    nickname: profile && profile.nickname ? profile.nickname : "当前成员",
    avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : "",
  };
}

function buildChallengeActionText(challengeStatus, isJoined) {
  if (challengeStatus === "ENDED") {
    return "已结束";
  }
  if (challengeStatus === "CLOSED") {
    return "已关闭";
  }
  return isJoined ? "去打卡" : "去参加";
}

function getChallengeStatusMeta(challengeStatus, isJoined) {
  const normalizedStatus = String(challengeStatus || "ONGOING").toUpperCase();
  const primaryActionText = buildChallengeActionText(normalizedStatus, isJoined);
  const canJoin = normalizedStatus === "ONGOING" && !isJoined;
  const canCheckin = normalizedStatus === "ONGOING" && isJoined;

  return {
    status: normalizedStatus.toLowerCase(),
    statusLabel:
      normalizedStatus === "ENDED" ? "已结束" : normalizedStatus === "CLOSED" ? "已关闭" : "进行中",
    primaryActionText,
    primaryActionDisabled: !canJoin && !canCheckin,
    canJoin,
    canCheckin,
  };
}

function mapChallengeListItem(challenge, viewerId) {
  const participants = Array.isArray(challenge.participants) ? challenge.participants : [];
  const isJoined = Boolean(viewerId && participants.some((item) => item.userId === viewerId && item.status === "ACTIVE"));
  const avatarItems = participants.slice(0, 3).map(mapParticipantAvatar);
  const statusMeta = getChallengeStatusMeta(challenge.status, isJoined);

  return {
    id: challenge.id,
    title: challenge.title,
    status: statusMeta.status,
    statusLabel: statusMeta.statusLabel,
    dayText: `打卡天数：${challenge.dayCount}天`,
    validityText: challenge.validityText,
    joinedCount: challenge.joinedCount,
    currentJoinedCount: challenge.joinedCount,
    checkinCount: challenge.checkinCount,
    completedCount: challenge.completedCount,
    heroColor: challenge.heroColor || "teal",
    avatarUrls: avatarItems.map((item) => item.avatarUrl).filter(Boolean),
    isJoined,
    primaryActionText: statusMeta.primaryActionText,
    primaryActionDisabled: statusMeta.primaryActionDisabled,
    canJoin: statusMeta.canJoin,
    canCheckin: statusMeta.canCheckin,
  };
}

function normalizeChallengePayload(input = {}) {
  const title = String(input.title || "").trim();
  const description = String(input.description || "").trim();
  const dayCount = Number(input.dayCount || 21);
  const heroColor = String(input.heroColor || "teal").trim().toLowerCase();

  if (!title) {
    throw new Error("请输入挑战标题");
  }

  if (title.length > 30) {
    throw new Error("挑战标题不能超过30个字");
  }

  if (!description) {
    throw new Error("请输入挑战说明");
  }

  if (description.length > 300) {
    throw new Error("挑战说明不能超过300个字");
  }

  if (!Number.isFinite(dayCount) || dayCount < 1 || dayCount > 365) {
    throw new Error("打卡天数需在1到365之间");
  }

  return {
    title,
    description,
    dayCount: Math.floor(dayCount),
    heroColor: heroColor === "mint" ? "mint" : "teal",
  };
}

function mapCheckinPost(post) {
  const profile = post.author && post.author.profile ? post.author.profile : null;
  const metadata = post.metadata && typeof post.metadata === "object" ? post.metadata : {};
  const images = Array.isArray(metadata.images)
    ? metadata.images.filter((item) => typeof item === "string")
    : Array.isArray(post.attachments)
      ? post.attachments.filter((item) => typeof item === "string")
      : [];

  return {
    id: post.id,
    author: {
      id: post.author ? post.author.id : "",
      name: profile && profile.nickname ? profile.nickname : "当前成员",
      avatarUrl: profile && profile.avatarUrl ? profile.avatarUrl : "",
      isOwner: metadata.authorRole === "OWNER",
      location: profile && profile.province ? profile.province : "",
    },
    createdAt: formatPostTime(post.publishedAt || post.createdAt),
    content: post.contentText || "",
    images,
    likeCount: Number(post.likeCount || 0),
    commentCount: Number(post.commentCount || 0),
  };
}

async function getViewerRoleInfo(groupId, viewerId) {
  if (!viewerId) {
    return {
      isOwner: false,
      isStaff: false,
      isMember: false,
    };
  }

  const [group, staff, member] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: { ownerUserId: true },
    }),
    prisma.groupStaff.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: viewerId,
        },
      },
      select: { id: true, isActive: true },
    }),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: viewerId,
        },
      },
      select: { id: true, status: true, expireAt: true },
    }),
  ]);

  const isMember = Boolean(
    member &&
      member.status === "ACTIVE" &&
      (!member.expireAt || new Date(member.expireAt).getTime() > Date.now())
  );

  return {
    isOwner: Boolean(group && group.ownerUserId === viewerId),
    isStaff: Boolean(staff && staff.isActive),
    isMember,
  };
}

async function listCheckinChallenges(input = {}) {
  const { groupId, status, sessionToken, userId } = input;
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  await cleanupLegacyDefaultChallenges(groupId);
  const viewer = await resolveViewer(sessionToken, userId);
  const roleInfo = viewer ? await getViewerRoleInfo(groupId, viewer.id) : null;
  const normalizedStatus = status ? String(status).toUpperCase() : "";

  const where = {
    groupId,
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
  };

  const challenges = await prisma.checkinChallenge.findMany({
    where,
    include: {
      participants: {
        where: { status: "ACTIVE" },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: [{ joinedAt: "asc" }],
        take: 6,
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        canCreateChallenge: Boolean(viewer && roleInfo && (roleInfo.isOwner || roleInfo.isStaff)),
        items: challenges.map((item) => mapChallengeListItem(item, viewer ? viewer.id : "")),
      },
    },
  };
}

async function createCheckinChallenge(input = {}) {
  const { groupId, sessionToken, userId } = input;

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const viewer = await resolveViewer(sessionToken, userId);
  if (!viewer) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const roleInfo = await getViewerRoleInfo(groupId, viewer.id);
  if (!roleInfo.isOwner && !roleInfo.isStaff) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主或管理员可以创建打卡挑战" } };
  }

  let normalizedPayload;
  try {
    normalizedPayload = normalizeChallengePayload(input);
  } catch (error) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: error instanceof Error ? error.message : "打卡挑战参数无效",
      },
    };
  }

  const latestChallenge = await prisma.checkinChallenge.findFirst({
    where: { groupId },
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    select: {
      sortOrder: true,
    },
  });

  const created = await prisma.checkinChallenge.create({
    data: {
      groupId,
      title: normalizedPayload.title,
      description: normalizedPayload.description,
      status: "ONGOING",
      dayCount: normalizedPayload.dayCount,
      validityText: "长期有效",
      heroColor: normalizedPayload.heroColor,
      sortOrder: latestChallenge ? Number(latestChallenge.sortOrder || 0) + 10 : 10,
    },
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        id: created.id,
        groupId: created.groupId,
        title: created.title,
      },
    },
  };
}

async function getCheckinChallengeDetail(input = {}) {
  const { challengeId, sessionToken, userId } = input;
  if (!challengeId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少挑战ID" } };
  }

  const viewer = await resolveViewer(sessionToken, userId);
  const challenge = await prisma.checkinChallenge.findUnique({
    where: { id: challengeId },
    include: {
      group: {
        select: {
          id: true,
          ownerUserId: true,
        },
      },
      participants: {
        where: { status: "ACTIVE" },
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: [{ joinedAt: "asc" }],
      },
    },
  });

  if (!challenge) {
    return { statusCode: 404, payload: { ok: false, message: "打卡挑战不存在" } };
  }

  const posts = await prisma.post.findMany({
    where: {
      groupId: challenge.groupId,
      type: "CHECKIN",
      status: "PUBLISHED",
      metadata: {
        path: ["challengeId"],
        equals: challengeId,
      },
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 30,
  });

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const todayCount = await prisma.post.count({
    where: {
      groupId: challenge.groupId,
      type: "CHECKIN",
      status: "PUBLISHED",
      metadata: {
        path: ["challengeId"],
        equals: challengeId,
      },
      createdAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  const joinedCount = challenge.joinedCount;
  const todayPercent = joinedCount ? Math.floor((todayCount / joinedCount) * 100) : 0;
  const viewerJoined = Boolean(
    viewer &&
      challenge.participants.some((participant) => participant.userId === viewer.id && participant.status === "ACTIVE")
  );
  const statusMeta = getChallengeStatusMeta(challenge.status, viewerJoined);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        id: challenge.id,
        groupId: challenge.groupId,
        title: challenge.title,
        description: challenge.description,
        status: statusMeta.status,
        statusLabel: statusMeta.statusLabel,
        dayText: `打卡天数：${challenge.dayCount}天`,
        validityText: challenge.validityText,
        joinedCount: challenge.joinedCount,
        currentJoinedCount: challenge.joinedCount,
        checkinCount: challenge.checkinCount,
        completedCount: challenge.completedCount,
        todayCount,
        todayPercent,
        heroColor: challenge.heroColor || "teal",
        isJoined: viewerJoined,
        primaryActionText: statusMeta.primaryActionText,
        primaryActionDisabled: statusMeta.primaryActionDisabled,
        canJoin: statusMeta.canJoin,
        canCheckin: statusMeta.canCheckin,
        joinedAvatarUrls: challenge.participants
          .slice(0, 5)
          .map(mapParticipantAvatar)
          .map((item) => item.avatarUrl)
          .filter(Boolean),
        posts: posts.map(mapCheckinPost),
      },
    },
  };
}

async function joinCheckinChallenge(input = {}) {
  const { challengeId, sessionToken, userId: inputUserId } = input;
  const viewer = await resolveViewer(sessionToken, inputUserId);

  if (!challengeId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少挑战ID" } };
  }

  if (!viewer) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const challenge = await prisma.checkinChallenge.findUnique({
    where: { id: challengeId },
    select: {
      id: true,
      groupId: true,
      status: true,
    },
  });

  if (!challenge) {
    return { statusCode: 404, payload: { ok: false, message: "打卡挑战不存在" } };
  }

  if (challenge.status !== "ONGOING") {
    return { statusCode: 400, payload: { ok: false, message: "当前挑战不可报名" } };
  }

  const roleInfo = await getViewerRoleInfo(challenge.groupId, viewer.id);
  if (!roleInfo.isOwner && !roleInfo.isStaff && !roleInfo.isMember) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权报名该挑战" } };
  }

  const existing = await prisma.checkinChallengeParticipant.findUnique({
    where: {
      challengeId_userId: {
        challengeId,
        userId: viewer.id,
      },
    },
  });

  if (existing && existing.status === "ACTIVE") {
    return getCheckinChallengeDetail({
      challengeId,
      sessionToken,
      userId: viewer.id,
    });
  }

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.checkinChallengeParticipant.update({
        where: {
          challengeId_userId: {
            challengeId,
            userId: viewer.id,
          },
        },
        data: {
          status: "ACTIVE",
          joinedAt: new Date(),
          completedAt: null,
        },
      });
    } else {
      await tx.checkinChallengeParticipant.create({
        data: {
          challengeId,
          userId: viewer.id,
          status: "ACTIVE",
        },
      });
    }

    await tx.checkinChallenge.update({
      where: { id: challengeId },
      data: {
        joinedCount: {
          increment: existing && existing.status === "ACTIVE" ? 0 : 1,
        },
      },
    });
  });

  return getCheckinChallengeDetail({
    challengeId,
    sessionToken,
    userId: viewer.id,
  });
}

async function publishCheckinPost(input = {}) {
  const { challengeId, content, images, sessionToken, userId: inputUserId } = input;
  const viewer = await resolveViewer(sessionToken, inputUserId);

  if (!challengeId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少挑战ID" } };
  }

  if (!viewer) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const challenge = await prisma.checkinChallenge.findUnique({
    where: { id: challengeId },
    include: {
      group: {
        select: {
          ownerUserId: true,
        },
      },
    },
  });

  if (!challenge) {
    return { statusCode: 404, payload: { ok: false, message: "打卡挑战不存在" } };
  }

  if (challenge.status !== "ONGOING") {
    return { statusCode: 400, payload: { ok: false, message: "当前挑战不可打卡" } };
  }

  const participant = await prisma.checkinChallengeParticipant.findUnique({
    where: {
      challengeId_userId: {
        challengeId,
        userId: viewer.id,
      },
    },
  });

  const roleInfo = await getViewerRoleInfo(challenge.groupId, viewer.id);
  if (!participant && !roleInfo.isOwner && !roleInfo.isStaff) {
    return { statusCode: 403, payload: { ok: false, message: "请先报名后再打卡" } };
  }

  const normalizedContent = String(content || "").trim();
  const normalizedImages = Array.isArray(images)
    ? images.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 9)
    : [];

  if (!normalizedContent && !normalizedImages.length) {
    return { statusCode: 400, payload: { ok: false, message: "请先填写打卡内容或上传图片" } };
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        groupId: challenge.groupId,
        authorUserId: viewer.id,
        type: "CHECKIN",
        status: "PUBLISHED",
        title: null,
        summary: normalizedContent.slice(0, 120) || challenge.title,
        contentText: normalizedContent,
        attachments: normalizedImages,
        metadata: {
          publishType: "checkin",
          challengeId: challenge.id,
          challengeTitle: challenge.title,
          images: normalizedImages,
          authorRole: challenge.group.ownerUserId === viewer.id ? "OWNER" : "MEMBER",
        },
        publishedAt: new Date(),
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
      },
    });

    await tx.post.updateMany({
      where: {
        id: created.id,
      },
      data: {
        summary: normalizedContent.slice(0, 120) || challenge.title,
      },
    });

    await tx.checkinChallenge.update({
      where: { id: challengeId },
      data: {
        checkinCount: {
          increment: 1,
        },
      },
    });

    await tx.group.update({
      where: { id: challenge.groupId },
      data: {
        contentCount: {
          increment: 1,
        },
      },
    });

    return created;
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: mapCheckinPost(post),
    },
  };
}

async function getCheckinRankings(input = {}) {
  const { challengeId, sessionToken, userId } = input;
  if (!challengeId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少挑战ID" } };
  }

  const { viewer, challenge } = await loadChallengeWithViewer({
    challengeId,
    sessionToken,
    userId,
  });

  if (!challenge) {
    return { statusCode: 404, payload: { ok: false, message: "打卡挑战不存在" } };
  }

  const posts = await loadChallengeCheckinPosts(challenge.id, challenge.groupId);
  const statsMap = buildCheckinStatsMap(posts);

  const rankingSource = challenge.participants.map((participant) => {
    const stats = statsMap.get(participant.userId) || { dates: new Set(), latestCheckinAt: null };
    return {
      user: participant.user,
      stats,
    };
  });

  const streakRanking = rankingSource
    .map((item) => ({
      ...item,
      streakDays: calculateStreakDays(item.stats.dates),
      totalDays: item.stats.dates.size,
    }))
    .sort((first, second) => {
      if (second.streakDays !== first.streakDays) {
        return second.streakDays - first.streakDays;
      }
      if (second.totalDays !== first.totalDays) {
        return second.totalDays - first.totalDays;
      }
      return String(first.user.id).localeCompare(String(second.user.id));
    });

  const totalRanking = rankingSource
    .map((item) => ({
      ...item,
      streakDays: calculateStreakDays(item.stats.dates),
      totalDays: item.stats.dates.size,
    }))
    .sort((first, second) => {
      if (second.totalDays !== first.totalDays) {
        return second.totalDays - first.totalDays;
      }
      if (second.streakDays !== first.streakDays) {
        return second.streakDays - first.streakDays;
      }
      return String(first.user.id).localeCompare(String(second.user.id));
    });

  const streakItems = streakRanking.map((item, index) =>
    mapRankingItem(item.user, item.stats, index + 1, "streak", viewer ? viewer.id : "")
  );
  const totalItems = totalRanking.map((item, index) =>
    mapRankingItem(item.user, item.stats, index + 1, "total", viewer ? viewer.id : "")
  );

  const viewerStreak = streakItems.find((item) => item.userId === (viewer ? viewer.id : ""));
  const viewerTotal = totalItems.find((item) => item.userId === (viewer ? viewer.id : ""));

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        streakRanking: streakItems,
        totalRanking: totalItems,
        viewerSummary: {
          streakRank: viewerStreak ? viewerStreak.rank : 0,
          streakDays: viewerStreak ? viewerStreak.value : 0,
          totalRank: viewerTotal ? viewerTotal.rank : 0,
          totalDays: viewerTotal ? viewerTotal.value : 0,
        },
      },
    },
  };
}

async function getCheckinRecord(input = {}) {
  const { challengeId, sessionToken, userId, year: inputYear, month: inputMonth, day: inputDay } = input;
  if (!challengeId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少挑战ID" } };
  }

  const { viewer, challenge } = await loadChallengeWithViewer({
    challengeId,
    sessionToken,
    userId,
  });

  if (!challenge) {
    return { statusCode: 404, payload: { ok: false, message: "打卡挑战不存在" } };
  }

  if (!viewer) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const now = new Date();
  const year = Number.isFinite(Number(inputYear)) ? Number(inputYear) : now.getFullYear();
  const month = normalizeMonthNumber(inputMonth, now.getMonth() + 1);
  const daysInMonth = getDaysInMonth(year, month);
  const day = normalizeDayNumber(inputDay, now.getDate(), daysInMonth);
  const monthRange = getMonthRange(year, month);
  const selectedDateKey = formatDateKey(new Date(year, month - 1, day, 0, 0, 0, 0));

  const [allPosts, monthPosts] = await Promise.all([
    loadChallengeCheckinPosts(challenge.id, challenge.groupId),
    loadChallengeCheckinPosts(challenge.id, challenge.groupId, monthRange),
  ]);

  const allStatsMap = buildCheckinStatsMap(allPosts);
  const viewerStats = allStatsMap.get(viewer.id) || { dates: new Set(), latestCheckinAt: null };
  const viewerMonthPosts = monthPosts.filter((post) => post.authorUserId === viewer.id);
  const monthMarkedDays = Array.from(
    new Set(
      viewerMonthPosts.map((post) => {
        const createdAt = post.publishedAt || post.createdAt;
        return new Date(createdAt).getDate();
      })
    )
  ).sort((first, second) => first - second);

  const viewerSelectedDayPosts = allPosts
    .filter((post) => post.authorUserId === viewer.id && formatDateKey(post.publishedAt || post.createdAt) === selectedDateKey)
    .map(mapCheckinPost);

  const allSelectedDayPosts = allPosts
    .filter((post) => formatDateKey(post.publishedAt || post.createdAt) === selectedDateKey)
    .map(mapCheckinPost);

  const totalDays = viewerStats.dates.size;
  const streakDays = calculateStreakDays(viewerStats.dates);
  const progressPercent = challenge.dayCount ? Math.min(100, Math.round((totalDays / challenge.dayCount) * 100)) : 0;

  const calendarDays = [];
  const firstWeekday = getWeekdayMondayFirst(year, month, 1);
  for (let index = 0; index < firstWeekday; index += 1) {
    calendarDays.push({
      day: 0,
      isEmpty: true,
      isMarked: false,
      isSelected: false,
      isToday: false,
    });
  }

  for (let currentDay = 1; currentDay <= daysInMonth; currentDay += 1) {
    const currentDate = new Date(year, month - 1, currentDay, 0, 0, 0, 0);
    const isToday =
      currentDate.getFullYear() === now.getFullYear() &&
      currentDate.getMonth() === now.getMonth() &&
      currentDate.getDate() === now.getDate();

    calendarDays.push({
      day: currentDay,
      isEmpty: false,
      isMarked: monthMarkedDays.indexOf(currentDay) >= 0,
      isSelected: currentDay === day,
      isToday,
    });
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        challengeId: challenge.id,
        challengeTitle: challenge.title,
        year,
        month,
        monthLabel: formatMonthLabel(year, month),
        selectedDay: day,
        selectedDateKey,
        weekdayLabels: ["一", "二", "三", "四", "五", "六", "日"],
        calendarDays,
        progressPercent,
        streakDays,
        totalDays,
        todayChecked: viewerStats.dates.has(formatDateKey(now)),
        selectedDayChecked: viewerStats.dates.has(selectedDateKey),
        myPosts: viewerSelectedDayPosts,
        allPosts: allSelectedDayPosts,
      },
    },
  };
}

module.exports = {
  listCheckinChallenges,
  getCheckinChallengeDetail,
  createCheckinChallenge,
  joinCheckinChallenge,
  publishCheckinPost,
  getCheckinRankings,
  getCheckinRecord,
};
