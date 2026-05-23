const test = require("node:test");
const assert = require("node:assert/strict");

require.cache[require.resolve("../src/db/prisma")] = {
  exports: {
    prisma: {},
  },
};
require.cache[require.resolve("../src/services/contentService")] = {
  exports: {
    getPostDetail: async () => {
      throw new Error("not used in this test");
    },
    createPost: async () => {
      throw new Error("not used in this test");
    },
    updatePost: async () => {
      throw new Error("not used in this test");
    },
    resolveViewerIdentity: async () => "",
    getGroupManagerAccess: async () => ({ canManage: false }),
  },
};
require.cache[require.resolve("../src/services/adminService")] = {
  exports: {
    updateAdminContent: async () => {
      throw new Error("not used in this test");
    },
  },
};
require.cache[require.resolve("../src/services/articleReadService")] = {
  exports: {
    loadViewerArticleUnlockIdSet: async () => new Set(),
  },
};

const { importWechatArticleAnonymously } = require("../src/services/articleService");

test("importWechatArticleAnonymously keeps the extracted wechat author name for miniapp display", async () => {
  const now = new Date("2026-04-23T15:00:00.000Z");
  const target = {
    group: {
      id: "grp_public_001",
      name: "公共文章池",
      avatarUrl: "https://xueyinx.cn/assets/group.png",
      coverUrl: "https://xueyinx.cn/assets/group.png",
    },
    author: {
      id: "user_system_001",
      profile: {
        nickname: "系统作者",
        avatarUrl: "https://xueyinx.cn/assets/user.png",
      },
    },
  };
  const database = {
    post: {
      async create({ data }) {
        return {
          id: "post_wechat_001",
          groupId: data.groupId,
          authorUserId: data.authorUserId,
          type: data.type,
          status: data.status,
          title: data.title,
          summary: data.summary,
          contentText: data.contentText,
          attachments: data.attachments,
          metadata: data.metadata,
          isPinned: false,
          isEssence: false,
          readingCount: 0,
          likeCount: 0,
          commentCount: 0,
          publishedAt: data.publishedAt,
          createdAt: now,
          updatedAt: now,
          group: target.group,
          author: target.author,
        };
      },
    },
  };

  const result = await importWechatArticleAnonymously(
    {
      title: "测试标题",
      summary: "测试摘要",
      contentText: "正文内容",
      contentSource: "wechat",
      coverUrl: "https://mmbiz.qpic.cn/cover.png",
      richContent: "<p>正文内容</p>",
      attachments: ["https://mmbiz.qpic.cn/cover.png"],
      metadata: {
        author: "原公众号作者",
        sourceUrl: "https://mp.weixin.qq.com/s/test",
      },
    },
    {
      prisma: database,
      now: () => now,
      resolveTarget: async () => target,
    },
  );

  assert.equal(result.statusCode, 201);
  assert.equal(result.payload.ok, true);
  assert.equal(result.payload.data.contentSource, "wechat");
  assert.equal(result.payload.data.authorDisplay.name, "原公众号作者");
  assert.equal(result.payload.data.authorDisplay.type, "wechat_account");
  assert.equal(result.payload.data.metadata.author, "原公众号作者");
  assert.equal(result.payload.data.groupId, "grp_public_001");
});
