const { prisma } = require("../db/prisma");
const { resolveViewerIdentity, getGroupManagerAccess } = require("./contentService");

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const COURSE_STATUS_VALUES = ["DRAFT", "PUBLISHED", "HIDDEN", "DELETED"];
const COURSE_ACCESS_TYPE_VALUES = ["FREE", "MEMBER", "PAID"];
const COURSE_LESSON_TYPE_VALUES = ["VIDEO", "ARTICLE"];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeOptionalString(value) {
  const normalizedValue = normalizeString(value);
  return normalizedValue || null;
}

function parsePositiveInt(value, fallback, maxValue) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), maxValue);
}

function parseNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeBooleanFlag(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalizedValue = normalizeString(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

function normalizeCourseStatus(value, allowAll = false) {
  const normalizedValue = normalizeString(value).toUpperCase();
  if (allowAll && normalizedValue === "ALL") {
    return "ALL";
  }

  return COURSE_STATUS_VALUES.includes(normalizedValue) ? normalizedValue : "";
}

function normalizeCourseAccessType(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  return COURSE_ACCESS_TYPE_VALUES.includes(normalizedValue) ? normalizedValue : "";
}

function normalizeCourseLessonType(value) {
  const normalizedValue = normalizeString(value).toUpperCase();
  return COURSE_LESSON_TYPE_VALUES.includes(normalizedValue) ? normalizedValue : "ARTICLE";
}

function normalizeTagList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeImageList(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeString(item))
    .filter(Boolean)
    .slice(0, 30);
}

function splitTextParagraphs(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toIso(value) {
  return value ? new Date(value).toISOString() : "";
}

function toDateLabel(value) {
  if (!value) {
    return "";
  }

  const isoValue = toIso(value);
  return isoValue ? isoValue.slice(0, 10) : "";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPriceLabel(accessType, priceAmount) {
  if (accessType === "FREE") {
    return "免费";
  }

  if (accessType === "MEMBER") {
    return "会员权限";
  }

  return `¥${toNumber(priceAmount).toFixed(2)}`;
}

function mapLessonTypeToMiniProgram(type) {
  return type === "VIDEO" ? "video" : "article";
}

function mapLessonTypeLabel(type) {
  return type === "VIDEO" ? "视频课" : "图文课";
}

function mapCourseStatusLabel(status) {
  if (status === "PUBLISHED") return "已发布";
  if (status === "HIDDEN") return "已隐藏";
  if (status === "DELETED") return "已删除";
  return "草稿";
}

function isMemberActive(member) {
  if (!member || member.status !== "ACTIVE") {
    return false;
  }

  if (!member.expireAt) {
    return true;
  }

  return new Date(member.expireAt).getTime() > Date.now();
}

async function resolveCourseViewerContext(input = {}) {
  const groupId = normalizeString(input.groupId);
  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId);

  if (!viewerId || !groupId) {
    return {
      viewerId,
      canManage: false,
      isActiveMember: false,
    };
  }

  const [managerAccess, groupMember] = await Promise.all([
    getGroupManagerAccess(groupId, viewerId),
    prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: viewerId,
        },
      },
      select: {
        status: true,
        expireAt: true,
      },
    }),
  ]);

  return {
    viewerId,
    canManage: Boolean(managerAccess && managerAccess.canManage),
    isActiveMember: isMemberActive(groupMember),
  };
}

function canViewerAccessLesson(course, lesson, viewerContext) {
  if (!course || !lesson) {
    return false;
  }

  if (viewerContext && viewerContext.canManage) {
    return true;
  }

  if (course.accessType === "FREE") {
    return true;
  }

  if (lesson.isTrial) {
    return true;
  }

  if (course.accessType === "MEMBER") {
    return Boolean(viewerContext && viewerContext.isActiveMember);
  }

  return false;
}

function buildProgressMap(progressItems) {
  return Array.isArray(progressItems)
    ? progressItems.reduce((result, item) => {
        result[item.lessonId] = item;
        return result;
      }, {})
    : {};
}

