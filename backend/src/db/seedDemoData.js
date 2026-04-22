const { prisma } = require("./prisma");

const IDS = {
  ownerUser: "usr_owner_001",
  buyerUser: "usr_buyer_001",
  group: "grp_datawhale_001",
  policy: "gpp_001",
  ownerMember: "mbr_owner_001",
  buyerMember: "mbr_buyer_001",
  coupon: "cpn_new_001",
  channel: "chn_wechat_menu_001",
  channelMoments: "chn_moments_001",
};

const EXTRA_GROUP_SCENARIOS = [
  {
    id: "grp_empty_001",
    policyId: "gpp_empty_001",
    slug: "xueyin-empty-demo",
    name: "空内容演示星球",
    externalGroupId: "28882120000001",
    intro: "用于验证后台空状态、空列表和默认提示。",
    description: "空内容星球样本",
    priceAmount: 99,
    originalPriceAmount: 99,
    memberCount: 1,
    paidMemberCount: 1,
    contentCount: 0,
    publishedDaysAgo: 12,
    allowSearch: false,
  },
  {
    id: "grp_multi_admin_001",
    policyId: "gpp_multi_admin_001",
    slug: "xueyin-multi-admin-demo",
    name: "多管理员协作星球",
    externalGroupId: "28882120000002",
    intro: "用于验证合伙人、管理员、权限设置和成员协作场景。",
    description: "多管理员星球样本",
    priceAmount: 199,
    originalPriceAmount: 299,
    memberCount: 4,
    paidMemberCount: 4,
    contentCount: 2,
    publishedDaysAgo: 40,
    allowVirtualPayJoin: true,
    allowVirtualPayRenewal: true,
  },
  {
    id: "grp_review_001",
    policyId: "gpp_review_001",
    slug: "xueyin-review-demo",
    name: "审核流演示星球",
    externalGroupId: "28882120000003",
    intro: "用于验证内容审核中、已拒绝和已通过的后台视图。",
    description: "内容审核星球样本",
    priceAmount: 149,
    originalPriceAmount: 149,
    memberCount: 3,
    paidMemberCount: 3,
    contentCount: 2,
    publishedDaysAgo: 18,
    needExamine: true,
  },
];

const EXTRA_STAFF_SCENARIOS = [
  {
    userId: "usr_partner_001",
    mobile: "13800002001",
    nickname: "合伙人王策",
    bio: "多管理员样本：合伙人账号。",
    wechatNo: "partner_wangce",
    role: "PARTNER",
    groupId: "grp_multi_admin_001",
    memberId: "mbr_partner_001",
    memberNo: 2,
  },
  {
    userId: "usr_admin_001",
    mobile: "13800002002",
    nickname: "管理员周沐",
    bio: "多管理员样本：管理员账号。",
    wechatNo: "admin_zhoumu",
    role: "ADMIN",
    groupId: "grp_multi_admin_001",
    memberId: "mbr_admin_001",
    memberNo: 3,
  },
];

const EXTRA_GROUP_MEMBER_SCENARIOS = [
  {
    userId: "usr_multi_member_001",
    mobile: "13800002005",
    nickname: "协作普通成员",
    bio: "多管理员星球中的普通成员，用于验证角色混合列表和详情侧栏。",
    wechatNo: "collab_member",
    groupId: "grp_multi_admin_001",
    memberId: "mbr_multi_member_001",
    memberNo: 4,
    status: "ACTIVE",
    isPaid: true,
    expireOffsetDays: 45,
    renewTimes: 1,
    topicCount: 0,
  },
  {
    userId: "usr_review_member_001",
    mobile: "13800002003",
    nickname: "审核样本成员",
    bio: "审核星球中的正常付费成员。",
    wechatNo: "review_member",
    groupId: "grp_review_001",
    memberId: "mbr_review_member_001",
    memberNo: 2,
    status: "ACTIVE",
    isPaid: true,
    expireOffsetDays: 120,
    renewTimes: 2,
    topicCount: 1,
  },
  {
    userId: "usr_review_expired_001",
    mobile: "13800002004",
    nickname: "审核星球过期成员",
    bio: "审核星球中过期成员，用于验证用户/管理视角一致性。",
    wechatNo: "review_expired",
    groupId: "grp_review_001",
    memberId: "mbr_review_expired_001",
    memberNo: 3,
    status: "EXPIRED",
    isPaid: true,
    expireOffsetDays: -3,
    renewTimes: 0,
    topicCount: 0,
  },
];

const REVIEW_APPLICATION_SCENARIOS = [
  {
    userId: "usr_review_pending_001",
    mobile: "13800002006",
    nickname: "待审核加入用户",
    bio: "审核流样本：已支付但等待管理员审核。",
    wechatNo: "review_pending_user",
    groupId: "grp_review_001",
    orderId: "ord_review_pending_001",
    orderNo: "JOIN_REVIEW_PENDING_001",
    amount: 149,
    paidDaysAgo: 1,
    reviewStatus: "PENDING",
    reviewReason: "",
  },
  {
    userId: "usr_review_rejected_001",
    mobile: "13800002007",
    nickname: "已驳回加入用户",
    bio: "审核流样本：已支付后被驳回，便于验证后台与用户端提示。",
    wechatNo: "review_rejected_user",
    groupId: "grp_review_001",
    orderId: "ord_review_rejected_001",
    orderNo: "JOIN_REVIEW_REJECTED_001",
    amount: 149,
    paidDaysAgo: 2,
    reviewStatus: "REJECTED",
    reviewReason: "请先补充入圈说明，再联系管理员处理。",
  },
  {
    userId: "usr_review_reapplied_001",
    mobile: "13800002008",
    nickname: "多次重提加入用户",
    bio: "审核流样本：被驳回后重复提交，便于验证后台对重提记录的展示。",
    wechatNo: "review_reapplied_user",
    groupId: "grp_review_001",
    orderId: "ord_review_reapplied_001",
    orderNo: "JOIN_REVIEW_REAPPLIED_001",
    amount: 149,
    paidDaysAgo: 3,
    reviewStatus: "REJECTED",
    reviewReason: "已重新提交 2 次，仍缺少完整的入圈说明。",
    reviewSubmittedHoursAfterPaid: 26,
    reviewedHoursAfterPaid: 30,
    reapplyCount: 2,
    lastReappliedHoursAfterPaid: 26,
  },
  {
    userId: "usr_review_pending_reapply_001",
    mobile: "13800002009",
    nickname: "重提待审核用户",
    bio: "审核流样本：被驳回后再次提交，目前仍在等待管理员审核。",
    wechatNo: "review_pending_reapply_user",
    groupId: "grp_review_001",
    orderId: "ord_review_pending_reapply_001",
    orderNo: "JOIN_REVIEW_PENDING_REAPPLY_001",
    amount: 149,
    paidDaysAgo: 2,
    reviewStatus: "PENDING",
    reviewReason: "",
    reviewSubmittedHoursAfterPaid: 31,
    reapplyCount: 1,
    lastReappliedHoursAfterPaid: 31,
  },
];

const LEGACY_DISCOVER_GROUP_IDS = [
  "grp_discover_shengcai_001",
  "grp_discover_aipoju_001",
  "grp_discover_3dvision_001",
  "grp_discover_xiaohui_001",
  "grp_discover_zhenge_001",
];

const LEGACY_DISCOVER_OWNER_IDS = [
  "usr_discover_owner_001",
  "usr_discover_owner_002",
  "usr_discover_owner_003",
  "usr_discover_owner_004",
  "usr_discover_owner_005",
];

const EXTRA_COLUMN_POSTS = [
  {
    id: "pst_column_startups_001",
    columnId: "col_startups_001",
    title: "适合程序员的轻创业项目 01: AI 简历优化服务",
    summary: "从需求验证到报价方式，拆出能最快上线的一版。",
    contentText: "这个项目的关键不在技术难度，而在于你能不能把简历诊断、改写和投递建议包装成一个可感知的结果。",
    publishedAtOffsetHours: 9,
  },
  {
    id: "pst_column_startups_002",
    columnId: "col_startups_001",
    title: "适合程序员的轻创业项目 02: 行业资讯自动摘要",
    summary: "用抓取 + 摘要 + 模板分发做一个细分行业情报产品。",
    contentText: "针对跨境、电商、AI 工具这类强信息密度行业，自动摘要和分发就是一个很好的低成本切入口。",
    publishedAtOffsetHours: 10,
  },
  {
    id: "pst_column_ai_tools_001",
    columnId: "col_ai_tools_001",
    title: "ChatGPT、Claude、DeepSeek 怎么选？",
    summary: "按写作、编程、推理、价格四个维度做横向对比。",
    contentText: "不要笼统说哪个好，而是看具体场景。编程、长文本、推理和性价比，答案都不一样。",
    publishedAtOffsetHours: 11,
  },
  {
    id: "pst_column_ai_tools_002",
    columnId: "col_ai_tools_001",
    title: "Cursor 真能提效吗？一周重度使用复盘",
    summary: "哪些环节明显提效，哪些环节容易制造幻觉代码。",
    contentText: "Cursor 确实能让改小需求更快，但如果没有任务拆分和验收习惯，返工会非常严重。",
    publishedAtOffsetHours: 12,
  },
  {
    id: "pst_column_yian_tools_001",
    columnId: "col_yian_tools_001",
    title: "我自己常用的 12 个 AI 工具清单",
    summary: "覆盖写作、画图、录音整理、代码和自动化。",
    contentText: "这不是工具大全，而是一套我自己会反复打开的工作台，重点看工具之间如何接力。",
    publishedAtOffsetHours: 13,
  },
  {
    id: "pst_column_insight_001",
    columnId: "col_insight_001",
    title: "为什么很多知识付费产品做不成复购",
    summary: "不是内容不够多，而是用户没建立明确的结果预期。",
    contentText: "复购低的根因通常不是交付次数，而是用户没有把你的内容和他的结果绑定起来。",
    publishedAtOffsetHours: 14,
  },
];

const ADMIN_MEMBER_SCENARIOS = [
  {
    userId: "usr_admin_active_001",
    memberId: "mbr_admin_active_001",
    mobile: "13800001001",
    nickname: "活跃成员李雷",
    bio: "正常活跃成员，用于验证成员列表默认状态。",
    memberNo: 2,
    status: "ACTIVE",
    joinSource: "QR_CODE",
    isPaid: true,
    expireOffsetDays: 18,
    lastActiveOffsetHours: 6,
    renewTimes: 1,
    phone: "13800001001",
    wechatNo: "lilei_ai",
  },
  {
    userId: "usr_admin_boundary_001",
    memberId: "mbr_admin_boundary_001",
    mobile: "13800001002",
    nickname: "边界昵称成员ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    bio: "边界数据：长昵称、高续期次数、即将到期。",
    memberNo: 3,
    status: "ACTIVE",
    joinSource: "COUPON",
    isPaid: true,
    expireOffsetDays: 1,
    lastActiveOffsetHours: 1,
    renewTimes: 12,
    phone: "13800001002",
    wechatNo: "boundary_member",
  },
  {
    userId: "usr_admin_expired_001",
    memberId: "mbr_admin_expired_001",
    mobile: "13800001003",
    nickname: "过期成员韩梅梅",
    bio: "异常状态：会员已过期，用于续期召回筛选。",
    memberNo: 4,
    status: "EXPIRED",
    joinSource: "DIRECT",
    isPaid: true,
    expireOffsetDays: -7,
    lastActiveOffsetHours: 96,
    renewTimes: 0,
    phone: "13800001003",
    wechatNo: "hanmeimei_expired",
  },
  {
    userId: "usr_admin_banned_001",
    memberId: "mbr_admin_banned_001",
    mobile: "13800001004",
    nickname: "封禁成员样例",
    bio: "异常状态：被封禁成员，用于风控状态筛选。",
    memberNo: 5,
    status: "BANNED",
    joinSource: "MANUAL",
    isPaid: false,
    expireOffsetDays: 60,
    lastActiveOffsetHours: 240,
    renewTimes: 0,
    phone: "13800001004",
    wechatNo: "banned_sample",
  },
  {
    userId: "usr_admin_quit_001",
    memberId: "mbr_admin_quit_001",
    mobile: "13800001005",
    nickname: "已退出成员样例",
    bio: "异常状态：已退出成员，用于历史成员统计。",
    memberNo: 6,
    status: "QUIT",
    joinSource: "INVITE",
    isPaid: false,
    expireOffsetDays: -30,
    lastActiveOffsetHours: 360,
    renewTimes: 0,
    phone: "13800001005",
    wechatNo: "quit_sample",
  },
];

