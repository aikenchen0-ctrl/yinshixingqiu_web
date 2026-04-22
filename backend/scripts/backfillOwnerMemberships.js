require("dotenv").config({ quiet: true });

const { prisma } = require("../src/db/prisma");

async function backfillOwnerMemberships() {
  const groups = await prisma.group.findMany({
    include: {
      members: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let createdCount = 0;

  for (const group of groups) {
    const ownerMembership = group.members.find((item) => item.userId === group.ownerUserId);
    if (!ownerMembership) {
      const nextMemberNo = group.members.reduce((maxValue, item) => {
        return typeof item.memberNo === "number" && item.memberNo > maxValue ? item.memberNo : maxValue;
      }, 0) + 1;

      await prisma.groupMember.create({
        data: {
          groupId: group.id,
          userId: group.ownerUserId,
          memberNo: nextMemberNo,
          status: "ACTIVE",
          joinSource: "MANUAL",
          isPaid: group.joinType !== "FREE",
          joinedAt: group.createdAt,
          firstJoinedAt: group.createdAt,
          expireAt: null,
          lastActiveAt: group.updatedAt || group.createdAt,
        },
      });

      createdCount += 1;
    }

    await prisma.group.update({
      where: { id: group.id },
      data: {
        memberCount: await prisma.groupMember.count({
          where: {
            groupId: group.id,
            status: "ACTIVE",
          },
        }),
        paidMemberCount: await prisma.groupMember.count({
          where: {
            groupId: group.id,
            status: "ACTIVE",
            isPaid: true,
          },
        }),
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        scannedGroups: groups.length,
        createdOwnerMemberships: createdCount,
      },
      null,
      2
    )
  );
}

backfillOwnerMemberships()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