function buildLessonDto(course, lesson, lessonIndex, viewerContext, progressMap) {
  const canAccess = canViewerAccessLesson(course, lesson, viewerContext);
  const courseTitle = normalizeString(course.title);
  const articleParagraphs = canAccess ? splitTextParagraphs(lesson.contentText) : [];
  const articleImages = canAccess ? normalizeImageList(lesson.images) : [];
  const progress = progressMap && progressMap[lesson.id] ? progressMap[lesson.id] : null;
  const lessonType = mapLessonTypeToMiniProgram(lesson.lessonType);
  const courseAccessType = normalizeString(course.accessType);
  const lockedReason =
    canAccess
      ? ""
      : courseAccessType === "MEMBER"
        ? course.groupId
          ? "当前课程需要有效成员身份后才能学习完整内容。"
          : "当前课程需要会员权限后才能学习完整内容。"
        : "当前课节仅开放试看，完整内容需后续接入付费解锁。";

  return {
    id: lesson.id,
    courseId: course.id,
    courseTitle,
    title: normalizeString(lesson.title),
    summary: normalizeString(lesson.summary),
    type: lessonType,
    typeLabel: mapLessonTypeLabel(lesson.lessonType),
    duration: normalizeString(lesson.durationText),
    sortOrder: parseNonNegativeInt(lesson.sortOrder, Math.max(0, lessonIndex)),
    order: lessonIndex + 1,
    orderLabel: `第 ${lessonIndex + 1} 节`,
    videoUrl: canAccess ? normalizeString(lesson.videoUrl) : "",
    posterImage: normalizeString(lesson.posterImage || lesson.coverImage || course.coverImage),
    article: {
      coverImage: normalizeString(lesson.coverImage || lesson.posterImage || course.coverImage),
      paragraphs: articleParagraphs,
      images: articleImages,
    },
    contentText: canAccess ? normalizeString(lesson.contentText) : "",
    richContent: canAccess ? normalizeString(lesson.richContent) : "",
    coverImage: normalizeString(lesson.coverImage || lesson.posterImage || course.coverImage),
    images: articleImages,
    isTrial: Boolean(lesson.isTrial),
    status: lesson.status,
    statusLabel: mapCourseStatusLabel(lesson.status),
    canAccess,
    lockedReason,
    progress: progress
      ? {
          isCompleted: Boolean(progress.isCompleted),
          lastPositionSec: parseNonNegativeInt(progress.lastPositionSec, 0),
          completedAt: toIso(progress.completedAt),
          updatedAt: toIso(progress.updatedAt),
        }
      : null,
  };
}

function buildCourseDto(course, options = {}) {
  const viewerContext = options.viewerContext || { canManage: false, isActiveMember: false };
  const includeLessons = options.includeLessons !== false;
  const progressMap = options.progressMap || {};
  const lessons = Array.isArray(course.lessons)
    ? course.lessons
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.getTime() - right.createdAt.getTime())
        .map((lesson, index) => buildLessonDto(course, lesson, index, viewerContext, progressMap))
    : [];
  const completedLessonCount = lessons.filter((lesson) => lesson.progress && lesson.progress.isCompleted).length;
  const updatedAtIso = toIso(course.updatedAt);

  return {
    id: course.id,
    groupId: normalizeString(course.groupId),
    title: normalizeString(course.title),
    subtitle: normalizeString(course.subtitle),
    summary: normalizeString(course.summary),
    category: normalizeString(course.category) || "全部课程",
    difficulty: normalizeString(course.difficulty) || "基础",
    updatedAt: toDateLabel(course.updatedAt) || updatedAtIso,
    updatedAtIso,
    coverImage: normalizeString(course.coverImage),
    tags: normalizeTagList(course.tags),
    lessons: includeLessons ? lessons : [],
    lessonCount: lessons.length,
    lessonCountLabel: `${lessons.length} 节课时`,
    firstLessonId: lessons[0] ? lessons[0].id : "",
    hasVideoLesson: lessons.some((lesson) => lesson.type === "video"),
    hasArticleLesson: lessons.some((lesson) => lesson.type === "article"),
    completedLessonCount,
    completedLessonCountLabel: `${completedLessonCount}/${lessons.length}`,
    status: course.status,
    statusLabel: mapCourseStatusLabel(course.status),
    accessType: course.accessType,
    priceAmount: toNumber(course.priceAmount),
    priceLabel: formatPriceLabel(course.accessType, course.priceAmount),
    sortOrder: parseNonNegativeInt(course.sortOrder, 0),
    publishedAt: toIso(course.publishedAt),
    createdAt: toIso(course.createdAt),
    lastLessonId: lessons.length ? lessons[lessons.length - 1].id : "",
  };
}

