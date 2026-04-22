const { prisma } = require("../src/db/prisma");

function parseArgs(argv) {
  const args = {
    groupId: "",
    execute: false,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--") && !args.groupId) {
      args.groupId = arg;
      continue;
    }

    if (arg === "--execute") {
      args.execute = true;
    }
  }

  return args;
}

async function loadGroupDependencySummary(tx, groupId) {
  const group = await tx.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      slug: true,
      permissionPolicy: {
        select: { id: true },
      },
      staffs: {
        select: { id: true },
      },
      members: {
        select: { id: true },
      },
      posts: {
        select: { id: true },
      },
      orders: {
        select: { id: true },
      },
      coupons: {
        select: { id: true },
      },
      promotionChannels: {
        select: { id: true },
      },
      notifications: {
        select: { id: true },
      },
      renewalSetting: {
        select: { id: true },
      },
      renewalTemplates: {
        select: { id: true },
      },
      scoreboardSetting: {
        select: { id: true },
      },
      scoreRules: {
        select: { id: true },
      },
      scoreLedgers: {
        select: { id: true },
      },
      identityContracts: {
        select: { id: true },
      },
      exportTasks: {
        select: { id: true },
      },
      incomeStats: {
        select: { id: true },
      },
      promotionStats: {
        select: { id: true },
      },
      memberStats: {
        select: { id: true },
      },
      contentStats: {
        select: { id: true },
      },
      renewalStats: {
        select: { id: true },
      },
    },
  });

  if (!group) {
    return null;
  }

  const memberIds = group.members.map((item) => item.id);
  const postIds = group.posts.map((item) => item.id);
  const orderIds = group.orders.map((item) => item.id);
  const couponIds = group.coupons.map((item) => item.id);
  const promotionChannelIds = group.promotionChannels.map((item) => item.id);

  const [couponClaims, paymentRecords, orderStatusLogs, comments, analyticsEvents] =
    await Promise.all([
      tx.couponClaim.count({
        where: {
          OR: [
            couponIds.length ? { couponId: { in: couponIds } } : undefined,
            memberIds.length ? { memberId: { in: memberIds } } : undefined,
            orderIds.length ? { orderId: { in: orderIds } } : undefined,
          ].filter(Boolean),
        },
      }),
      orderIds.length
        ? tx.paymentRecord.count({
            where: { orderId: { in: orderIds } },
          })
        : 0,
      orderIds.length
        ? tx.orderStatusLog.count({
            where: { orderId: { in: orderIds } },
          })
        : 0,
      postIds.length
        ? tx.comment.count({
            where: { postId: { in: postIds } },
          })
        : 0,
      tx.analyticsEvent.count({
        where: { groupId },
      }),
    ]);

  return {
    group: {
      id: group.id,
      name: group.name,
      slug: group.slug,
    },
    ids: {
      memberIds,
      postIds,
      orderIds,
      couponIds,
      promotionChannelIds,
    },
    counts: {
      group: 1,
      groupPermissionPolicy: group.permissionPolicy ? 1 : 0,
      groupStaff: group.staffs.length,
      groupMember: group.members.length,
      post: group.posts.length,
      comment: comments,
      order: group.orders.length,
      paymentRecord: paymentRecords,
      orderStatusLog: orderStatusLogs,
      coupon: group.coupons.length,
      couponClaim: couponClaims,
      promotionChannel: group.promotionChannels.length,
      groupNotification: group.notifications.length,
      renewalSetting: group.renewalSetting ? 1 : 0,
      renewalNotificationTemplate: group.renewalTemplates.length,
      scoreboardSetting: group.scoreboardSetting ? 1 : 0,
      scoreRule: group.scoreRules.length,
      memberScoreLedger: group.scoreLedgers.length,
      identityMemberContract: group.identityContracts.length,
      exportTask: group.exportTasks.length,
      groupIncomeDailyStat: group.incomeStats.length,
      groupPromotionDailyStat: group.promotionStats.length,
      groupMemberDailyStat: group.memberStats.length,
      groupContentDailyStat: group.contentStats.length,
      groupRenewalDailyStat: group.renewalStats.length,
      analyticsEvent: analyticsEvents,
    },
  };
}

