const { prisma } = require("../db/prisma");

async function resolveViewerIdentity(sessionToken, userId) {
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
      return session.userId;
    }
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (user) {
      return user.id;
    }
  }

  return "";
}

function membershipIsActive(membership) {
  if (!membership) return false;
  if (membership.status !== "ACTIVE") return false;
  if (!membership.expireAt) return true;
  return new Date(membership.expireAt).getTime() > Date.now();
}

async function listColumns(groupId, options = {}) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      ownerUserId: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const membership = viewerId
    ? await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: viewerId,
          },
        },
      })
    : null;

  const staff = viewerId
    ? await prisma.groupStaff.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: viewerId,
          },
        },
      })
    : null;

  const isActive = Boolean(
    group.ownerUserId === viewerId ||
      staff ||
      (membership && membershipIsActive(membership))
  );

  if (!isActive) {
    return { statusCode: 403, payload: { ok: false, message: "请先加入星球" } };
  }

  const columns = await prisma.column.findMany({
    where: { groupId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const columnIds = columns.map((col) => col.id);
  const allColumnPosts = await prisma.post.findMany({
    where: {
      groupId,
      status: "PUBLISHED",
    },
    select: {
      metadata: true,
    },
  });

  const countMap = {};
  for (const post of allColumnPosts) {
    const metadata = post.metadata && typeof post.metadata === "object" && !Array.isArray(post.metadata) ? post.metadata : null;
    const columnId = metadata && typeof metadata.columnId === "string" ? metadata.columnId : "";
    if (columnId && columnIds.includes(columnId)) {
      countMap[columnId] = (countMap[columnId] || 0) + 1;
    }
  }

  const items = columns.map((col) => ({
    id: col.id,
    title: col.title,
    count: countMap[col.id] || 0,
  }));

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        groupId: group.id,
        groupName: group.name,
        canCreateColumn: group.ownerUserId === viewerId,
        totalColumns: items.length,
        items,
      },
    },
  };
}

async function createColumn(input = {}) {
  const { groupId, title, sessionToken, userId: inputUserId } = input;

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const normalizedTitle = String(title || "").trim();
  if (!normalizedTitle) {
    return { statusCode: 400, payload: { ok: false, message: "请输入专栏标题" } };
  }

  if (normalizedTitle.length > 24) {
    return { statusCode: 400, payload: { ok: false, message: "专栏标题不能超过24个字" } };
  }

  const viewerId = await resolveViewerIdentity(sessionToken, inputUserId || "");
  if (!viewerId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      ownerUserId: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (group.ownerUserId !== viewerId) {
    return { statusCode: 403, payload: { ok: false, message: "只有星主可以创建专栏" } };
  }

  const existedColumn = await prisma.column.findFirst({
    where: {
      groupId,
      title: normalizedTitle,
    },
    select: { id: true },
  });

  if (existedColumn) {
    return { statusCode: 409, payload: { ok: false, message: "这个专栏标题已经存在" } };
  }

  const lastColumn = await prisma.column.findFirst({
    where: { groupId },
    orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
    select: {
      sortOrder: true,
    },
  });

  const column = await prisma.column.create({
    data: {
      groupId,
      title: normalizedTitle,
      sortOrder: lastColumn ? lastColumn.sortOrder + 1 : 1,
    },
  });

  return {
    statusCode: 201,
    payload: {
      ok: true,
      data: {
        id: column.id,
        groupId: column.groupId,
        title: column.title,
        sortOrder: column.sortOrder,
      },
    },
  };
}

async function getColumnDetail(columnId, groupId, options = {}) {
  if (!columnId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少专栏ID" } };
  }

  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");

  const column = await prisma.column.findUnique({
    where: { id: columnId },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          ownerUserId: true,
        },
      },
    },
  });

  if (!column || column.groupId !== groupId) {
    return { statusCode: 404, payload: { ok: false, message: "专栏不存在" } };
  }

  const membership = viewerId
    ? await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: viewerId,
          },
        },
      })
    : null;

  const staff = viewerId
    ? await prisma.groupStaff.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: viewerId,
          },
        },
      })
    : null;

  const isActive = Boolean(
    column.group.ownerUserId === viewerId ||
      staff ||
      (membership && membershipIsActive(membership))
  );

  if (!isActive) {
    return { statusCode: 403, payload: { ok: false, message: "请先加入星球" } };
  }

  const posts = await prisma.post.findMany({
    where: {
      groupId,
      status: "PUBLISHED",
      metadata: {
        path: ["columnId"],
        equals: columnId,
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
  });

  const items = posts.map((post) => {
    const authorProfile = post.author && post.author.profile ? post.author.profile : null;
    return {
      id: post.id,
      title: post.title || post.summary || post.contentText.slice(0, 60) || "",
      content: post.contentText || "",
      author: {
        id: post.author ? post.author.id : "",
        nickname: authorProfile ? authorProfile.nickname : "当前成员",
        avatarUrl: authorProfile ? authorProfile.avatarUrl || "" : "",
      },
      readingCount: post.readingCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
      createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : null,
    };
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        columnId: column.id,
        columnTitle: column.title,
        groupId: column.groupId,
        groupName: column.group.name,
        totalPosts: items.length,
        items,
      },
    },
  };
}

module.exports = {
  listColumns,
  getColumnDetail,
  createColumn,
};