function buildCourseCategoryTabs(courses) {
  const counts = courses.reduce((result, item) => {
    const key = item.category || "全部课程";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  const categoryEntries = Object.entries(counts).sort((left, right) => left[0].localeCompare(right[0], "zh-Hans-CN"));
  return [
    {
      key: "all",
      label: "全部课程",
      count: courses.length,
    },
    ...categoryEntries.map(([label, count]) => ({
      key: label,
      label,
      count,
    })),
  ];
}

function buildCourseSearchWhere(search) {
  const normalizedSearch = normalizeString(search);
  if (!normalizedSearch) {
    return null;
  }

  return {
    OR: [
      {
        title: {
          contains: normalizedSearch,
          mode: "insensitive",
        },
      },
      {
        subtitle: {
          contains: normalizedSearch,
          mode: "insensitive",
        },
      },
      {
        summary: {
          contains: normalizedSearch,
          mode: "insensitive",
        },
      },
      {
        category: {
          contains: normalizedSearch,
          mode: "insensitive",
        },
      },
      {
        lessons: {
          some: {
            OR: [
              {
                title: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
              {
                summary: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      },
    ],
  };
}

function buildCourseListWhere(input, viewerContext, includeRestricted) {
  const where = {};
  const groupId = normalizeString(input.groupId);
  if (groupId) {
    where.groupId = groupId;
  }

  if (input.category && normalizeString(input.category).toLowerCase() !== "all") {
    where.category = normalizeString(input.category);
  }

  const status = normalizeCourseStatus(input.status, true);
  if (includeRestricted && viewerContext && viewerContext.canManage) {
    if (status && status !== "ALL") {
      where.status = status;
    }
  } else {
    where.status = "PUBLISHED";
  }

  const searchWhere = buildCourseSearchWhere(input.search);
  if (searchWhere) {
    Object.assign(where, searchWhere);
  }

  return where;
}

async function assertCourseAdminAccess(input = {}) {
  const adminUserId = normalizeString(input.adminUserId);
  if (!adminUserId) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "请先登录课程后台后再操作",
      },
    };
  }

  return {
    statusCode: 200,
    data: {
      viewerId: adminUserId,
    },
  };
}

async function listCourses(input = {}) {
  const groupId = normalizeString(input.groupId);
  const viewerContext = groupId
    ? await resolveCourseViewerContext({
        groupId,
        sessionToken: input.sessionToken,
        userId: input.userId,
      })
    : { viewerId: "", canManage: false, isActiveMember: false };
  const page = parsePositiveInt(input.page, 1, 10000);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const includeRestricted = normalizeBooleanFlag(input.includeRestricted, false);
  const where = buildCourseListWhere(input, viewerContext, includeRestricted);
  const categoryWhere = buildCourseListWhere({ ...input, category: "" }, viewerContext, includeRestricted);

  const [total, rows, categoryRows] = await Promise.all([
    prisma.course.count({ where }),
    prisma.course.findMany({
      where,
      include: {
        lessons: {
          where: viewerContext.canManage ? undefined : { status: "PUBLISHED" },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.findMany({
      where: categoryWhere,
      select: {
        id: true,
        category: true,
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
  ]);

  const items = rows.map((course) =>
    buildCourseDto(course, {
      includeLessons: true,
      viewerContext,
    })
  );
  const categories = buildCourseCategoryTabs(
    categoryRows.map((item) => ({
      id: item.id,
      category: normalizeString(item.category) || "全部课程",
    }))
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        page,
        pageSize,
        total,
        totalPages: total ? Math.ceil(total / pageSize) : 0,
        categories,
        filters: {
          groupId,
          search: normalizeString(input.search),
          category: normalizeString(input.category),
          includeRestricted: includeRestricted && viewerContext.canManage,
        },
        items,
      },
    },
  };
}

async function getCourseDetail(input = {}) {
  const courseId = normalizeString(input.courseId || input.id);
  if (!courseId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课程ID",
      },
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!course) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课程不存在或已删除",
      },
    };
  }

  const viewerContext = await resolveCourseViewerContext({
    groupId: course.groupId,
    sessionToken: input.sessionToken,
    userId: input.userId,
  });

  if (course.status !== "PUBLISHED" && !viewerContext.canManage) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课程不存在或已下架",
      },
    };
  }

  const visibleLessons = viewerContext.canManage
    ? course.lessons
    : course.lessons.filter((lesson) => lesson.status === "PUBLISHED");
  const progressItems = viewerContext.viewerId
    ? await prisma.courseProgress.findMany({
        where: {
          courseId: course.id,
          userId: viewerContext.viewerId,
        },
      })
    : [];

  const payloadCourse = buildCourseDto(
    {
      ...course,
      lessons: visibleLessons,
    },
    {
      includeLessons: true,
      viewerContext,
      progressMap: buildProgressMap(progressItems),
    }
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: payloadCourse,
    },
  };
}

async function getCourseLessonDetail(input = {}) {
  const lessonId = normalizeString(input.lessonId || input.id);
  if (!lessonId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课节ID",
      },
    };
  }

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        include: {
          lessons: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!lesson || !lesson.course) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课节不存在或已删除",
      },
    };
  }

  const viewerContext = await resolveCourseViewerContext({
    groupId: lesson.course.groupId,
    sessionToken: input.sessionToken,
    userId: input.userId,
  });

  if (lesson.course.status !== "PUBLISHED" && !viewerContext.canManage) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课程不存在或已下架",
      },
    };
  }

  if (lesson.status !== "PUBLISHED" && !viewerContext.canManage) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课节不存在或已下架",
      },
    };
  }

  const visibleLessons = viewerContext.canManage
    ? lesson.course.lessons
    : lesson.course.lessons.filter((item) => item.status === "PUBLISHED");
  const lessonIndex = visibleLessons.findIndex((item) => item.id === lesson.id);
  if (lessonIndex < 0) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课节不存在或已下架",
      },
    };
  }

  const progressItems = viewerContext.viewerId
    ? await prisma.courseProgress.findMany({
        where: {
          courseId: lesson.course.id,
          userId: viewerContext.viewerId,
        },
      })
    : [];
  const progressMap = buildProgressMap(progressItems);
  const previousLesson = lessonIndex > 0 ? visibleLessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex < visibleLessons.length - 1 ? visibleLessons[lessonIndex + 1] : null;
  const payloadCourse = buildCourseDto(
    {
      ...lesson.course,
      lessons: visibleLessons,
    },
    {
      includeLessons: true,
      viewerContext,
      progressMap,
    }
  );
  const payloadLesson = payloadCourse.lessons[lessonIndex];
  const previousPayload = previousLesson
    ? buildLessonDto(lesson.course, previousLesson, lessonIndex - 1, viewerContext, progressMap)
    : null;
  const nextPayload = nextLesson
    ? buildLessonDto(lesson.course, nextLesson, lessonIndex + 1, viewerContext, progressMap)
    : null;
  const paywall = payloadLesson.canAccess
    ? null
    : {
        show: true,
        title:
          lesson.course.accessType === "MEMBER"
            ? lesson.course.groupId
              ? "当前课节需要有效成员身份后才能学习完整内容"
              : "当前课节需要会员权限后才能学习完整内容"
            : "当前课节仅开放试看，完整解锁能力将在下一阶段接入",
        buttonText: lesson.course.accessType === "MEMBER" ? "等待会员解锁能力接入" : "等待付费解锁能力接入",
      };

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        course: payloadCourse,
        lesson: payloadLesson,
        previousLesson: previousPayload,
        nextLesson: nextPayload,
        lessonIndex: lessonIndex + 1,
        lessonTotal: visibleLessons.length,
        paywall,
      },
    },
  };
}