const ADMIN_CONTENT_SCENARIOS = [
  {
    id: "pst_admin_normal_topic_001",
    authorUserId: "usr_admin_active_001",
    type: "TOPIC",
    status: "PUBLISHED",
    title: "成员提问：如何把一个选题拆成连续 7 天内容？",
    summary: "正常数据：成员发布的主题帖，带评论与点赞。",
    contentText: "我想把 AI 工具测评拆成连续 7 天内容，请问应该如何安排节奏？",
    readingCount: 86,
    likeCount: 9,
    commentCount: 3,
    metadata: { reviewStatus: "APPROVED" },
    publishedAtOffsetHours: 16,
  },
  {
    id: "pst_admin_boundary_hot_001",
    authorUserId: IDS.ownerUser,
    type: "ARTICLE",
    status: "PUBLISHED",
    title: "边界数据：高阅读高互动内容复盘",
    summary: "边界数据：用于验证后台数字列、排序和长文标题展示。",
    contentText: "这篇内容用于验证后台对大数值阅读、点赞、评论的展示是否稳定。",
    readingCount: 99999,
    likeCount: 8888,
    commentCount: 777,
    isEssence: true,
    metadata: { columnId: "col_insight_001", columnTitle: "商业洞察", reviewStatus: "APPROVED" },
    publishedAtOffsetHours: 18,
  },
  {
    id: "pst_admin_draft_001",
    authorUserId: IDS.ownerUser,
    type: "ARTICLE",
    status: "DRAFT",
    title: "草稿内容：待完善的付费页优化清单",
    summary: "异常状态：草稿，不应该出现在用户端已发布列表。",
    contentText: "这里是还未发布的后台草稿，用于管理端筛选验证。",
    readingCount: 0,
    likeCount: 0,
    commentCount: 0,
    metadata: { reviewStatus: "PENDING" },
    publishedAtOffsetHours: null,
  },
  {
    id: "pst_admin_hidden_001",
    authorUserId: IDS.ownerUser,
    type: "NOTICE",
    status: "HIDDEN",
    title: "隐藏公告：历史活动关闭通知",
    summary: "异常状态：已隐藏公告，用于内容状态筛选。",
    contentText: "这条公告已隐藏，管理端可以看到，用户端不应该展示。",
    readingCount: 12,
    likeCount: 1,
    commentCount: 0,
    metadata: { reviewStatus: "REJECTED" },
    publishedAtOffsetHours: 48,
  },
  {
    id: "pst_admin_deleted_001",
    authorUserId: "usr_admin_banned_001",
    type: "TOPIC",
    status: "DELETED",
    title: "已删除内容样例",
    summary: "异常状态：软删除，用于后台审计和状态筛选。",
    contentText: "这条内容已被删除，只用于管理端验证。",
    readingCount: 3,
    likeCount: 0,
    commentCount: 0,
    metadata: { reviewStatus: "REJECTED" },
    publishedAtOffsetHours: 72,
  },
];

const EXTRA_GROUP_POST_SCENARIOS = [
  {
    id: "pst_multi_admin_notice_001",
    groupId: "grp_multi_admin_001",
    authorUserId: "usr_partner_001",
    type: "NOTICE",
    status: "PUBLISHED",
    title: "多管理员协作说明",
    summary: "合伙人与管理员共同维护的公告，用于验证角色权限。",
    contentText: "这是多管理员协作星球的置顶说明，后台需要同时看到多管理员角色与成员联系方式权限。",
    readingCount: 28,
    likeCount: 4,
    commentCount: 1,
    isPinned: true,
    metadata: { reviewStatus: "APPROVED" },
    publishedAtOffsetHours: 30,
  },
  {
    id: "pst_multi_admin_topic_001",
    groupId: "grp_multi_admin_001",
    authorUserId: "usr_admin_001",
    type: "TOPIC",
    status: "PUBLISHED",
    title: "管理员协作值班表",
    summary: "用于验证内容报表里管理员发帖、置顶、审核状态展示。",
    contentText: "今天由管理员处理值班和内容巡检，合伙人负责活动复盘与成员跟进。",
    readingCount: 14,
    likeCount: 2,
    commentCount: 0,
    metadata: { reviewStatus: "APPROVED" },
    publishedAtOffsetHours: 42,
  },
  {
    id: "pst_review_pending_001",
    groupId: "grp_review_001",
    authorUserId: "usr_review_member_001",
    type: "TOPIC",
    status: "DRAFT",
    title: "审核中内容样本",
    summary: "用于验证后台审核状态筛选、详情抽屉与状态切换。",
    contentText: "这条内容仍在审核中，用户端不应看到，管理端可以通过审核状态查看。",
    readingCount: 0,
    likeCount: 0,
    commentCount: 0,
    metadata: { reviewStatus: "PENDING" },
    publishedAtOffsetHours: null,
  },
  {
    id: "pst_review_rejected_001",
    groupId: "grp_review_001",
    authorUserId: IDS.ownerUser,
    type: "ARTICLE",
    status: "HIDDEN",
    title: "审核驳回内容样本",
    summary: "用于验证已驳回内容筛选。",
    contentText: "这条内容已经被驳回并隐藏，管理端需要能看到审核原因和状态。",
    readingCount: 6,
    likeCount: 0,
    commentCount: 0,
    metadata: { reviewStatus: "REJECTED", reviewReason: "附件描述不完整" },
    publishedAtOffsetHours: 55,
  },
];

const AUTHOR_WORKBENCH_POST_SCENARIOS = [
  {
    id: "pst_author_plain_001",
    authorUserId: IDS.buyerUser,
    type: "TOPIC",
    status: "PUBLISHED",
    title: "作者工作台样本：本周直播笔记整理",
    summary: "正常样本：已发布且无审核、投诉问题，用于验证我的主题默认态。",
    contentText: "把本周直播的重点结论整理成清单，方便回看和后续补充案例。",
    readingCount: 18,
    likeCount: 2,
    commentCount: 1,
    metadata: { reviewStatus: "APPROVED" },
    publishedAtOffsetHours: 10,
  },
  {
    id: "pst_author_review_pending_001",
    authorUserId: IDS.buyerUser,
    type: "TOPIC",
    status: "DRAFT",
    title: "作者工作台样本：审核中的活动预告",
    summary: "待处理样本：审核中草稿，用于验证作者工作台待处理筛选。",
    contentText: "这条内容还在等待管理员审核，审核通过前不会进入公开内容流。",
    readingCount: 0,
    likeCount: 0,
    commentCount: 0,
    metadata: { reviewStatus: "PENDING" },
    publishedAtOffsetHours: null,
  },
  {
    id: "pst_author_review_rejected_001",
    authorUserId: IDS.buyerUser,
    type: "ARTICLE",
    status: "DRAFT",
    title: "作者工作台样本：被驳回的招募贴",
    summary: "待处理样本：已驳回内容，用于验证驳回原因展示和继续编辑入口。",
    contentText: "管理员反馈标题过于营销化，需要补充更明确的活动说明。",
    readingCount: 0,
    likeCount: 0,
    commentCount: 0,
    metadata: {
      reviewStatus: "REJECTED",
      reviewReason: "活动规则描述不够完整，请补充时间、对象和参与方式后再提交。",
    },
    publishedAtOffsetHours: null,
  },
  {
    id: "pst_author_report_pending_001",
    authorUserId: IDS.buyerUser,
    type: "TOPIC",
    status: "PUBLISHED",
    title: "作者工作台样本：正在被投诉核查的清单帖",
    summary: "待处理样本：已发布但存在待处理投诉，用于验证投诉核查提示。",
    contentText: "这里汇总了几个常用工具和注册链接，管理员正在复核投诉原因。",
    readingCount: 42,
    likeCount: 5,
    commentCount: 2,
    metadata: {
      reviewStatus: "APPROVED",
      reportStatus: "PENDING",
      reportCount: 2,
      reportPendingCount: 2,
      reportResolvedCount: 0,
      reportIgnoredCount: 0,
      lastReportedAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
      lastReportedReason: "文中疑似包含导流链接，建议管理员复核。",
      reportResolutionNote: "",
      reportLogs: [
        {
          id: "rpt_author_pending_001",
          reporterUserId: IDS.ownerUser,
          reporterName: "星主A",
          reason: "文中疑似包含导流链接，建议管理员复核。",
          status: "PENDING",
          createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          resolvedAt: "",
          resolutionNote: "",
        },
        {
          id: "rpt_author_pending_002",
          reporterUserId: "usr_admin_active_001",
          reporterName: "活跃成员李雷",
          reason: "标题容易让人误解成外部课程广告，希望再确认一下。",
          status: "PENDING",
          createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
          resolvedAt: "",
          resolutionNote: "",
        },
      ],
    },
    publishedAtOffsetHours: 28,
  },
  {
    id: "pst_author_hidden_resolved_001",
    authorUserId: IDS.buyerUser,
    type: "NOTICE",
    status: "HIDDEN",
    title: "作者工作台样本：已隐藏的抽奖通知",
    summary: "已隐藏样本：管理员处理完成后隐藏的内容，用于验证隐藏筛选和处理说明。",
    contentText: "这条抽奖通知因为活动描述不完整被先行隐藏，后续可修改后重新发布。",
    readingCount: 9,
    likeCount: 0,
    commentCount: 0,
    metadata: {
      reviewStatus: "APPROVED",
      reportStatus: "RESOLVED",
      reportCount: 1,
      reportPendingCount: 0,
      reportResolvedCount: 1,
      reportIgnoredCount: 0,
      lastReportedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      lastReportedReason: "活动规则不完整，抽奖说明存在歧义。",
      reportResolutionNote: "已先隐藏该内容，请补充完整活动规则后再重新发布。",
      reportLogs: [
        {
          id: "rpt_author_hidden_001",
          reporterUserId: IDS.ownerUser,
          reporterName: "星主A",
          reason: "活动规则不完整，抽奖说明存在歧义。",
          status: "RESOLVED",
          createdAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          resolvedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
          resolutionNote: "已先隐藏该内容，请补充完整活动规则后再重新发布。",
        },
      ],
    },
    publishedAtOffsetHours: 52,
  },
];

function toDateOnly(daysAgo) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date;
}

async function upsertUserProfile(userId, mobile, nickname, bio, wechatNo) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      mobile,
      status: "ACTIVE",
    },
    create: {
      id: userId,
      mobile,
      status: "ACTIVE",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId },
    update: {
      nickname,
      avatarUrl: `https://img.example.com/${userId}.jpg`,
      bio,
      wechatNo,
    },
    create: {
      userId,
      nickname,
      avatarUrl: `https://img.example.com/${userId}.jpg`,
      bio,
      wechatNo,
    },
  });
}

async function upsertOwnerMembership(groupId, memberId, memberNo = 1) {
  await prisma.groupMember.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId: IDS.ownerUser,
      },
    },
    update: {
      memberNo,
      status: "ACTIVE",
      joinSource: "MANUAL",
      isPaid: true,
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(),
    },
    create: {
      id: memberId,
      groupId,
      userId: IDS.ownerUser,
      memberNo,
      status: "ACTIVE",
      joinSource: "MANUAL",
      isPaid: true,
      joinedAt: new Date(),
      firstJoinedAt: new Date(),
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(),
    },
  });

  await prisma.groupStaff.upsert({
    where: {
      groupId_userId: {
        groupId,
        userId: IDS.ownerUser,
      },
    },
    update: {
      role: "OWNER",
      isActive: true,
    },
    create: {
      groupId,
      userId: IDS.ownerUser,
      role: "OWNER",
      isActive: true,
    },
  });
}