async function deleteGroupTree(tx, groupId, summary) {
  const { ids } = summary;

  if (ids.orderIds.length) {
    await tx.orderStatusLog.deleteMany({
      where: {
        orderId: {
          in: ids.orderIds,
        },
      },
    });

    await tx.paymentRecord.deleteMany({
      where: {
        orderId: {
          in: ids.orderIds,
        },
      },
    });
  }

  if (ids.couponIds.length || ids.memberIds.length || ids.orderIds.length) {
    await tx.couponClaim.deleteMany({
      where: {
        OR: [
          ids.couponIds.length ? { couponId: { in: ids.couponIds } } : undefined,
          ids.memberIds.length ? { memberId: { in: ids.memberIds } } : undefined,
          ids.orderIds.length ? { orderId: { in: ids.orderIds } } : undefined,
        ].filter(Boolean),
      },
    });
  }

  if (ids.postIds.length) {
    await tx.comment.deleteMany({
      where: {
        postId: {
          in: ids.postIds,
        },
      },
    });
  }

  await tx.analyticsEvent.deleteMany({
    where: { groupId },
  });

  await tx.memberScoreLedger.deleteMany({
    where: { groupId },
  });

  await tx.groupNotification.deleteMany({
    where: { groupId },
  });

  await tx.renewalNotificationTemplate.deleteMany({
    where: { groupId },
  });

  await tx.scoreRule.deleteMany({
    where: { groupId },
  });

  await tx.identityMemberContract.deleteMany({
    where: { groupId },
  });

  await tx.exportTask.deleteMany({
    where: { groupId },
  });

  await tx.groupIncomeDailyStat.deleteMany({
    where: { groupId },
  });

  await tx.groupPromotionDailyStat.deleteMany({
    where: { groupId },
  });

  await tx.groupMemberDailyStat.deleteMany({
    where: { groupId },
  });

  await tx.groupContentDailyStat.deleteMany({
    where: { groupId },
  });

  await tx.groupRenewalDailyStat.deleteMany({
    where: { groupId },
  });

  if (ids.orderIds.length) {
    await tx.order.deleteMany({
      where: {
        id: {
          in: ids.orderIds,
        },
      },
    });
  }

  if (ids.postIds.length) {
    await tx.post.deleteMany({
      where: {
        id: {
          in: ids.postIds,
        },
      },
    });
  }

  if (ids.couponIds.length) {
    await tx.coupon.deleteMany({
      where: {
        id: {
          in: ids.couponIds,
        },
      },
    });
  }

  if (ids.promotionChannelIds.length) {
    await tx.promotionChannel.deleteMany({
      where: {
        id: {
          in: ids.promotionChannelIds,
        },
      },
    });
  }

  await tx.groupPermissionPolicy.deleteMany({
    where: { groupId },
  });

  await tx.groupStaff.deleteMany({
    where: { groupId },
  });

  await tx.renewalSetting.deleteMany({
    where: { groupId },
  });

  await tx.scoreboardSetting.deleteMany({
    where: { groupId },
  });

  await tx.groupMember.deleteMany({
    where: { groupId },
  });

  await tx.group.delete({
    where: { id: groupId },
  });
}

async function main() {
  const { groupId, execute } = parseArgs(process.argv.slice(2));

  if (!groupId) {
    console.error("用法: node scripts/deleteGroup.js <groupId> [--execute]");
    process.exit(1);
  }

  const summary = await prisma.$transaction((tx) =>
    loadGroupDependencySummary(tx, groupId)
  );

  if (!summary) {
    console.error(`未找到 group: ${groupId}`);
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "dry-run",
        group: summary.group,
        counts: summary.counts,
      },
      null,
      2
    )
  );

  if (!execute) {
    console.log("加上 --execute 才会真正删除。");
    return;
  }

  await prisma.$transaction((tx) => deleteGroupTree(tx, groupId, summary));

  console.log(
    JSON.stringify(
      {
        ok: true,
        deletedGroupId: groupId,
      },
      null,
      2
    )
  );
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