async function saveCourseProgress(input = {}) {
  const lessonId = normalizeString(input.lessonId);
  if (!lessonId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课节ID",
      },
    };
  }

  const viewerId = await resolveViewerIdentity(input.sessionToken, input.userId);
  if (!viewerId) {
    return {
      statusCode: 401,
      payload: {
        ok: false,
        message: "请先登录后再同步学习进度",
      },
    };
  }

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      course: true,
    },
  });

  if (!lesson || !lesson.course) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课节不存在或已删除",
      },
    };
  }

  const viewerContext = await resolveCourseViewerContext({
    groupId: lesson.course.groupId,
    sessionToken: input.sessionToken,
    userId: viewerId,
  });

  if (!canViewerAccessLesson(lesson.course, lesson, viewerContext)) {
    return {
      statusCode: 403,
      payload: {
        ok: false,
        message: "当前课节暂不可写入学习进度",
      },
    };
  }

  const isCompleted = normalizeBooleanFlag(input.isCompleted, false);
  const progress = await prisma.courseProgress.upsert({
    where: {
      lessonId_userId: {
        lessonId,
        userId: viewerId,
      },
    },
    create: {
      courseId: lesson.courseId,
      lessonId,
      userId: viewerId,
      isCompleted,
      lastPositionSec: parseNonNegativeInt(input.lastPositionSec, 0),
      completedAt: isCompleted ? new Date() : null,
    },
    update: {
      isCompleted,
      lastPositionSec: parseNonNegativeInt(input.lastPositionSec, 0),
      completedAt: isCompleted ? new Date() : null,
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        id: progress.id,
        courseId: progress.courseId,
        lessonId: progress.lessonId,
        userId: progress.userId,
        isCompleted: Boolean(progress.isCompleted),
        lastPositionSec: parseNonNegativeInt(progress.lastPositionSec, 0),
        completedAt: toIso(progress.completedAt),
        updatedAt: toIso(progress.updatedAt),
      },
    },
  };
}

