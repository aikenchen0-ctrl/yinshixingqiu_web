const { prisma } = require("../db/prisma");

function toOptionalDateString(value) {
  return value ? new Date(value).toISOString() : null;
}

function toPostSummary(post) {
  const authorProfile = post.author && post.author.profile ? post.author.profile : null;
  const viewerLiked = Array.isArray(post.likes) && post.likes.length > 0;
  return {
    id: post.id,
    groupId: post.groupId,
    type: post.type,
    status: post.status,
    title: post.title || "",
    summary: post.summary || "",
    contentText: post.contentText || "",
    author: {
      id: post.author ? post.author.id : "",
      nickname: authorProfile ? authorProfile.nickname : "当前成员",
      avatarUrl: authorProfile ? authorProfile.avatarUrl || "" : "",
    },
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    readingCount: post.readingCount,
    viewerLiked,
    isPinned: post.isPinned,
    isEssence: post.isEssence,
    publishedAt: toOptionalDateString(post.publishedAt),
    createdAt: toOptionalDateString(post.createdAt),
    updatedAt: toOptionalDateString(post.updatedAt),
    attachments: Array.isArray(post.attachments) ? post.attachments : [],
    metadata: post.metadata || {},
  };
}

function toCommentItem(comment) {
  const userProfile = comment.user && comment.user.profile ? comment.user.profile : null;
  const viewerLiked = Array.isArray(comment.likes) && comment.likes.length > 0;
  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId || null,
    content: comment.contentText || "",
    likeCount: comment.likeCount,
    viewerLiked,
    createdAt: toOptionalDateString(comment.createdAt),
    updatedAt: toOptionalDateString(comment.updatedAt),
    author: {
      id: comment.user ? comment.user.id : "",
      nickname: userProfile ? userProfile.nickname : "当前成员",
      avatarUrl: userProfile ? userProfile.avatarUrl || "" : "",
    },
  };
}

function parseCursor(value) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function normalizeAttachmentList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      if (item && typeof item === "object" && typeof item.url === "string") {
        return item.url.trim();
      }

      return "";
    })
    .filter(Boolean)
    .slice(0, 9);
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const nextMetadata = { ...value };
  nextMetadata.tags = Array.isArray(nextMetadata.tags)
    ? nextMetadata.tags.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
    : [];
  nextMetadata.richContent = typeof nextMetadata.richContent === "string" ? nextMetadata.richContent : "";
  return nextMetadata;
}

async function getCurrentViewer(sessionToken, userId) {
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
      return {
        id: session.userId,
        profile: session.user.profile || null,
      };
    }
  }

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (user) {
      return {
        id: user.id,
        profile: user.profile || null,
      };
    }
  }

  return null;
}

async function resolveViewerIdentity(sessionToken, userId) {
  const viewer = await getCurrentViewer(sessionToken, userId);
  return viewer ? viewer.id : "";
}

