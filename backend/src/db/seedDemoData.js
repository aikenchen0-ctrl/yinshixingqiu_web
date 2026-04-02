const { prisma } = require("./prisma");

const IDS = {
  ownerUser: "usr_owner_001",
  buyerUser: "usr_buyer_001",
  group: "grp_datawhale_001",
  policy: "gpp_001",
  ownerMember: "mbr_owner_001",
  coupon: "cpn_new_001",
  channel: "chn_wechat_menu_001",
};

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

async function ensureDemoData(options = {}) {
  const { resetRuntime = false } = options;

  if (resetRuntime) {
    await prisma.$transaction([
      prisma.couponClaim.deleteMany({}),
      prisma.paymentRecord.deleteMany({}),
      prisma.order.deleteMany({}),
      prisma.analyticsEvent.deleteMany({}),
      prisma.orderStatusLog.deleteMany({}),
      prisma.outboxJob.deleteMany({}),
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
      bio: "待加入的新用户",
    },
    create: {
      userId: IDS.buyerUser,
      nickname: "张三",
      avatarUrl: "https://img.example.com/u2001.jpg",
      bio: "待加入的新用户",
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
      memberCount: 1,
      paidMemberCount: 1,
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
      memberCount: 1,
      paidMemberCount: 1,
      contentCount: 1,
      publishedAt: new Date(),
    },
  });

  await prisma.groupPermissionPolicy.upsert({
    where: { groupId: IDS.group },
    update: {
      allowJoin: true,
      needExamine: false,
      allowPreview: true,
      allowSearch: true,
    },
    create: {
      id: IDS.policy,
      groupId: IDS.group,
      allowJoin: true,
      needExamine: false,
      allowPreview: true,
      allowSearch: true,
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