async function listAdminCourses(input = {}) {
  const guard = await assertCourseAdminAccess(input);
  if (guard.statusCode !== 200) {
    return {
      statusCode: guard.statusCode,
      payload: guard.payload,
    };
  }

  const page = parsePositiveInt(input.page, 1, 10000);
  const pageSize = parsePositiveInt(input.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const search = normalizeString(input.search);
  const status = normalizeCourseStatus(input.status, true);
  const groupId = normalizeString(input.groupId);
  const where = {};

  if (groupId) {
    where.groupId = groupId;
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  const searchWhere = buildCourseSearchWhere(search);
  if (searchWhere) {
    Object.assign(where, searchWhere);
  }

  const [rows, total] = await Promise.all([
    prisma.course.findMany({
      where,
      include: {
        lessons: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.count({ where }),
  ]);

  const items = rows.map((course) =>
    buildCourseDto(course, {
      includeLessons: true,
      viewerContext: {
        canManage: true,
        isActiveMember: true,
      },
    })
  );

  const summary = items.reduce(
    (result, item) => {
      result.total += 1;
      if (item.status === "PUBLISHED") result.published += 1;
      if (item.status === "DRAFT") result.draft += 1;
      if (item.status === "HIDDEN") result.hidden += 1;
      if (item.status === "DELETED") result.deleted += 1;
      return result;
    },
    {
      total: 0,
      draft: 0,
      published: 0,
      hidden: 0,
      deleted: 0,
    }
  );

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: {
        page,
        pageSize,
        total,
        totalPages: total ? Math.ceil(total / pageSize) : 0,
        filters: {
          groupId,
          status: status || "ALL",
          search,
        },
        summary,
        items,
      },
    },
  };
}

async function getAdminCourseDetail(input = {}) {
  const courseId = normalizeString(input.courseId || input.id);
  if (!courseId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课程ID",
      },
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!course) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课程不存在或已删除",
      },
    };
  }

  const guard = await assertCourseAdminAccess(input);
  if (guard.statusCode !== 200) {
    return {
      statusCode: guard.statusCode,
      payload: guard.payload,
    };
  }

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildCourseDto(course, {
        includeLessons: true,
        viewerContext: {
          canManage: true,
          isActiveMember: true,
        },
      }),
    },
  };
}