async function upsertGroupStats(groupId, memberRows = [], contentRows = []) {
  for (const row of memberRows) {
    const statDate = toDateOnly(row.daysAgo);
    await prisma.groupMemberDailyStat.upsert({
      where: {
        groupId_statDate: {
          groupId,
          statDate,
        },
      },
      update: {
        totalMemberCount: row.totalMemberCount,
        paidMemberCount: row.paidMemberCount,
        freeMemberCount: row.freeMemberCount,
        quittedCount: row.quittedCount,
        activeMemberCount7d: row.activeMemberCount7d,
        weeklyActiveRate: row.weeklyActiveRate,
        appDownloadedCount: row.appDownloadedCount,
        appDownloadRate: row.appDownloadRate,
      },
      create: {
        groupId,
        statDate,
        totalMemberCount: row.totalMemberCount,
        paidMemberCount: row.paidMemberCount,
        freeMemberCount: row.freeMemberCount,
        quittedCount: row.quittedCount,
        activeMemberCount7d: row.activeMemberCount7d,
        weeklyActiveRate: row.weeklyActiveRate,
        appDownloadedCount: row.appDownloadedCount,
        appDownloadRate: row.appDownloadRate,
      },
    });
  }

  for (const row of contentRows) {
    const statDate = toDateOnly(row.daysAgo);
    await prisma.groupContentDailyStat.upsert({
      where: {
        groupId_statDate: {
          groupId,
          statDate,
        },
      },
      update: {
        topicCount: row.topicCount,
        fileCount: row.fileCount,
        imageCount: row.imageCount,
        commentCount: row.commentCount,
        likeCount: row.likeCount,
      },
      create: {
        groupId,
        statDate,
        topicCount: row.topicCount,
        fileCount: row.fileCount,
        imageCount: row.imageCount,
        commentCount: row.commentCount,
        likeCount: row.likeCount,
      },
    });
  }
}