function buildViewerLikeInclude(viewerId) {
  if (!viewerId) {
    return false;
  }

  return {
    where: {
      userId: viewerId,
    },
    select: {
      id: true,
    },
    take: 1,
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

function extractPostCover(post) {
  const attachments = Array.isArray(post.attachments) ? post.attachments : [];

  for (const item of attachments) {
    if (typeof item === "string" && /^https?:\/\//.test(item.trim())) {
      return item.trim();
    }

    if (item && typeof item === "object" && typeof item.url === "string" && /^https?:\/\//.test(item.url.trim())) {
      return item.url.trim();
    }
  }

  const metadata = post.metadata && typeof post.metadata === "object" ? post.metadata : {};
  const metadataImages = Array.isArray(metadata.images) ? metadata.images : [];

  for (const item of metadataImages) {
    if (typeof item === "string" && /^https?:\/\//.test(item.trim())) {
      return item.trim();
    }
  }

  if (post.group) {
    return post.group.coverUrl || post.group.avatarUrl || "";
  }

  return "";
}

async function getGroupHome(groupId, options = {}) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const viewer = await getCurrentViewer(options.sessionToken, options.userId);
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      owner: {
        include: {
          profile: true,
        },
      },
      permissionPolicy: true,
      renewalSetting: true,
    },
  });

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  const [membership, staff] = await Promise.all([
    viewer
      ? prisma.groupMember.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: viewer.id,
            },
          },
        })
      : Promise.resolve(null),
    viewer
      ? prisma.groupStaff.findUnique({
          where: {
            groupId_userId: {
              groupId,
              userId: viewer.id,
            },
          },
        })
      : Promise.resolve(null),
  ]);

  const activeMembership = Boolean(
    membership &&
      membership.status === "ACTIVE" &&
      (!membership.expireAt || new Date(membership.expireAt).getTime() > Date.now())
  );

  const latestCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
    },
  });

  const featuredCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
      isEssence: true,
    },
  });

  const fileCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
      OR: [
        { metadata: { path: ["hasFile"], equals: true } },
        { attachments: { isEmpty: false } },
      ],
    },
  }).catch(() => 0);

  const answerCount = await prisma.post.count({
    where: {
      groupId,
      status: "PUBLISHED",
      metadata: {
        path: ["answerStatus"],
        equals: "PENDING",
      },
    },
  }).catch(() => 0);

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        group: {
          id: group.id,
          name: group.name,
          intro: group.intro || "",
          description: group.description || "",
          avatarUrl: group.avatarUrl || "",
          coverUrl: group.coverUrl || "",
          status: group.status,
          joinType: group.joinType,
          billingPeriod: group.billingPeriod,
          priceAmount: Number(group.priceAmount),
          originalPriceAmount: Number(group.originalPriceAmount),
          memberCount: group.memberCount,
          paidMemberCount: group.paidMemberCount,
          contentCount: group.contentCount,
          publishedAt: toOptionalDateString(group.publishedAt),
          createdAt: toOptionalDateString(group.createdAt),
        },
        owner: {
          id: group.owner.id,
          nickname: group.owner.profile ? group.owner.profile.nickname : "未知",
          avatarUrl: group.owner.profile ? group.owner.profile.avatarUrl || "" : "",
          bio: group.owner.profile ? group.owner.profile.bio || "" : "",
        },
        viewer: viewer
          ? {
              id: viewer.id,
              nickname: viewer.profile ? viewer.profile.nickname : "",
              avatarUrl: viewer.profile ? viewer.profile.avatarUrl || "" : "",
            }
          : null,
        membership: membership
          ? {
              id: membership.id,
              status: membership.status,
              isActive: activeMembership,
              isPaid: membership.isPaid,
              expireAt: toOptionalDateString(membership.expireAt),
              joinedAt: toOptionalDateString(membership.joinedAt),
            }
          : null,
        role: {
          isOwner: group.ownerUserId === (viewer ? viewer.id : ""),
          isStaff: Boolean(staff),
          staffRole: staff ? staff.role : null,
          canPublish: activeMembership || Boolean(staff) || group.ownerUserId === (viewer ? viewer.id : ""),
          canManage: Boolean(staff) || group.ownerUserId === (viewer ? viewer.id : ""),
        },
        policy: group.permissionPolicy
          ? {
              allowJoin: group.permissionPolicy.allowJoin,
              needExamine: group.permissionPolicy.needExamine,
              allowPreview: group.permissionPolicy.allowPreview,
              allowSearch: group.permissionPolicy.allowSearch,
            }
          : null,
        stats: {
          latestCount,
          featuredCount,
          fileCount,
          answerCount,
        },
      },
    },
  };
}

async function listPostsByTab(groupId, input = {}) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId || "");
  const tab = input.tab || "latest";
  const limitValue = Number(input.limit || 20);
  const take = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 50) : 20;
  const cursor = parseCursor(input.cursor);

  const where = {
    groupId,
    status: "PUBLISHED",
  };

  if (tab === "featured") {
    where.isEssence = true;
  }

  if (tab === "files") {
    where.OR = [
      { metadata: { path: ["hasFile"], equals: true } },
      { attachments: { isEmpty: false } },
    ];
  }

  if (tab === "answer") {
    where.metadata = {
      path: ["answerStatus"],
      equals: "PENDING",
    };
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    take,
  }).catch(async () => {
    return prisma.post.findMany({
      where: {
        groupId,
        status: "PUBLISHED",
        ...(tab === "featured" ? { isEssence: true } : {}),
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(viewerId),
      },
      orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      take,
    });
  });

  const nextCursor = posts.length === take ? posts[posts.length - 1].id : null;

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        items: posts.map(toPostSummary),
        nextCursor,
        tab,
      },
    },
  };
}