function buildCourseWriteData(input = {}, preserveData = {}) {
  const nextAccessType = normalizeCourseAccessType(input.accessType) || normalizeCourseAccessType(preserveData.accessType) || "FREE";
  const nextPriceAmount = nextAccessType === "PAID" ? toNumber(input.priceAmount || preserveData.priceAmount) : 0;

  return {
    title: normalizeString(input.title),
    subtitle: normalizeOptionalString(input.subtitle),
    summary: normalizeOptionalString(input.summary),
    category: normalizeOptionalString(input.category),
    difficulty: normalizeOptionalString(input.difficulty),
    coverImage: normalizeOptionalString(input.coverImage || input.coverImageUrl),
    tags: normalizeTagList(input.tags !== undefined ? input.tags : preserveData.tags),
    accessType: nextAccessType,
    priceAmount: nextPriceAmount,
    sortOrder: parseNonNegativeInt(input.sortOrder, parseNonNegativeInt(preserveData.sortOrder, 0)),
  };
}

async function saveAdminCourse(input = {}) {
  const courseId = normalizeString(input.courseId || input.id);

  if (courseId) {
    const existingCourse = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        groupId: true,
        accessType: true,
        priceAmount: true,
        sortOrder: true,
        tags: true,
      },
    });

    if (!existingCourse) {
      return {
        statusCode: 404,
        payload: {
          ok: false,
          message: "课程不存在或已删除",
        },
      };
    }

    const guard = await assertCourseAdminAccess(input);
    if (guard.statusCode !== 200) {
      return {
        statusCode: guard.statusCode,
        payload: guard.payload,
      };
    }

    const title = normalizeString(input.title);
    if (!title) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          message: "课程标题不能为空",
        },
      };
    }

    const updatedCourse = await prisma.course.update({
      where: { id: courseId },
      data: buildCourseWriteData(
        {
          ...input,
          title,
        },
        existingCourse
      ),
      include: {
        lessons: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: buildCourseDto(updatedCourse, {
          includeLessons: true,
          viewerContext: {
            canManage: true,
            isActiveMember: true,
          },
        }),
      },
    };
  }

  const guard = await assertCourseAdminAccess(input);
  if (guard.statusCode !== 200) {
    return {
      statusCode: guard.statusCode,
      payload: guard.payload,
    };
  }

  const title = normalizeString(input.title);
  if (!title) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "课程标题不能为空",
      },
    };
  }

  const createdCourse = await prisma.course.create({
    data: buildCourseWriteData({
      ...input,
      title,
    }),
    include: {
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildCourseDto(createdCourse, {
        includeLessons: true,
        viewerContext: {
          canManage: true,
          isActiveMember: true,
        },
      }),
    },
  };
}