async function ensureDemoData(options = {}) {
  const { resetRuntime = false } = options;

  const seedPostIds = [
    "pst_welcome_001", "pst_featured_001", "pst_file_001", "pst_answer_001",
    "pst_column_mcp_001", "pst_column_mcp_002", "pst_column_business_001",
    "pst_column_ai_programming_001", "pst_column_deepseek_001",
  ]
    .concat(EXTRA_COLUMN_POSTS.map((item) => item.id))
    .concat(ADMIN_CONTENT_SCENARIOS.map((item) => item.id))
    .concat(EXTRA_GROUP_POST_SCENARIOS.map((item) => item.id))
    .concat(AUTHOR_WORKBENCH_POST_SCENARIOS.map((item) => item.id));
  const seedCommentIds = ["cmt_demo_001", "cmt_demo_002"];

  if (resetRuntime) {
    await prisma.$transaction([
      prisma.couponClaim.deleteMany({}),
      prisma.paymentRecord.deleteMany({}),
      prisma.order.deleteMany({}),
      prisma.analyticsEvent.deleteMany({}),
      prisma.orderStatusLog.deleteMany({}),
      prisma.outboxJob.deleteMany({}),
      prisma.column.deleteMany({
        where: {
          groupId: IDS.group,
        },
      }),
      prisma.comment.deleteMany({
        where: {
          id: {
            in: seedCommentIds,
          },
        },
      }),
      prisma.post.deleteMany({
        where: {
          id: {
            in: seedPostIds,
          },
        },
      }),
      prisma.groupMember.deleteMany({
        where: {
          groupId: IDS.group,
          userId: IDS.buyerUser,
        },
      }),
    ]);

    await prisma.coupon.updateMany({
      where: { id: IDS.coupon },
      data: {
        usedQuantity: 0,
        visitCount: 0,
      },
    });

    await prisma.group.updateMany({
      where: { id: IDS.group },
      data: {
        memberCount: 1,
        paidMemberCount: 1,
      },
    });
  }

  await prisma.user.upsert({
    where: { id: IDS.ownerUser },
    update: {
      mobile: "13800000002",
      status: "ACTIVE",
    },
    create: {
      id: IDS.ownerUser,
      mobile: "13800000002",
      status: "ACTIVE",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: IDS.ownerUser },
    update: {
      nickname: "星主A",
      avatarUrl: "https://img.example.com/u2002.jpg",
      bio: "Datawhale 星球主理人",
    },
    create: {
      userId: IDS.ownerUser,
      nickname: "星主A",
      avatarUrl: "https://img.example.com/u2002.jpg",
      bio: "Datawhale 星球主理人",
    },
  });

  await prisma.user.upsert({
    where: { id: IDS.buyerUser },
    update: {
      mobile: "13800000001",
      status: "ACTIVE",
    },
    create: {
      id: IDS.buyerUser,
      mobile: "13800000001",
      status: "ACTIVE",
    },
  });

  await prisma.userProfile.upsert({
    where: { userId: IDS.buyerUser },
    update: {
      nickname: "张三",
      avatarUrl: "https://img.example.com/u2001.jpg",
      bio: "活跃体验会员，用于验证作者工作台、投诉流和用户端内容链路。",
    },
    create: {
      userId: IDS.buyerUser,
      nickname: "张三",
      avatarUrl: "https://img.example.com/u2001.jpg",
      bio: "活跃体验会员，用于验证作者工作台、投诉流和用户端内容链路。",
    },
  });

  await prisma.group.upsert({
    where: { id: IDS.group },
    update: {
      name: "Datawhale AI成长星球",
      slug: "datawhale-ai",
      externalGroupId: "555184444414",
      ownerUserId: IDS.ownerUser,
      intro: "一个围绕 AI 学习与实践的付费星球",
      description: "用户完成支付后可查看精华主题、作业和打卡任务。",
      joinType: "PAID",
      billingPeriod: "YEAR",
      priceAmount: 50,
      originalPriceAmount: 50,
      status: "ACTIVE",
      memberCount: 2,
      paidMemberCount: 2,
      contentCount: 1,
      publishedAt: new Date(),
    },
    create: {
      id: IDS.group,
      name: "Datawhale AI成长星球",
      slug: "datawhale-ai",
      externalGroupId: "555184444414",
      ownerUserId: IDS.ownerUser,
      intro: "一个围绕 AI 学习与实践的付费星球",
      description: "用户完成支付后可查看精华主题、作业和打卡任务。",
      joinType: "PAID",
      billingPeriod: "YEAR",
      priceAmount: 50,
      originalPriceAmount: 50,
      status: "ACTIVE",
      memberCount: 2,
      paidMemberCount: 2,
      contentCount: 1,
      publishedAt: new Date(),
    },
  });

  await prisma.groupPermissionPolicy.upsert({
    where: { groupId: IDS.group },
    update: {
      partnerCanViewWeeklyReport: true,
      adminCanViewWeeklyReport: true,
      allowJoin: true,
      needExamine: false,
      allowPreview: true,
      allowSearch: true,
      allowStarCoinJoin: false,
      allowStarCoinRenewal: false,
      allowVirtualPayJoin: false,
      allowVirtualPayRenewal: false,
    },
    create: {
      id: IDS.policy,
      groupId: IDS.group,
      partnerCanViewWeeklyReport: true,
      adminCanViewWeeklyReport: true,
      allowJoin: true,
      needExamine: false,
      allowPreview: true,
      allowSearch: true,
      allowStarCoinJoin: false,
      allowStarCoinRenewal: false,
      allowVirtualPayJoin: false,
      allowVirtualPayRenewal: false,
    },
  });

  await prisma.promotionChannel.upsert({
    where: { code: "CH_WECHAT_MENU_001" },
    update: {
      groupId: IDS.group,
      name: "公众号菜单",
      qrCodeUrl: "https://img.example.com/channel-menu-001.png",
      isEnabled: true,
    },
    create: {
      id: IDS.channel,
      groupId: IDS.group,
      name: "公众号菜单",
      code: "CH_WECHAT_MENU_001",
      qrCodeUrl: "https://img.example.com/channel-menu-001.png",
      isEnabled: true,
    },
  });

  await prisma.promotionChannel.upsert({
    where: { code: "CH_MOMENTS_001" },
    update: {
      groupId: IDS.group,
      name: "朋友圈海报",
      qrCodeUrl: "https://img.example.com/channel-moments-001.png",
      isEnabled: true,
    },
    create: {
      id: IDS.channelMoments,
      groupId: IDS.group,
      name: "朋友圈海报",
      code: "CH_MOMENTS_001",
      qrCodeUrl: "https://img.example.com/channel-moments-001.png",
      isEnabled: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: "NEW1000" },
    update: {
      groupId: IDS.group,
      type: "PROMOTION",
      name: "新人立减10元",
      amount: 10,
      totalQuantity: 100,
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: IDS.coupon,
      groupId: IDS.group,
      type: "PROMOTION",
      name: "新人立减10元",
      code: "NEW1000",
      amount: 10,
      totalQuantity: 100,
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.coupon.upsert({
    where: { code: "RENEW88" },
    update: {
      groupId: IDS.group,
      type: "RENEWAL",
      name: "续期限时立减8元",
      amount: 8,
      totalQuantity: 60,
      usedQuantity: 11,
      visitCount: 27,
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: 'cpn_renew_001',
      groupId: IDS.group,
      type: "RENEWAL",
      name: "续期限时立减8元",
      code: "RENEW88",
      amount: 8,
      totalQuantity: 60,
      usedQuantity: 11,
      visitCount: 27,
      status: "ACTIVE",
      validFrom: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.coupon.upsert({
    where: { code: "RENEW95" },
    update: {
      groupId: IDS.group,
      type: "RENEWAL",
      name: "续期 95 折券",
      amount: 5,
      totalQuantity: 120,
      usedQuantity: 0,
      visitCount: 6,
      status: "DRAFT",
      validFrom: new Date(Date.now() + 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    },
    create: {
      id: 'cpn_renew_002',
      groupId: IDS.group,
      type: "RENEWAL",
      name: "续期 95 折券",
      code: "RENEW95",
      amount: 5,
      totalQuantity: 120,
      usedQuantity: 0,
      visitCount: 6,
      status: "DRAFT",
      validFrom: new Date(Date.now() + 24 * 60 * 60 * 1000),
      validTo: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.groupMember.upsert({
    where: {
      groupId_userId: {
        groupId: IDS.group,
        userId: IDS.ownerUser,
      },
    },
    update: {
      memberNo: 1,
      status: "ACTIVE",
      joinSource: "MANUAL",
      isPaid: true,
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(),
    },
    create: {
      id: IDS.ownerMember,
      groupId: IDS.group,
      userId: IDS.ownerUser,
      memberNo: 1,
      status: "ACTIVE",
      joinSource: "MANUAL",
      isPaid: true,
      joinedAt: new Date(),
      firstJoinedAt: new Date(),
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(),
    },
  });

  await prisma.groupMember.upsert({
    where: {
      groupId_userId: {
        groupId: IDS.group,
        userId: IDS.buyerUser,
      },
    },
    update: {
      memberNo: 7,
      status: "ACTIVE",
      joinSource: "COUPON",
      isPaid: true,
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      renewTimes: 1,
      phone: "13800000001",
      wechatNo: "zhangsan_member",
    },
    create: {
      id: IDS.buyerMember,
      groupId: IDS.group,
      userId: IDS.buyerUser,
      memberNo: 7,
      status: "ACTIVE",
      joinSource: "COUPON",
      isPaid: true,
      joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      firstJoinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      lastActiveAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      renewTimes: 1,
      phone: "13800000001",
      wechatNo: "zhangsan_member",
    },
  });

  for (const groupScenario of EXTRA_GROUP_SCENARIOS) {
    await prisma.group.upsert({
      where: { id: groupScenario.id },
      update: {
        name: groupScenario.name,
        slug: groupScenario.slug,
        externalGroupId: groupScenario.externalGroupId,
        ownerUserId: IDS.ownerUser,
        intro: groupScenario.intro,
        description: groupScenario.description,
        joinType: "PAID",
        billingPeriod: "YEAR",
        priceAmount: groupScenario.priceAmount,
        originalPriceAmount: groupScenario.originalPriceAmount,
        status: "ACTIVE",
        memberCount: groupScenario.memberCount,
        paidMemberCount: groupScenario.paidMemberCount,
        contentCount: groupScenario.contentCount,
        publishedAt: new Date(Date.now() - groupScenario.publishedDaysAgo * 24 * 60 * 60 * 1000),
      },
      create: {
        id: groupScenario.id,
        name: groupScenario.name,
        slug: groupScenario.slug,
        externalGroupId: groupScenario.externalGroupId,
        ownerUserId: IDS.ownerUser,
        intro: groupScenario.intro,
        description: groupScenario.description,
        joinType: "PAID",
        billingPeriod: "YEAR",
        priceAmount: groupScenario.priceAmount,
        originalPriceAmount: groupScenario.originalPriceAmount,
        status: "ACTIVE",
        memberCount: groupScenario.memberCount,
        paidMemberCount: groupScenario.paidMemberCount,
        contentCount: groupScenario.contentCount,
        publishedAt: new Date(Date.now() - groupScenario.publishedDaysAgo * 24 * 60 * 60 * 1000),
      },
    });

    await prisma.groupPermissionPolicy.upsert({
      where: { groupId: groupScenario.id },
      update: {
        allowJoin: true,
        needExamine: Boolean(groupScenario.needExamine),
        allowPreview: true,
        allowSearch: groupScenario.allowSearch !== false,
        allowVirtualPayJoin: Boolean(groupScenario.allowVirtualPayJoin),
        allowVirtualPayRenewal: Boolean(groupScenario.allowVirtualPayRenewal),
        partnerCanViewWeeklyReport: true,
        adminCanViewWeeklyReport: true,
      },
      create: {
        id: groupScenario.policyId,
        groupId: groupScenario.id,
        allowJoin: true,
        needExamine: Boolean(groupScenario.needExamine),
        allowPreview: true,
        allowSearch: groupScenario.allowSearch !== false,
        allowVirtualPayJoin: Boolean(groupScenario.allowVirtualPayJoin),
        allowVirtualPayRenewal: Boolean(groupScenario.allowVirtualPayRenewal),
        partnerCanViewWeeklyReport: true,
        adminCanViewWeeklyReport: true,
      },
    });

    await upsertOwnerMembership(groupScenario.id, `mbr_owner_${groupScenario.id}`);
  }

  for (const staffScenario of EXTRA_STAFF_SCENARIOS) {
    await upsertUserProfile(
      staffScenario.userId,
      staffScenario.mobile,
      staffScenario.nickname,
      staffScenario.bio,
      staffScenario.wechatNo
    );

    await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: staffScenario.groupId,
          userId: staffScenario.userId,
        },
      },
      update: {
        memberNo: staffScenario.memberNo,
        status: "ACTIVE",
        joinSource: "MANUAL",
        isPaid: true,
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        renewTimes: 1,
        phone: staffScenario.mobile,
        wechatNo: staffScenario.wechatNo,
      },
      create: {
        id: staffScenario.memberId,
        groupId: staffScenario.groupId,
        userId: staffScenario.userId,
        memberNo: staffScenario.memberNo,
        status: "ACTIVE",
        joinSource: "MANUAL",
        isPaid: true,
        joinedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        firstJoinedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        renewTimes: 1,
        phone: staffScenario.mobile,
        wechatNo: staffScenario.wechatNo,
      },
    });

    await prisma.groupStaff.upsert({
      where: {
        groupId_userId: {
          groupId: staffScenario.groupId,
          userId: staffScenario.userId,
        },
      },
      update: {
        role: staffScenario.role,
        isActive: true,
      },
      create: {
        groupId: staffScenario.groupId,
        userId: staffScenario.userId,
        role: staffScenario.role,
        isActive: true,
      },
    });
  }

  for (const memberScenario of EXTRA_GROUP_MEMBER_SCENARIOS) {
    await upsertUserProfile(
      memberScenario.userId,
      memberScenario.mobile,
      memberScenario.nickname,
      memberScenario.bio,
      memberScenario.wechatNo
    );

    await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: memberScenario.groupId,
          userId: memberScenario.userId,
        },
      },
      update: {
        memberNo: memberScenario.memberNo,
        status: memberScenario.status,
        joinSource: "DIRECT",
        isPaid: memberScenario.isPaid,
        expireAt: new Date(Date.now() + memberScenario.expireOffsetDays * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
        renewTimes: memberScenario.renewTimes,
        phone: memberScenario.mobile,
        wechatNo: memberScenario.wechatNo,
      },
      create: {
        id: memberScenario.memberId,
        groupId: memberScenario.groupId,
        userId: memberScenario.userId,
        memberNo: memberScenario.memberNo,
        status: memberScenario.status,
        joinSource: "DIRECT",
        isPaid: memberScenario.isPaid,
        joinedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        firstJoinedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        expireAt: new Date(Date.now() + memberScenario.expireOffsetDays * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(Date.now() - 18 * 60 * 60 * 1000),
        renewTimes: memberScenario.renewTimes,
        phone: memberScenario.mobile,
        wechatNo: memberScenario.wechatNo,
      },
    });
  }

  for (const scenario of REVIEW_APPLICATION_SCENARIOS) {
    await upsertUserProfile(
      scenario.userId,
      scenario.mobile,
      scenario.nickname,
      scenario.bio,
      scenario.wechatNo
    );

    const paidAt = new Date(Date.now() - scenario.paidDaysAgo * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000);
    const reviewSubmittedAt =
      typeof scenario.reviewSubmittedHoursAfterPaid === "number"
        ? new Date(paidAt.getTime() + scenario.reviewSubmittedHoursAfterPaid * 60 * 60 * 1000)
        : paidAt;
    const reviewedAt =
      scenario.reviewStatus === "REJECTED"
        ? typeof scenario.reviewedHoursAfterPaid === "number"
          ? new Date(paidAt.getTime() + scenario.reviewedHoursAfterPaid * 60 * 60 * 1000)
          : new Date(paidAt.getTime() + 6 * 60 * 60 * 1000)
        : null;
    const lastReappliedAt =
      typeof scenario.lastReappliedHoursAfterPaid === "number"
        ? new Date(paidAt.getTime() + scenario.lastReappliedHoursAfterPaid * 60 * 60 * 1000)
        : null;

    await prisma.order.upsert({
      where: { orderNo: scenario.orderNo },
      update: {
        groupId: scenario.groupId,
        userId: scenario.userId,
        type: "GROUP_JOIN",
        status: "PAID",
        paymentStatus: "PAID",
        amount: scenario.amount,
        netAmount: scenario.amount,
        originalAmount: scenario.amount,
        discountAmount: 0,
        paidAt,
        expireAt: paidAt,
      },
      create: {
        id: scenario.orderId,
        orderNo: scenario.orderNo,
        groupId: scenario.groupId,
        userId: scenario.userId,
        type: "GROUP_JOIN",
        status: "PAID",
        paymentStatus: "PAID",
        amount: scenario.amount,
        netAmount: scenario.amount,
        originalAmount: scenario.amount,
        discountAmount: 0,
        paidAt,
        expireAt: paidAt,
      },
    });

    const savedOrder = await prisma.order.findUnique({ where: { orderNo: scenario.orderNo } });
    if (!savedOrder) continue;

    await prisma.paymentRecord.upsert({
      where: { transactionNo: `TX_${scenario.orderNo}` },
      update: {
        orderId: savedOrder.id,
        channel: "WECHAT",
        status: "PAID",
        amount: scenario.amount,
        paidAt,
        rawPayload: {
          channel: "WECHAT",
          stage: "paid",
          transactionNo: `TX_${scenario.orderNo}`,
          reviewRequired: true,
          reviewStatus: scenario.reviewStatus,
          reviewReason: scenario.reviewReason,
          reviewSubmittedAt: reviewSubmittedAt.toISOString(),
          reviewedAt: reviewedAt ? reviewedAt.toISOString() : null,
          reviewerUserId: reviewedAt ? IDS.ownerUser : null,
          reapplyCount: Number(scenario.reapplyCount || 0),
          lastReappliedAt: lastReappliedAt ? lastReappliedAt.toISOString() : null,
        },
      },
      create: {
        orderId: savedOrder.id,
        channel: "WECHAT",
        status: "PAID",
        transactionNo: `TX_${scenario.orderNo}`,
        amount: scenario.amount,
        paidAt,
        rawPayload: {
          channel: "WECHAT",
          stage: "paid",
          transactionNo: `TX_${scenario.orderNo}`,
          reviewRequired: true,
          reviewStatus: scenario.reviewStatus,
          reviewReason: scenario.reviewReason,
          reviewSubmittedAt: reviewSubmittedAt.toISOString(),
          reviewedAt: reviewedAt ? reviewedAt.toISOString() : null,
          reviewerUserId: reviewedAt ? IDS.ownerUser : null,
          reapplyCount: Number(scenario.reapplyCount || 0),
          lastReappliedAt: lastReappliedAt ? lastReappliedAt.toISOString() : null,
        },
      },
    });
  }

  for (const scenario of ADMIN_MEMBER_SCENARIOS) {
    await prisma.user.upsert({
      where: { id: scenario.userId },
      update: {
        mobile: scenario.mobile,
        status: scenario.status === "BANNED" ? "BANNED" : "ACTIVE",
      },
      create: {
        id: scenario.userId,
        mobile: scenario.mobile,
        status: scenario.status === "BANNED" ? "BANNED" : "ACTIVE",
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: scenario.userId },
      update: {
        nickname: scenario.nickname,
        avatarUrl: `https://img.example.com/${scenario.userId}.jpg`,
        bio: scenario.bio,
        wechatNo: scenario.wechatNo,
      },
      create: {
        userId: scenario.userId,
        nickname: scenario.nickname,
        avatarUrl: `https://img.example.com/${scenario.userId}.jpg`,
        bio: scenario.bio,
        wechatNo: scenario.wechatNo,
      },
    });

    await prisma.groupMember.upsert({
      where: {
        groupId_userId: {
          groupId: IDS.group,
          userId: scenario.userId,
        },
      },
      update: {
        memberNo: scenario.memberNo,
        status: scenario.status,
        joinSource: scenario.joinSource,
        isPaid: scenario.isPaid,
        expireAt: new Date(Date.now() + scenario.expireOffsetDays * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(Date.now() - scenario.lastActiveOffsetHours * 60 * 60 * 1000),
        renewTimes: scenario.renewTimes,
        phone: scenario.phone,
        wechatNo: scenario.wechatNo,
      },
      create: {
        id: scenario.memberId,
        groupId: IDS.group,
        userId: scenario.userId,
        memberNo: scenario.memberNo,
        status: scenario.status,
        joinSource: scenario.joinSource,
        isPaid: scenario.isPaid,
        joinedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        firstJoinedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        expireAt: new Date(Date.now() + scenario.expireOffsetDays * 24 * 60 * 60 * 1000),
        lastActiveAt: new Date(Date.now() - scenario.lastActiveOffsetHours * 60 * 60 * 1000),
        renewTimes: scenario.renewTimes,
        phone: scenario.phone,
        wechatNo: scenario.wechatNo,
      },
    });
  }

  await prisma.post.upsert({
    where: { id: "pst_welcome_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "NOTICE",
      status: "PUBLISHED",
      title: "新来的朋友，大家好，欢迎来到我的知识星球。",
      summary: "新来的朋友，大家好，欢迎来到我的知识星球。这里会持续更新 AI 学习与实践内容。",
      contentText: "新来的朋友，大家好，欢迎来到我的知识星球。这里会持续更新 AI 学习与实践内容，方便大家按主题回看。",
      isPinned: true,
      isEssence: true,
      metadata: {},
      publishedAt: new Date(),
    },
    create: {
      id: "pst_welcome_001",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "NOTICE",
      status: "PUBLISHED",
      title: "新来的朋友，大家好，欢迎来到我的知识星球。",
      summary: "新来的朋友，大家好，欢迎来到我的知识星球。这里会持续更新 AI 学习与实践内容。",
      contentText: "新来的朋友，大家好，欢迎来到我的知识星球。这里会持续更新 AI 学习与实践内容，方便大家按主题回看。",
      isPinned: true,
      isEssence: true,
      metadata: {},
      publishedAt: new Date(),
    },
  });

  await prisma.post.upsert({
    where: { id: "pst_featured_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "TOPIC",
      status: "PUBLISHED",
      title: "大多数人忽略的管理真相",
      summary: "拆解组织磨合、沟通和管理中的几个关键误区。",
      contentText: "拆解组织磨合、沟通和管理中的几个关键误区，帮助新成员更快建立判断框架。",
      isPinned: false,
      isEssence: true,
      metadata: {
        reportStatus: "PENDING",
        reportCount: 2,
        reportPendingCount: 2,
        reportResolvedCount: 0,
        reportIgnoredCount: 0,
        lastReportedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        lastReportedReason: "疑似营销导流，建议管理员复核一下。",
        reportResolutionNote: "",
        reportLogs: [
          {
            id: "rpt_seed_featured_001",
            reporterUserId: IDS.buyerUser,
            reporterName: "体验会员",
            reason: "内容里有明显导流嫌疑，希望管理员核查。",
            status: "PENDING",
            createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            resolvedAt: "",
            resolutionNote: "",
          },
          {
            id: "rpt_seed_featured_002",
            reporterUserId: "usr_admin_active_001",
            reporterName: "活跃成员李雷",
            reason: "疑似营销导流，建议管理员复核一下。",
            status: "PENDING",
            createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            resolvedAt: "",
            resolutionNote: "",
          },
        ],
      },
      publishedAt: new Date(Date.now() - 3600 * 1000),
    },
    create: {
      id: "pst_featured_001",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "TOPIC",
      status: "PUBLISHED",
      title: "大多数人忽略的管理真相",
      summary: "拆解组织磨合、沟通和管理中的几个关键误区。",
      contentText: "拆解组织磨合、沟通和管理中的几个关键误区，帮助新成员更快建立判断框架。",
      isPinned: false,
      isEssence: true,
      metadata: {
        reportStatus: "PENDING",
        reportCount: 2,
        reportPendingCount: 2,
        reportResolvedCount: 0,
        reportIgnoredCount: 0,
        lastReportedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        lastReportedReason: "疑似营销导流，建议管理员复核一下。",
        reportResolutionNote: "",
        reportLogs: [
          {
            id: "rpt_seed_featured_001",
            reporterUserId: IDS.buyerUser,
            reporterName: "体验会员",
            reason: "内容里有明显导流嫌疑，希望管理员核查。",
            status: "PENDING",
            createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
            resolvedAt: "",
            resolutionNote: "",
          },
          {
            id: "rpt_seed_featured_002",
            reporterUserId: "usr_admin_active_001",
            reporterName: "活跃成员李雷",
            reason: "疑似营销导流，建议管理员复核一下。",
            status: "PENDING",
            createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
            resolvedAt: "",
            resolutionNote: "",
          },
        ],
      },
      publishedAt: new Date(Date.now() - 3600 * 1000),
    },
  });

  await prisma.post.upsert({
    where: { id: "pst_file_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "分享一个关于AI智能体的综述",
      summary: "附 PDF 资料，适合先建立完整认知框架。",
      contentText: "附 PDF 资料，适合先建立完整认知框架。",
      attachments: ["https://example.com/files/ai-agent-review.pdf"],
      metadata: {
        hasFile: true,
        fileName: "ai-agent-review.pdf",
      },
      publishedAt: new Date(Date.now() - 2 * 3600 * 1000),
    },
    create: {
      id: "pst_file_001",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "分享一个关于AI智能体的综述",
      summary: "附 PDF 资料，适合先建立完整认知框架。",
      contentText: "附 PDF 资料，适合先建立完整认知框架。",
      attachments: ["https://example.com/files/ai-agent-review.pdf"],
      metadata: {
        hasFile: true,
        fileName: "ai-agent-review.pdf",
      },
      publishedAt: new Date(Date.now() - 2 * 3600 * 1000),
    },
  });

  await prisma.post.upsert({
    where: { id: "pst_answer_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.buyerUser,
      type: "TOPIC",
      status: "PUBLISHED",
      title: "如果想做一个最小 AI 工具，第一步应该怎么验证？",
      summary: "等我回答示例帖子。",
      contentText: "如果想做一个最小 AI 工具，第一步应该怎么验证？",
      metadata: {
        answerStatus: "PENDING",
        reportStatus: "RESOLVED",
        reportCount: 1,
        reportPendingCount: 0,
        reportResolvedCount: 1,
        reportIgnoredCount: 0,
        lastReportedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        lastReportedReason: "问题标题带有明显广告导向。",
        reportResolutionNote: "已核实问题内容正常，仅提醒作者调整标题表达。",
        reportLogs: [
          {
            id: "rpt_seed_answer_001",
            reporterUserId: IDS.ownerUser,
            reporterName: "星主本人",
            reason: "问题标题带有明显广告导向。",
            status: "RESOLVED",
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            resolvedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            resolutionNote: "已核实问题内容正常，仅提醒作者调整标题表达。",
          },
        ],
      },
      publishedAt: new Date(Date.now() - 3 * 3600 * 1000),
    },
    create: {
      id: "pst_answer_001",
      groupId: IDS.group,
      authorUserId: IDS.buyerUser,
      type: "TOPIC",
      status: "PUBLISHED",
      title: "如果想做一个最小 AI 工具，第一步应该怎么验证？",
      summary: "等我回答示例帖子。",
      contentText: "如果想做一个最小 AI 工具，第一步应该怎么验证？",
      metadata: {
        answerStatus: "PENDING",
        reportStatus: "RESOLVED",
        reportCount: 1,
        reportPendingCount: 0,
        reportResolvedCount: 1,
        reportIgnoredCount: 0,
        lastReportedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        lastReportedReason: "问题标题带有明显广告导向。",
        reportResolutionNote: "已核实问题内容正常，仅提醒作者调整标题表达。",
        reportLogs: [
          {
            id: "rpt_seed_answer_001",
            reporterUserId: IDS.ownerUser,
            reporterName: "星主本人",
            reason: "问题标题带有明显广告导向。",
            status: "RESOLVED",
            createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            resolvedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
            resolutionNote: "已核实问题内容正常，仅提醒作者调整标题表达。",
          },
        ],
      },
      publishedAt: new Date(Date.now() - 3 * 3600 * 1000),
    },
  });

  await prisma.comment.upsert({
    where: { id: "cmt_demo_001" },
    update: {
      postId: "pst_welcome_001",
      userId: IDS.buyerUser,
      contentText: "欢迎帖写得很清楚，已加入学习。",
      status: "PUBLISHED",
    },
    create: {
      id: "cmt_demo_001",
      postId: "pst_welcome_001",
      userId: IDS.buyerUser,
      contentText: "欢迎帖写得很清楚，已加入学习。",
      status: "PUBLISHED",
    },
  });

  await prisma.comment.upsert({
    where: { id: "cmt_demo_002" },
    update: {
      postId: "pst_featured_001",
      userId: IDS.ownerUser,
      contentText: "后面我会继续补这个主题的案例。",
      status: "PUBLISHED",
    },
    create: {
      id: "cmt_demo_002",
      postId: "pst_featured_001",
      userId: IDS.ownerUser,
      contentText: "后面我会继续补这个主题的案例。",
      status: "PUBLISHED",
    },
  });

  const columns = [
    { id: "col_mcp_001", title: "100个MCP案例", sortOrder: 0 },
    { id: "col_business_001", title: "商业案例拆解", sortOrder: 1 },
    { id: "col_ai_programming_001", title: "AI编程", sortOrder: 2 },
    { id: "col_startups_001", title: "100个创业项目", sortOrder: 3 },
    { id: "col_ai_tools_001", title: "AI工具测评", sortOrder: 4 },
    { id: "col_yian_tools_001", title: "易安AI工具库", sortOrder: 5 },
    { id: "col_deepseek_001", title: "DeepSeek", sortOrder: 6 },
    { id: "col_insight_001", title: "商业洞察", sortOrder: 7 },
    { id: "col_2025_001", title: "2025勤商", sortOrder: 8 },
    { id: "col_model_001", title: "易安学思维模型", sortOrder: 9 },
  ];

  for (const col of columns) {
    await prisma.column.upsert({
      where: { id: col.id },
      update: {
        groupId: IDS.group,
        title: col.title,
        sortOrder: col.sortOrder,
      },
      create: {
        id: col.id,
        groupId: IDS.group,
        title: col.title,
        sortOrder: col.sortOrder,
      },
    });
  }

  await prisma.post.upsert({
    where: { id: "pst_column_mcp_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "手把手教你用Firecrawl MCP做知识星球分析",
      summary: "手把手教你用Firecrawl MCP做知识星球分析",
      contentText: "通过Firecrawl MCP，我们可以快速获取知识星球的内容数据，进行深度分析。本文将详细介绍具体操作步骤。",
      metadata: {
        columnId: "col_mcp_001",
      },
      publishedAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
    create: {
      id: "pst_column_mcp_001",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "手把手教你用Firecrawl MCP做知识星球分析",
      summary: "手把手教你用Firecrawl MCP做知识星球分析",
      contentText: "通过Firecrawl MCP，我们可以快速获取知识星球的内容数据，进行深度分析。本文将详细介绍具体操作步骤。",
      metadata: {
        columnId: "col_mcp_001",
      },
      publishedAt: new Date(Date.now() - 4 * 3600 * 1000),
    },
  });

  await prisma.post.upsert({
    where: { id: "pst_column_mcp_002" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "手把手教你用高德地图API和Claude的MCP功能打造智能旅游助手",
      summary: "手把手教你用高德地图API和Claude的MCP功能打造智能旅游助手",
      contentText: "结合高德地图API与Claude的MCP能力，构建一个能自动规划行程、查询周边信息的智能旅游助手。",
      metadata: {
        columnId: "col_mcp_001",
      },
      publishedAt: new Date(Date.now() - 5 * 3600 * 1000),
    },
    create: {
      id: "pst_column_mcp_002",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "手把手教你用高德地图API和Claude的MCP功能打造智能旅游助手",
      summary: "手把手教你用高德地图API和Claude的MCP功能打造智能旅游助手",
      contentText: "结合高德地图API与Claude的MCP能力，构建一个能自动规划行程、查询周边信息的智能旅游助手。",
      metadata: {
        columnId: "col_mcp_001",
      },
      publishedAt: new Date(Date.now() - 5 * 3600 * 1000),
    },
  });

  await prisma.post.upsert({
    where: { id: "pst_column_business_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "拆解一条爆款内容从选题、转化到复购的完整路径",
      summary: "拆解一条爆款内容从选题、转化到复购的完整路径",
      contentText: "从选题定位开始，经过内容生产、分发、转化，最终实现复购，完整拆解一个爆款内容的生命周期。",
      metadata: {
        columnId: "col_business_001",
        reportStatus: "IGNORED",
        reportCount: 1,
        reportPendingCount: 0,
        reportResolvedCount: 0,
        reportIgnoredCount: 1,
        lastReportedAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
        lastReportedReason: "内容观点太激进，建议下架。",
        reportResolutionNote: "核查后判断属于正常观点表达，保留原文。",
        reportLogs: [
          {
            id: "rpt_seed_business_001",
            reporterUserId: IDS.buyerUser,
            reporterName: "体验会员",
            reason: "内容观点太激进，建议下架。",
            status: "IGNORED",
            createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
            resolvedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
            resolutionNote: "核查后判断属于正常观点表达，保留原文。",
          },
        ],
      },
      publishedAt: new Date(Date.now() - 6 * 3600 * 1000),
    },
    create: {
      id: "pst_column_business_001",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "拆解一条爆款内容从选题、转化到复购的完整路径",
      summary: "拆解一条爆款内容从选题、转化到复购的完整路径",
      contentText: "从选题定位开始，经过内容生产、分发、转化，最终实现复购，完整拆解一个爆款内容的生命周期。",
      metadata: {
        columnId: "col_business_001",
        reportStatus: "IGNORED",
        reportCount: 1,
        reportPendingCount: 0,
        reportResolvedCount: 0,
        reportIgnoredCount: 1,
        lastReportedAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
        lastReportedReason: "内容观点太激进，建议下架。",
        reportResolutionNote: "核查后判断属于正常观点表达，保留原文。",
        reportLogs: [
          {
            id: "rpt_seed_business_001",
            reporterUserId: IDS.buyerUser,
            reporterName: "体验会员",
            reason: "内容观点太激进，建议下架。",
            status: "IGNORED",
            createdAt: new Date(Date.now() - 11 * 60 * 60 * 1000).toISOString(),
            resolvedAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
            resolutionNote: "核查后判断属于正常观点表达，保留原文。",
          },
        ],
      },
      publishedAt: new Date(Date.now() - 6 * 3600 * 1000),
    },
  });

  await prisma.post.upsert({
    where: { id: "pst_column_ai_programming_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "从0到1搭建可复用的AI工作流",
      summary: "从0到1搭建可复用的AI工作流",
      contentText: "搭建一套标准化的AI工作流，让每次AI协作都有章可循，减少重复劳动。",
      metadata: {
        columnId: "col_ai_programming_001",
      },
      publishedAt: new Date(Date.now() - 7 * 3600 * 1000),
    },
    create: {
      id: "pst_column_ai_programming_001",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "从0到1搭建可复用的AI工作流",
      summary: "从0到1搭建可复用的AI工作流",
      contentText: "搭建一套标准化的AI工作流，让每次AI协作都有章可循，减少重复劳动。",
      metadata: {
        columnId: "col_ai_programming_001",
      },
      publishedAt: new Date(Date.now() - 7 * 3600 * 1000),
    },
  });

  await prisma.post.upsert({
    where: { id: "pst_column_deepseek_001" },
    update: {
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "DeepSeek R1 深度评测：适合哪些场景？",
      summary: "DeepSeek R1 深度评测：适合哪些场景？",
      contentText: "从编程、写作、推理等多个维度评测 DeepSeek R1，帮你判断是否适合你的使用场景。",
      metadata: {
        columnId: "col_deepseek_001",
      },
      publishedAt: new Date(Date.now() - 8 * 3600 * 1000),
    },
    create: {
      id: "pst_column_deepseek_001",
      groupId: IDS.group,
      authorUserId: IDS.ownerUser,
      type: "ARTICLE",
      status: "PUBLISHED",
      title: "DeepSeek R1 深度评测：适合哪些场景？",
      summary: "DeepSeek R1 深度评测：适合哪些场景？",
      contentText: "从编程、写作、推理等多个维度评测 DeepSeek R1，帮你判断是否适合你的使用场景。",
      metadata: {
        columnId: "col_deepseek_001",
      },
      publishedAt: new Date(Date.now() - 8 * 3600 * 1000),
    },
  });

  for (const item of EXTRA_COLUMN_POSTS) {
    await prisma.post.upsert({
      where: { id: item.id },
      update: {
        groupId: IDS.group,
        authorUserId: IDS.ownerUser,
        type: "ARTICLE",
        status: "PUBLISHED",
        title: item.title,
        summary: item.summary,
        contentText: item.contentText,
        metadata: {
          columnId: item.columnId,
        },
        publishedAt: new Date(Date.now() - item.publishedAtOffsetHours * 3600 * 1000),
      },
      create: {
        id: item.id,
        groupId: IDS.group,
        authorUserId: IDS.ownerUser,
        type: "ARTICLE",
        status: "PUBLISHED",
        title: item.title,
        summary: item.summary,
        contentText: item.contentText,
        metadata: {
          columnId: item.columnId,
        },
        publishedAt: new Date(Date.now() - item.publishedAtOffsetHours * 3600 * 1000),
      },
    });
  }

  for (const scenario of ADMIN_CONTENT_SCENARIOS) {
    const publishedAt = scenario.publishedAtOffsetHours === null
      ? null
      : new Date(Date.now() - scenario.publishedAtOffsetHours * 3600 * 1000);

    await prisma.post.upsert({
      where: { id: scenario.id },
      update: {
        groupId: IDS.group,
        authorUserId: scenario.authorUserId,
        type: scenario.type,
        status: scenario.status,
        title: scenario.title,
        summary: scenario.summary,
        contentText: scenario.contentText,
        readingCount: scenario.readingCount,
        likeCount: scenario.likeCount,
        commentCount: scenario.commentCount,
        isPinned: Boolean(scenario.isPinned),
        isEssence: Boolean(scenario.isEssence),
        metadata: scenario.metadata || {},
        publishedAt,
      },
      create: {
        id: scenario.id,
        groupId: IDS.group,
        authorUserId: scenario.authorUserId,
        type: scenario.type,
        status: scenario.status,
        title: scenario.title,
        summary: scenario.summary,
        contentText: scenario.contentText,
        readingCount: scenario.readingCount,
        likeCount: scenario.likeCount,
        commentCount: scenario.commentCount,
        isPinned: Boolean(scenario.isPinned),
        isEssence: Boolean(scenario.isEssence),
        metadata: scenario.metadata || {},
        publishedAt,
      },
    });
  }

  for (const scenario of EXTRA_GROUP_POST_SCENARIOS) {
    const publishedAt = scenario.publishedAtOffsetHours === null
      ? null
      : new Date(Date.now() - scenario.publishedAtOffsetHours * 3600 * 1000);

    await prisma.post.upsert({
      where: { id: scenario.id },
      update: {
        groupId: scenario.groupId,
        authorUserId: scenario.authorUserId,
        type: scenario.type,
        status: scenario.status,
        title: scenario.title,
        summary: scenario.summary,
        contentText: scenario.contentText,
        readingCount: scenario.readingCount,
        likeCount: scenario.likeCount,
        commentCount: scenario.commentCount,
        isPinned: Boolean(scenario.isPinned),
        isEssence: Boolean(scenario.isEssence),
        metadata: scenario.metadata || {},
        publishedAt,
      },
      create: {
        id: scenario.id,
        groupId: scenario.groupId,
        authorUserId: scenario.authorUserId,
        type: scenario.type,
        status: scenario.status,
        title: scenario.title,
        summary: scenario.summary,
        contentText: scenario.contentText,
        readingCount: scenario.readingCount,
        likeCount: scenario.likeCount,
        commentCount: scenario.commentCount,
        isPinned: Boolean(scenario.isPinned),
        isEssence: Boolean(scenario.isEssence),
        metadata: scenario.metadata || {},
        publishedAt,
      },
    });
  }

  for (const scenario of AUTHOR_WORKBENCH_POST_SCENARIOS) {
    const publishedAt = scenario.publishedAtOffsetHours === null
      ? null
      : new Date(Date.now() - scenario.publishedAtOffsetHours * 3600 * 1000);

    await prisma.post.upsert({
      where: { id: scenario.id },
      update: {
        groupId: IDS.group,
        authorUserId: scenario.authorUserId,
        type: scenario.type,
        status: scenario.status,
        title: scenario.title,
        summary: scenario.summary,
        contentText: scenario.contentText,
        readingCount: scenario.readingCount,
        likeCount: scenario.likeCount,
        commentCount: scenario.commentCount,
        isPinned: Boolean(scenario.isPinned),
        isEssence: Boolean(scenario.isEssence),
        metadata: scenario.metadata || {},
        publishedAt,
      },
      create: {
        id: scenario.id,
        groupId: IDS.group,
        authorUserId: scenario.authorUserId,
        type: scenario.type,
        status: scenario.status,
        title: scenario.title,
        summary: scenario.summary,
        contentText: scenario.contentText,
        readingCount: scenario.readingCount,
        likeCount: scenario.likeCount,
        commentCount: scenario.commentCount,
        isPinned: Boolean(scenario.isPinned),
        isEssence: Boolean(scenario.isEssence),
        metadata: scenario.metadata || {},
        publishedAt,
      },
    });
  }

  await upsertGroupStats(
    IDS.group,
    [
      { daysAgo: 6, totalMemberCount: 4, paidMemberCount: 3, freeMemberCount: 1, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.5000, appDownloadedCount: 2, appDownloadRate: 0.5000 },
      { daysAgo: 5, totalMemberCount: 4, paidMemberCount: 3, freeMemberCount: 1, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.5000, appDownloadedCount: 2, appDownloadRate: 0.5000 },
      { daysAgo: 4, totalMemberCount: 5, paidMemberCount: 4, freeMemberCount: 1, quittedCount: 0, activeMemberCount7d: 3, weeklyActiveRate: 0.6000, appDownloadedCount: 3, appDownloadRate: 0.6000 },
      { daysAgo: 3, totalMemberCount: 5, paidMemberCount: 4, freeMemberCount: 1, quittedCount: 0, activeMemberCount7d: 3, weeklyActiveRate: 0.6000, appDownloadedCount: 3, appDownloadRate: 0.6000 },
      { daysAgo: 2, totalMemberCount: 7, paidMemberCount: 5, freeMemberCount: 2, quittedCount: 0, activeMemberCount7d: 5, weeklyActiveRate: 0.7143, appDownloadedCount: 5, appDownloadRate: 0.7143 },
      { daysAgo: 1, totalMemberCount: 7, paidMemberCount: 5, freeMemberCount: 2, quittedCount: 0, activeMemberCount7d: 5, weeklyActiveRate: 0.7143, appDownloadedCount: 5, appDownloadRate: 0.7143 },
      { daysAgo: 0, totalMemberCount: 7, paidMemberCount: 5, freeMemberCount: 2, quittedCount: 0, activeMemberCount7d: 5, weeklyActiveRate: 0.7143, appDownloadedCount: 5, appDownloadRate: 0.7143 },
    ],
    [
      { daysAgo: 6, topicCount: 1, fileCount: 0, imageCount: 0, commentCount: 1, likeCount: 2 },
      { daysAgo: 5, topicCount: 2, fileCount: 1, imageCount: 1, commentCount: 2, likeCount: 4 },
      { daysAgo: 4, topicCount: 2, fileCount: 1, imageCount: 1, commentCount: 3, likeCount: 6 },
      { daysAgo: 3, topicCount: 3, fileCount: 1, imageCount: 2, commentCount: 4, likeCount: 8 },
      { daysAgo: 2, topicCount: 2, fileCount: 0, imageCount: 1, commentCount: 2, likeCount: 5 },
      { daysAgo: 1, topicCount: 4, fileCount: 1, imageCount: 3, commentCount: 5, likeCount: 10 },
      { daysAgo: 0, topicCount: 3, fileCount: 1, imageCount: 2, commentCount: 4, likeCount: 9 },
    ]
  );

  const incomeRows = [
    { daysAgo: 6, totalNetAmount: 88, joinNetAmount: 68, renewalNetAmount: 12, rewardNetAmount: 6, questionNetAmount: 2 },
    { daysAgo: 5, totalNetAmount: 106, joinNetAmount: 80, renewalNetAmount: 18, rewardNetAmount: 6, questionNetAmount: 2 },
    { daysAgo: 4, totalNetAmount: 132, joinNetAmount: 96, renewalNetAmount: 24, rewardNetAmount: 8, questionNetAmount: 4 },
    { daysAgo: 3, totalNetAmount: 118, joinNetAmount: 84, renewalNetAmount: 20, rewardNetAmount: 10, questionNetAmount: 4 },
    { daysAgo: 2, totalNetAmount: 156, joinNetAmount: 120, renewalNetAmount: 22, rewardNetAmount: 10, questionNetAmount: 4 },
    { daysAgo: 1, totalNetAmount: 148, joinNetAmount: 108, renewalNetAmount: 26, rewardNetAmount: 8, questionNetAmount: 6 },
    { daysAgo: 0, totalNetAmount: 168, joinNetAmount: 128, renewalNetAmount: 24, rewardNetAmount: 10, questionNetAmount: 6 },
  ];

  for (const row of incomeRows) {
    const statDate = toDateOnly(row.daysAgo);
    await prisma.groupIncomeDailyStat.upsert({
      where: {
        groupId_statDate: {
          groupId: IDS.group,
          statDate,
        },
      },
      update: {
        totalNetAmount: row.totalNetAmount,
        joinNetAmount: row.joinNetAmount,
        renewalNetAmount: row.renewalNetAmount,
        rewardNetAmount: row.rewardNetAmount,
        questionNetAmount: row.questionNetAmount,
      },
      create: {
        groupId: IDS.group,
        statDate,
        totalNetAmount: row.totalNetAmount,
        joinNetAmount: row.joinNetAmount,
        renewalNetAmount: row.renewalNetAmount,
        rewardNetAmount: row.rewardNetAmount,
        questionNetAmount: row.questionNetAmount,
      },
    });
  }

  const promotionRows = [
    { daysAgo: 6, previewVisitCount: 28, clickJoinCount: 8, paySuccessCount: 2, paidJoinCount: 2, joinIncomeAmount: 68 },
    { daysAgo: 5, previewVisitCount: 36, clickJoinCount: 10, paySuccessCount: 2, paidJoinCount: 2, joinIncomeAmount: 80 },
    { daysAgo: 4, previewVisitCount: 42, clickJoinCount: 12, paySuccessCount: 3, paidJoinCount: 3, joinIncomeAmount: 96 },
    { daysAgo: 3, previewVisitCount: 39, clickJoinCount: 11, paySuccessCount: 2, paidJoinCount: 2, joinIncomeAmount: 84 },
    { daysAgo: 2, previewVisitCount: 48, clickJoinCount: 14, paySuccessCount: 3, paidJoinCount: 3, joinIncomeAmount: 120 },
    { daysAgo: 1, previewVisitCount: 45, clickJoinCount: 13, paySuccessCount: 3, paidJoinCount: 3, joinIncomeAmount: 108 },
    { daysAgo: 0, previewVisitCount: 52, clickJoinCount: 15, paySuccessCount: 4, paidJoinCount: 4, joinIncomeAmount: 128 },
  ];

  for (const row of promotionRows) {
    const statDate = toDateOnly(row.daysAgo);
    await prisma.groupPromotionDailyStat.upsert({
      where: {
        groupId_statDate: {
          groupId: IDS.group,
          statDate,
        },
      },
      update: {
        previewVisitCount: row.previewVisitCount,
        clickJoinCount: row.clickJoinCount,
        paySuccessCount: row.paySuccessCount,
        paidJoinCount: row.paidJoinCount,
        joinIncomeAmount: row.joinIncomeAmount,
      },
      create: {
        groupId: IDS.group,
        statDate,
        previewVisitCount: row.previewVisitCount,
        clickJoinCount: row.clickJoinCount,
        paySuccessCount: row.paySuccessCount,
        paidJoinCount: row.paidJoinCount,
        joinIncomeAmount: row.joinIncomeAmount,
      },
    });
  }

  const renewalRows = [
    { daysAgo: 6, renewalIncomeAmount: 12, renewedCount: 1, renewableCount: 6, renewalPageVisitCount: 5, renewalPaySuccessCount: 1, renewalConversionRate: 0.2000 },
    { daysAgo: 5, renewalIncomeAmount: 18, renewedCount: 1, renewableCount: 6, renewalPageVisitCount: 6, renewalPaySuccessCount: 1, renewalConversionRate: 0.1667 },
    { daysAgo: 4, renewalIncomeAmount: 24, renewedCount: 2, renewableCount: 7, renewalPageVisitCount: 7, renewalPaySuccessCount: 2, renewalConversionRate: 0.2857 },
    { daysAgo: 3, renewalIncomeAmount: 20, renewedCount: 1, renewableCount: 7, renewalPageVisitCount: 6, renewalPaySuccessCount: 1, renewalConversionRate: 0.1667 },
    { daysAgo: 2, renewalIncomeAmount: 22, renewedCount: 1, renewableCount: 7, renewalPageVisitCount: 7, renewalPaySuccessCount: 1, renewalConversionRate: 0.1429 },
    { daysAgo: 1, renewalIncomeAmount: 26, renewedCount: 2, renewableCount: 8, renewalPageVisitCount: 8, renewalPaySuccessCount: 2, renewalConversionRate: 0.2500 },
    { daysAgo: 0, renewalIncomeAmount: 24, renewedCount: 1, renewableCount: 8, renewalPageVisitCount: 8, renewalPaySuccessCount: 1, renewalConversionRate: 0.1250 },
  ];

  for (const row of renewalRows) {
    const statDate = toDateOnly(row.daysAgo);
    await prisma.groupRenewalDailyStat.upsert({
      where: {
        groupId_statDate: {
          groupId: IDS.group,
          statDate,
        },
      },
      update: {
        renewalIncomeAmount: row.renewalIncomeAmount,
        renewedCount: row.renewedCount,
        renewableCount: row.renewableCount,
        renewalPageVisitCount: row.renewalPageVisitCount,
        renewalPaySuccessCount: row.renewalPaySuccessCount,
        renewalConversionRate: row.renewalConversionRate,
      },
      create: {
        groupId: IDS.group,
        statDate,
        renewalIncomeAmount: row.renewalIncomeAmount,
        renewedCount: row.renewedCount,
        renewableCount: row.renewableCount,
        renewalPageVisitCount: row.renewalPageVisitCount,
        renewalPaySuccessCount: row.renewalPaySuccessCount,
        renewalConversionRate: row.renewalConversionRate,
      },
    });
  }

  await prisma.renewalSetting.upsert({
    where: { groupId: IDS.group },
    update: {
      enabled: true,
      limitWindow: true,
      amount: 29,
      originalAmount: 39,
      discountedPercentage: 74,
      expiringEnabled: true,
      advanceAmount: 25,
      advanceDiscountPercentage: 64,
      advanceEnabled: true,
      graceAmount: 35,
      graceDiscountPercentage: 90,
      graceEnabled: true,
      audience: 'renewable_members',
      allowCouponStack: true,
      minRenewCount: 0,
      mode: 'period',
      duration: '1Y',
      beginTime: new Date('2026-04-01T00:00:00.000Z'),
      endTime: new Date('2026-06-30T23:59:59.999Z'),
      guidance: '建议在到期前 7 天和到期后 3 天分别触发不同续期提醒。',
      renewalUrl: 'https://wx.zsxq.com/group/28882128518851',
    },
    create: {
      groupId: IDS.group,
      enabled: true,
      limitWindow: true,
      amount: 29,
      originalAmount: 39,
      discountedPercentage: 74,
      expiringEnabled: true,
      advanceAmount: 25,
      advanceDiscountPercentage: 64,
      advanceEnabled: true,
      graceAmount: 35,
      graceDiscountPercentage: 90,
      graceEnabled: true,
      audience: 'renewable_members',
      allowCouponStack: true,
      minRenewCount: 0,
      mode: 'period',
      duration: '1Y',
      beginTime: new Date('2026-04-01T00:00:00.000Z'),
      endTime: new Date('2026-06-30T23:59:59.999Z'),
      guidance: '建议在到期前 7 天和到期后 3 天分别触发不同续期提醒。',
      renewalUrl: 'https://wx.zsxq.com/group/28882128518851',
    },
  });

  const renewalNoticeRows = [
    {
      id: 'gnt_renew_001',
      title: '续期前 7 天提醒',
      content: '你的星球还有 7 天到期，现在续期可锁定优惠价。',
      buttonText: '立即续期',
      buttonUrl: 'https://wx.zsxq.com/group/28882128518851',
      routeKey: 'renewal-page',
      status: 'SENT',
      scheduledAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      pushedCount: 24,
    },
    {
      id: 'gnt_renew_002',
      title: '续期前 1 天提醒',
      content: '你的星球明天到期，建议今天完成续期避免中断。',
      buttonText: '查看续期方案',
      buttonUrl: 'https://wx.zsxq.com/group/28882128518851',
      routeKey: 'renewal-page',
      status: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      sentAt: null,
      pushedCount: 0,
    },
    {
      id: 'gnt_renew_003',
      title: '过期 3 天召回',
      content: '你的星球已过期 3 天，仍可通过限时续期链接恢复权益。',
      buttonText: '恢复权益',
      buttonUrl: 'https://wx.zsxq.com/group/28882128518851',
      routeKey: 'renewal-recall',
      status: 'DRAFT',
      scheduledAt: null,
      sentAt: null,
      pushedCount: 0,
    },
  ];

  for (const row of renewalNoticeRows) {
    await prisma.groupNotification.upsert({
      where: { id: row.id },
      update: {
        groupId: IDS.group,
        title: row.title,
        content: row.content,
        buttonText: row.buttonText,
        buttonUrl: row.buttonUrl,
        routeKey: row.routeKey,
        status: row.status,
        scheduledAt: row.scheduledAt,
        sentAt: row.sentAt,
        pushedCount: row.pushedCount,
      },
      create: {
        id: row.id,
        groupId: IDS.group,
        title: row.title,
        content: row.content,
        buttonText: row.buttonText,
        buttonUrl: row.buttonUrl,
        routeKey: row.routeKey,
        status: row.status,
        scheduledAt: row.scheduledAt,
        sentAt: row.sentAt,
        pushedCount: row.pushedCount,
      },
    });
  }

  const renewalTemplateRows = [
    { expiredDays: -7, text: '你的星球还有 7 天到期，现在续期可锁定优惠价。', pushedCount: 24 },
    { expiredDays: -1, text: '你的星球明天到期，建议今天完成续期避免中断。', pushedCount: 18 },
    { expiredDays: 3, text: '你的星球已过期 3 天，仍可通过限时续期链接恢复权益。', pushedCount: 9 },
  ];

  for (const row of renewalTemplateRows) {
    await prisma.renewalNotificationTemplate.upsert({
      where: {
        groupId_expiredDays: {
          groupId: IDS.group,
          expiredDays: row.expiredDays,
        },
      },
      update: {
        text: row.text,
        pushedCount: row.pushedCount,
      },
      create: {
        groupId: IDS.group,
        expiredDays: row.expiredDays,
        text: row.text,
        pushedCount: row.pushedCount,
      },
    });
  }

  const analyticsOrders = [
    { id: 'ord_income_join_001', orderNo: 'JOIN_DEMO_001', userId: 'usr_admin_active_001', type: 'GROUP_JOIN', amount: 88, netAmount: 68, originalAmount: 98, discountAmount: 10, couponId: IDS.coupon, promotionChannelId: IDS.channel, paidDaysAgo: 6 },
    { id: 'ord_income_join_002', orderNo: 'JOIN_DEMO_002', userId: 'usr_admin_boundary_001', type: 'GROUP_JOIN', amount: 98, netAmount: 80, originalAmount: 108, discountAmount: 10, couponId: IDS.coupon, promotionChannelId: IDS.channelMoments, paidDaysAgo: 5 },
    { id: 'ord_income_join_003', orderNo: 'JOIN_DEMO_003', userId: 'usr_review_member_001', type: 'GROUP_JOIN', amount: 118, netAmount: 96, originalAmount: 128, discountAmount: 10, couponId: IDS.coupon, promotionChannelId: IDS.channel, paidDaysAgo: 4 },
    { id: 'ord_income_renewal_001', orderNo: 'RENEW_DEMO_001', userId: 'usr_admin_active_001', type: 'GROUP_RENEWAL', amount: 28, netAmount: 24, originalAmount: 28, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 4 },
    { id: 'ord_income_reward_001', orderNo: 'REWARD_DEMO_001', userId: IDS.buyerUser, type: 'REWARD', amount: 10, netAmount: 8, originalAmount: 10, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 3 },
    { id: 'ord_income_join_004', orderNo: 'JOIN_DEMO_004', userId: 'usr_multi_member_001', type: 'GROUP_JOIN', amount: 108, netAmount: 84, originalAmount: 108, discountAmount: 0, couponId: null, promotionChannelId: IDS.channelMoments, paidDaysAgo: 3 },
    { id: 'ord_income_question_001', orderNo: 'QUESTION_DEMO_001', userId: IDS.buyerUser, type: 'QUESTION', amount: 5, netAmount: 4, originalAmount: 5, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 3 },
    { id: 'ord_income_join_005', orderNo: 'JOIN_DEMO_005', userId: 'usr_admin_banned_001', type: 'GROUP_JOIN', amount: 138, netAmount: 120, originalAmount: 148, discountAmount: 10, couponId: IDS.coupon, promotionChannelId: IDS.channel, paidDaysAgo: 2 },
    { id: 'ord_income_renewal_002', orderNo: 'RENEW_DEMO_002', userId: 'usr_review_expired_001', type: 'GROUP_RENEWAL', amount: 26, netAmount: 22, originalAmount: 26, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 2 },
    { id: 'ord_income_join_006', orderNo: 'JOIN_DEMO_006', userId: IDS.buyerUser, type: 'GROUP_JOIN', amount: 118, netAmount: 108, originalAmount: 128, discountAmount: 10, couponId: IDS.coupon, promotionChannelId: IDS.channelMoments, paidDaysAgo: 1 },
    { id: 'ord_income_renewal_003', orderNo: 'RENEW_DEMO_003', userId: 'usr_admin_boundary_001', type: 'GROUP_RENEWAL', amount: 30, netAmount: 26, originalAmount: 30, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 1 },
    { id: 'ord_income_reward_002', orderNo: 'REWARD_DEMO_002', userId: 'usr_admin_active_001', type: 'REWARD', amount: 12, netAmount: 8, originalAmount: 12, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 1 },
    { id: 'ord_income_join_007', orderNo: 'JOIN_DEMO_007', userId: 'usr_admin_quit_001', type: 'GROUP_JOIN', amount: 138, netAmount: 128, originalAmount: 148, discountAmount: 10, couponId: IDS.coupon, promotionChannelId: IDS.channel, paidDaysAgo: 0 },
    { id: 'ord_income_renewal_004', orderNo: 'RENEW_DEMO_004', userId: IDS.ownerUser, type: 'GROUP_RENEWAL', amount: 28, netAmount: 24, originalAmount: 28, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 0 },
    { id: 'ord_income_reward_003', orderNo: 'REWARD_DEMO_003', userId: 'usr_admin_active_001', type: 'REWARD', amount: 14, netAmount: 10, originalAmount: 14, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 0 },
    { id: 'ord_income_question_002', orderNo: 'QUESTION_DEMO_002', userId: 'usr_review_member_001', type: 'QUESTION', amount: 8, netAmount: 6, originalAmount: 8, discountAmount: 0, couponId: null, promotionChannelId: null, paidDaysAgo: 0 }
  ];

  for (const order of analyticsOrders) {
    const paidAt = new Date(Date.now() - order.paidDaysAgo * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    await prisma.order.upsert({
      where: { orderNo: order.orderNo },
      update: {
        groupId: IDS.group,
        userId: order.userId,
        type: order.type,
        status: 'PAID',
        paymentStatus: 'PAID',
        amount: order.amount,
        netAmount: order.netAmount,
        originalAmount: order.originalAmount,
        discountAmount: order.discountAmount,
        couponId: order.couponId,
        promotionChannelId: order.promotionChannelId,
        paidAt,
        expireAt: paidAt,
      },
      create: {
        id: order.id,
        orderNo: order.orderNo,
        groupId: IDS.group,
        userId: order.userId,
        type: order.type,
        status: 'PAID',
        paymentStatus: 'PAID',
        amount: order.amount,
        netAmount: order.netAmount,
        originalAmount: order.originalAmount,
        discountAmount: order.discountAmount,
        couponId: order.couponId,
        promotionChannelId: order.promotionChannelId,
        paidAt,
        expireAt: paidAt,
      },
    });

    const savedOrder = await prisma.order.findUnique({ where: { orderNo: order.orderNo } });
    if (!savedOrder) continue;

    await prisma.paymentRecord.upsert({
      where: { transactionNo: `TX_${order.orderNo}` },
      update: {
        orderId: savedOrder.id,
        channel: 'WECHAT',
        status: 'PAID',
        amount: order.amount,
        paidAt,
      },
      create: {
        orderId: savedOrder.id,
        channel: 'WECHAT',
        status: 'PAID',
        transactionNo: `TX_${order.orderNo}`,
        amount: order.amount,
        paidAt,
      },
    });
  }

  await upsertGroupStats(
    "grp_multi_admin_001",
    [
      { daysAgo: 6, totalMemberCount: 3, paidMemberCount: 3, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.6667, appDownloadedCount: 2, appDownloadRate: 0.6667 },
      { daysAgo: 5, totalMemberCount: 3, paidMemberCount: 3, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.6667, appDownloadedCount: 2, appDownloadRate: 0.6667 },
      { daysAgo: 4, totalMemberCount: 4, paidMemberCount: 4, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 3, weeklyActiveRate: 0.7500, appDownloadedCount: 3, appDownloadRate: 0.7500 },
      { daysAgo: 3, totalMemberCount: 4, paidMemberCount: 4, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 3, weeklyActiveRate: 0.7500, appDownloadedCount: 3, appDownloadRate: 0.7500 },
      { daysAgo: 2, totalMemberCount: 4, paidMemberCount: 4, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 4, weeklyActiveRate: 1.0000, appDownloadedCount: 4, appDownloadRate: 1.0000 },
      { daysAgo: 1, totalMemberCount: 4, paidMemberCount: 4, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 4, weeklyActiveRate: 1.0000, appDownloadedCount: 4, appDownloadRate: 1.0000 },
      { daysAgo: 0, totalMemberCount: 4, paidMemberCount: 4, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 4, weeklyActiveRate: 1.0000, appDownloadedCount: 4, appDownloadRate: 1.0000 },
    ],
    [
      { daysAgo: 6, topicCount: 0, fileCount: 0, imageCount: 0, commentCount: 0, likeCount: 0 },
      { daysAgo: 5, topicCount: 1, fileCount: 0, imageCount: 0, commentCount: 1, likeCount: 1 },
      { daysAgo: 4, topicCount: 1, fileCount: 0, imageCount: 0, commentCount: 1, likeCount: 2 },
      { daysAgo: 3, topicCount: 2, fileCount: 0, imageCount: 0, commentCount: 1, likeCount: 3 },
      { daysAgo: 2, topicCount: 2, fileCount: 0, imageCount: 1, commentCount: 2, likeCount: 4 },
      { daysAgo: 1, topicCount: 2, fileCount: 0, imageCount: 1, commentCount: 2, likeCount: 5 },
      { daysAgo: 0, topicCount: 2, fileCount: 0, imageCount: 1, commentCount: 1, likeCount: 4 },
    ]
  );

  await upsertGroupStats(
    "grp_review_001",
    [
      { daysAgo: 6, totalMemberCount: 2, paidMemberCount: 2, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 1, weeklyActiveRate: 0.5000, appDownloadedCount: 1, appDownloadRate: 0.5000 },
      { daysAgo: 5, totalMemberCount: 2, paidMemberCount: 2, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 1, weeklyActiveRate: 0.5000, appDownloadedCount: 1, appDownloadRate: 0.5000 },
      { daysAgo: 4, totalMemberCount: 3, paidMemberCount: 3, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.6667, appDownloadedCount: 2, appDownloadRate: 0.6667 },
      { daysAgo: 3, totalMemberCount: 3, paidMemberCount: 3, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.6667, appDownloadedCount: 2, appDownloadRate: 0.6667 },
      { daysAgo: 2, totalMemberCount: 3, paidMemberCount: 3, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.6667, appDownloadedCount: 2, appDownloadRate: 0.6667 },
      { daysAgo: 1, totalMemberCount: 3, paidMemberCount: 3, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.6667, appDownloadedCount: 2, appDownloadRate: 0.6667 },
      { daysAgo: 0, totalMemberCount: 3, paidMemberCount: 3, freeMemberCount: 0, quittedCount: 0, activeMemberCount7d: 2, weeklyActiveRate: 0.6667, appDownloadedCount: 2, appDownloadRate: 0.6667 },
    ],
    [
      { daysAgo: 6, topicCount: 0, fileCount: 0, imageCount: 0, commentCount: 0, likeCount: 0 },
      { daysAgo: 5, topicCount: 0, fileCount: 0, imageCount: 0, commentCount: 0, likeCount: 0 },
      { daysAgo: 4, topicCount: 1, fileCount: 0, imageCount: 0, commentCount: 0, likeCount: 0 },
      { daysAgo: 3, topicCount: 1, fileCount: 0, imageCount: 0, commentCount: 0, likeCount: 0 },
      { daysAgo: 2, topicCount: 2, fileCount: 0, imageCount: 0, commentCount: 1, likeCount: 1 },
      { daysAgo: 1, topicCount: 2, fileCount: 0, imageCount: 0, commentCount: 1, likeCount: 1 },
      { daysAgo: 0, topicCount: 2, fileCount: 0, imageCount: 0, commentCount: 1, likeCount: 1 },
    ]
  );

  await prisma.group.update({
    where: { id: IDS.group },
    data: {
      contentCount: 20,
      memberCount: 7,
      paidMemberCount: 5,
    },
  });

  await prisma.group.update({
    where: { id: "grp_multi_admin_001" },
    data: {
      contentCount: 2,
      memberCount: 4,
      paidMemberCount: 4,
    },
  });

  await prisma.group.update({
    where: { id: "grp_review_001" },
    data: {
      contentCount: 2,
      memberCount: 3,
      paidMemberCount: 3,
    },
  });

  await prisma.groupPermissionPolicy.deleteMany({
    where: {
      groupId: {
        in: LEGACY_DISCOVER_GROUP_IDS,
      },
    },
  });

  await prisma.groupStaff.deleteMany({
    where: {
      groupId: {
        in: LEGACY_DISCOVER_GROUP_IDS,
      },
    },
  });

  await prisma.groupMember.deleteMany({
    where: {
      groupId: {
        in: LEGACY_DISCOVER_GROUP_IDS,
      },
    },
  });

  await prisma.group.deleteMany({
    where: {
      id: {
        in: LEGACY_DISCOVER_GROUP_IDS,
      },
    },
  });

  await prisma.authSession.deleteMany({
    where: {
      userId: {
        in: LEGACY_DISCOVER_OWNER_IDS,
      },
    },
  });

  await prisma.userProfile.deleteMany({
    where: {
      userId: {
        in: LEGACY_DISCOVER_OWNER_IDS,
      },
    },
  });

  await prisma.user.deleteMany({
    where: {
      id: {
        in: LEGACY_DISCOVER_OWNER_IDS,
      },
    },
  });
}

module.exports = {
  IDS,
  ensureDemoData,
};