async function listPinnedPosts(groupId) {
  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  const options = arguments[1] || {};
  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  const posts = await prisma.post.findMany({
    where: {
      groupId,
      status: "PUBLISHED",
      isPinned: true,
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: posts.map(toPostSummary),
    },
  };
}

async function listDiscoverFeaturedPosts(input = {}) {
  const limitValue = Number(input.limit || 12);
  const take = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 30) : 12;
  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId || "");

  const activeMemberships = viewerId
    ? await prisma.groupMember.findMany({
        where: {
          userId: viewerId,
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
    status: "PUBLISHED",
    isEssence: true,
    publishedAt: {
      not: null,
    },
    group: {
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
    },
  };

  if (viewerId) {
    where.group.ownerUserId = {
      not: viewerId,
    };
  }

  if (excludedGroupIds.length) {
    where.groupId = {
      notIn: excludedGroupIds,
    };
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      group: {
        include: {
          owner: {
            include: {
              profile: true,
            },
          },
        },
      },
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: posts.map((post) => ({
        ...toPostSummary(post),
        group: {
          id: post.group.id,
          name: post.group.name,
          ownerName: post.group.owner && post.group.owner.profile ? post.group.owner.profile.nickname : "未知",
          coverUrl: post.group.coverUrl || post.group.avatarUrl || "",
        },
        coverUrl: extractPostCover(post),
      })),
    },
  };
}

async function getPostDetail(postId, options = {}) {
  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  const post = await prisma.$transaction(async (tx) => {
    const updated = await tx.post.update({
      where: { id: postId },
      data: {
        readingCount: {
          increment: options.incrementRead === false ? 0 : 1,
        },
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(viewerId),
      },
    }).catch(async () => {
      return tx.post.findUnique({
        where: { id: postId },
        include: {
          author: {
            include: {
              profile: true,
            },
          },
          likes: buildViewerLikeInclude(viewerId),
        },
      });
    });

    return updated;
  });

  if (!post || post.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toPostSummary(post),
    },
  };
}

async function createPost(input = {}) {
  const {
    groupId,
    userId: inputUserId,
    sessionToken,
    title,
    summary,
    contentText,
    attachments,
    metadata,
    isEssence,
    isPinned,
  } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!groupId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少星球ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "缺少用户身份" } };
  }

  const normalizedContent = String(contentText || summary || title || "").trim();
  const normalizedAttachments = normalizeAttachmentList(attachments);
  const normalizedMetadata = normalizeMetadata(metadata);
  if (!normalizedContent) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子内容" } };
  }

  const [group, user, membership, staff] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.user.findUnique({ where: { id: userId }, include: { profile: true } }),
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
    }),
  ]);

  if (!group) {
    return { statusCode: 404, payload: { ok: false, message: "星球不存在" } };
  }

  if (!user) {
    return { statusCode: 404, payload: { ok: false, message: "用户不存在" } };
  }

  const canPublish = Boolean(
    group.ownerUserId === userId ||
      staff ||
      (membership && membership.status === "ACTIVE" && (!membership.expireAt || new Date(membership.expireAt).getTime() > Date.now()))
  );

  if (!canPublish) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权在该星球发帖" } };
  }

  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        groupId,
        authorUserId: userId,
        type: input.type || "TOPIC",
        status: "PUBLISHED",
        title: String(title || "").trim() || null,
        summary: String(summary || normalizedContent.slice(0, 120)).trim() || null,
        contentText: normalizedContent,
        isEssence: Boolean(isEssence),
        isPinned: Boolean(isPinned),
        publishedAt: new Date(),
        attachments: normalizedAttachments,
        metadata: normalizedMetadata,
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });

    await tx.group.update({
      where: { id: groupId },
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
      data: toPostSummary(post),
    },
  };
}

async function updatePost(input = {}) {
  const {
    postId,
    userId: inputUserId,
    sessionToken,
    title,
    summary,
    contentText,
    attachments,
    metadata,
  } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "缺少用户身份" } };
  }

  const existingPost = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!existingPost || existingPost.status === "DELETED") {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  if (existingPost.authorUserId !== userId) {
    return { statusCode: 403, payload: { ok: false, message: "只有作者本人可以修改帖子" } };
  }

  const normalizedContent = String(contentText || summary || title || "").trim();
  if (!normalizedContent) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子内容" } };
  }

  const normalizedAttachments = normalizeAttachmentList(attachments);
  const normalizedMetadata = normalizeMetadata(metadata);

  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: {
      title: String(title || "").trim() || null,
      summary: String(summary || normalizedContent.slice(0, 120)).trim() || null,
      contentText: normalizedContent,
      attachments: normalizedAttachments,
      metadata: normalizedMetadata,
      updatedAt: new Date(),
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      likes: buildViewerLikeInclude(userId),
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toPostSummary(updatedPost),
    },
  };
}