async function updateAdminCourseStatus(input = {}) {
  const courseId = normalizeString(input.courseId || input.id);
  const nextStatus = normalizeCourseStatus(input.status);

  if (!courseId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课程ID",
      },
    };
  }

  if (!nextStatus) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "课程状态不合法",
      },
    };
  }

  const existingCourse = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!existingCourse) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课程不存在或已删除",
      },
    };
  }

  const guard = await assertCourseAdminAccess(input);
  if (guard.statusCode !== 200) {
    return {
      statusCode: guard.statusCode,
      payload: guard.payload,
    };
  }

  if (nextStatus === "PUBLISHED") {
    const publishedLessonCount = existingCourse.lessons.filter((lesson) => lesson.status === "PUBLISHED").length;
    if (!publishedLessonCount) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          message: "请至少发布 1 个课节后再发布课程",
        },
      };
    }
  }

  const updatedCourse = await prisma.course.update({
    where: { id: courseId },
    data: {
      status: nextStatus,
      publishedAt: nextStatus === "PUBLISHED" ? new Date() : existingCourse.publishedAt,
    },
    include: {
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildCourseDto(updatedCourse, {
        includeLessons: true,
        viewerContext: {
          canManage: true,
          isActiveMember: true,
        },
      }),
    },
  };
}

function buildCourseLessonWriteData(input = {}, preserveData = {}) {
  const lessonType = normalizeCourseLessonType(input.lessonType || input.type || preserveData.lessonType);
  const contentText = normalizeOptionalString(input.contentText);
  const richContent =
    lessonType === "ARTICLE"
      ? normalizeOptionalString(input.richContent || (contentText ? contentText.replace(/\n/g, "<br/>") : ""))
      : normalizeOptionalString(input.richContent || preserveData.richContent);

  return {
    title: normalizeString(input.title),
    summary: normalizeOptionalString(input.summary),
    lessonType,
    videoUrl: lessonType === "VIDEO" ? normalizeOptionalString(input.videoUrl) : null,
    durationText: normalizeOptionalString(input.durationText || input.duration),
    contentText: lessonType === "ARTICLE" ? contentText : null,
    richContent: lessonType === "ARTICLE" ? richContent : null,
    coverImage: normalizeOptionalString(input.coverImage),
    posterImage: normalizeOptionalString(input.posterImage),
    images: normalizeImageList(input.images !== undefined ? input.images : preserveData.images),
    isTrial: normalizeBooleanFlag(input.isTrial, Boolean(preserveData.isTrial)),
    sortOrder: parseNonNegativeInt(input.sortOrder, parseNonNegativeInt(preserveData.sortOrder, 0)),
  };
}

async function saveAdminCourseLesson(input = {}) {
  const courseId = normalizeString(input.courseId);
  const lessonId = normalizeString(input.lessonId || input.id);

  if (!lessonId) {
    if (!courseId) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          message: "缺少课程ID",
        },
      };
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        groupId: true,
      },
    });

    if (!course) {
      return {
        statusCode: 404,
        payload: {
          ok: false,
          message: "课程不存在或已删除",
        },
      };
    }

    const guard = await assertCourseAdminAccess(input);
    if (guard.statusCode !== 200) {
      return {
        statusCode: guard.statusCode,
        payload: guard.payload,
      };
    }

    const title = normalizeString(input.title);
    if (!title) {
      return {
        statusCode: 400,
        payload: {
          ok: false,
          message: "课节标题不能为空",
        },
      };
    }

    const createdLesson = await prisma.courseLesson.create({
      data: {
        courseId: course.id,
        ...buildCourseLessonWriteData({
          ...input,
          title,
        }),
      },
      include: {
        course: {
          include: {
            lessons: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
      },
    });

    return {
      statusCode: 200,
      payload: {
        ok: true,
        data: buildLessonDto(
          createdLesson.course,
          createdLesson,
          createdLesson.course.lessons.findIndex((item) => item.id === createdLesson.id),
          { canManage: true, isActiveMember: true },
          {}
        ),
      },
    };
  }

  const existingLesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        include: {
          lessons: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!existingLesson || !existingLesson.course) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课节不存在或已删除",
      },
    };
  }

  const guard = await assertCourseAdminAccess(input);
  if (guard.statusCode !== 200) {
    return {
      statusCode: guard.statusCode,
      payload: guard.payload,
    };
  }

  const title = normalizeString(input.title);
  if (!title) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "课节标题不能为空",
      },
    };
  }

  const updatedLesson = await prisma.courseLesson.update({
    where: { id: lessonId },
    data: buildCourseLessonWriteData(
      {
        ...input,
        title,
      },
      existingLesson
    ),
    include: {
      course: {
        include: {
          lessons: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildLessonDto(
        updatedLesson.course,
        updatedLesson,
        updatedLesson.course.lessons.findIndex((item) => item.id === updatedLesson.id),
        { canManage: true, isActiveMember: true },
        {}
      ),
    },
  };
}

async function updateAdminCourseLessonStatus(input = {}) {
  const lessonId = normalizeString(input.lessonId || input.id);
  const nextStatus = normalizeCourseStatus(input.status);

  if (!lessonId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课节ID",
      },
    };
  }

  if (!nextStatus) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "课节状态不合法",
      },
    };
  }

  const lesson = await prisma.courseLesson.findUnique({
    where: { id: lessonId },
    include: {
      course: {
        include: {
          lessons: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!lesson || !lesson.course) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课节不存在或已删除",
      },
    };
  }

  const guard = await assertCourseAdminAccess(input);
  if (guard.statusCode !== 200) {
    return {
      statusCode: guard.statusCode,
      payload: guard.payload,
    };
  }

  const updatedLesson = await prisma.courseLesson.update({
    where: { id: lessonId },
    data: {
      status: nextStatus,
      publishedAt: nextStatus === "PUBLISHED" ? new Date() : lesson.publishedAt,
    },
    include: {
      course: {
        include: {
          lessons: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildLessonDto(
        updatedLesson.course,
        updatedLesson,
        updatedLesson.course.lessons.findIndex((item) => item.id === updatedLesson.id),
        { canManage: true, isActiveMember: true },
        {}
      ),
    },
  };
}

async function reorderAdminCourseLessons(input = {}) {
  const courseId = normalizeString(input.courseId);
  const lessonIds = Array.isArray(input.lessonIds) ? input.lessonIds.map((item) => normalizeString(item)).filter(Boolean) : [];

  if (!courseId) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课程ID",
      },
    };
  }

  if (!lessonIds.length) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "缺少课节排序数据",
      },
    };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!course) {
    return {
      statusCode: 404,
      payload: {
        ok: false,
        message: "课程不存在或已删除",
      },
    };
  }

  const guard = await assertCourseAdminAccess(input);
  if (guard.statusCode !== 200) {
    return {
      statusCode: guard.statusCode,
      payload: guard.payload,
    };
  }

  const existingLessonIds = new Set(course.lessons.map((lesson) => lesson.id));
  const normalizedUniqueLessonIds = Array.from(new Set(lessonIds));
  if (normalizedUniqueLessonIds.some((lessonId) => !existingLessonIds.has(lessonId))) {
    return {
      statusCode: 400,
      payload: {
        ok: false,
        message: "排序数据里包含无效课节",
      },
    };
  }

  await prisma.$transaction(
    normalizedUniqueLessonIds.map((lessonId, index) =>
      prisma.courseLesson.update({
        where: { id: lessonId },
        data: {
          sortOrder: index,
        },
      })
    )
  );

  const refreshedCourse = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      lessons: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  return {
    statusCode: 200,
    payload: {
      ok: true,
      data: buildCourseDto(refreshedCourse, {
        includeLessons: true,
        viewerContext: {
          canManage: true,
          isActiveMember: true,
        },
      }),
    },
  };
}

module.exports = {
  listCourses,
  getCourseDetail,
  getCourseLessonDetail,
  saveCourseProgress,
  listAdminCourses,
  getAdminCourseDetail,
  saveAdminCourse,
  updateAdminCourseStatus,
  saveAdminCourseLesson,
  updateAdminCourseLessonStatus,
  reorderAdminCourseLessons,
};