async function listComments(postId) {
  const options = arguments[1] || {};
  const viewerId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      status: "PUBLISHED",
    },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
      likes: buildViewerLikeInclude(viewerId),
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: comments.map(toCommentItem),
    },
  };
}

async function createComment(input = {}) {
  const { postId, userId: inputUserId, sessionToken, content, parentId } = input;
  const userId = await resolveViewerIdentity(sessionToken, inputUserId);

  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "缺少用户身份" } };
  }

  const normalizedContent = String(content || "").trim();
  if (!normalizedContent) {
    return { statusCode: 400, payload: { ok: false, message: "评论内容不能为空" } };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const membership = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: post.groupId,
        userId,
      },
    },
  });

  const staff = await prisma.groupStaff.findUnique({
    where: {
      groupId_userId: {
        groupId: post.groupId,
        userId,
      },
    },
  });

  const group = await prisma.group.findUnique({ where: { id: post.groupId } });
  const canComment = Boolean(
    group &&
      (group.ownerUserId === userId ||
        staff ||
        (membership && membership.status === "ACTIVE" && (!membership.expireAt || new Date(membership.expireAt).getTime() > Date.now())))
  );

  if (!canComment) {
    return { statusCode: 403, payload: { ok: false, message: "当前用户无权评论该帖子" } };
  }

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        postId,
        userId,
        parentId: parentId || null,
        contentText: normalizedContent,
        status: "PUBLISHED",
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: {
        commentCount: {
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
      data: toCommentItem(comment),
    },
  };
}

async function listMyPosts(sessionToken) {
  const userId = await resolveViewerIdentity(sessionToken, "");

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录" } };
  }

  const posts = await prisma.post.findMany({
    where: {
      authorUserId: userId,
      status: {
        not: "DELETED",
      },
    },
    include: {
      author: {
        include: {
          profile: true,
        },
      },
      group: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: posts.map((post) => ({
        ...toPostSummary(post),
        group: post.group
          ? {
              id: post.group.id,
              name: post.group.name,
            }
          : null,
      })),
    },
  };
}

async function togglePostLike(postId, increment = true) {
  const options = arguments[2] || {};
  const userId = await resolveViewerIdentity(options.sessionToken, options.userId || "");
  if (!postId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少帖子ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录后点赞" } };
  }

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return { statusCode: 404, payload: { ok: false, message: "帖子不存在" } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.postLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (increment && !existingLike) {
      await tx.postLike.create({
        data: {
          postId,
          userId,
        },
      });
    }

    if (!increment && existingLike) {
      await tx.postLike.delete({
        where: {
          postId_userId: {
            postId,
            userId,
          },
        },
      });
    }

    const nextLikeCount = await tx.postLike.count({
      where: {
        postId,
      },
    });

    return tx.post.update({
      where: { id: postId },
      data: {
        likeCount: nextLikeCount,
      },
      include: {
        author: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toPostSummary(updated),
    },
  };
}

async function toggleCommentLike(commentId, increment = true, options = {}) {
  const userId = await resolveViewerIdentity(options.sessionToken, options.userId || "");

  if (!commentId) {
    return { statusCode: 400, payload: { ok: false, message: "缺少评论ID" } };
  }

  if (!userId) {
    return { statusCode: 401, payload: { ok: false, message: "请先登录后点赞" } };
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    return { statusCode: 404, payload: { ok: false, message: "评论不存在" } };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existingLike = await tx.commentLike.findUnique({
      where: {
        commentId_userId: {
          commentId,
          userId,
        },
      },
    });

    if (increment && !existingLike) {
      await tx.commentLike.create({
        data: {
          commentId,
          userId,
        },
      });
    }

    if (!increment && existingLike) {
      await tx.commentLike.delete({
        where: {
          commentId_userId: {
            commentId,
            userId,
          },
        },
      });
    }

    const nextLikeCount = await tx.commentLike.count({
      where: {
        commentId,
      },
    });

    return tx.comment.update({
      where: { id: commentId },
      data: {
        likeCount: nextLikeCount,
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        likes: buildViewerLikeInclude(userId),
      },
    });
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: toCommentItem(updated),
    },
  };
}

module.exports = {
  getGroupHome,
  listPostsByTab,
  listPinnedPosts,
  listDiscoverFeaturedPosts,
  getPostDetail,
  createPost,
  updatePost,
  listComments,
  createComment,
  togglePostLike,
  toggleCommentLike,
  listMyPosts,
};
