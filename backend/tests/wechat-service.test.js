const test = require("node:test");
const assert = require("node:assert/strict");

const { buildMiniProgramSchemePayload, formatWechatApiErrorMessage } = require("../src/services/wechatService");

test("buildMiniProgramSchemePayload splits path and query for article detail share links", () => {
  assert.deepEqual(
    buildMiniProgramSchemePayload({
      path: "/pages/articles/detail?id=cmogujt25001rspsr8ij1jwig&source=wechat&shareImageKey=img_4a0nvn&shareImageIndex=2",
      envVersion: "release",
    }),
    {
      is_expire: false,
      jump_wxa: {
        path: "/pages/articles/detail",
        query: "id=cmogujt25001rspsr8ij1jwig&source=wechat&shareImageKey=img_4a0nvn&shareImageIndex=2",
        env_version: "release",
      },
    }
  );
});

test("buildMiniProgramSchemePayload omits empty query", () => {
  assert.deepEqual(
    buildMiniProgramSchemePayload({
      path: "/pages/index/index",
      envVersion: "trial",
    }),
    {
      is_expire: false,
      jump_wxa: {
        path: "/pages/index/index",
        query: undefined,
        env_version: "trial",
      },
    }
  );
});

test("buildMiniProgramSchemePayload rejects missing path", () => {
  assert.throws(() => buildMiniProgramSchemePayload({ path: "" }), /缺少小程序页面路径/);
});

test("formatWechatApiErrorMessage translates 85079 into release guidance", () => {
  assert.equal(
    formatWechatApiErrorMessage("生成微信小程序链接失败", {
      errcode: 85079,
      errmsg: "miniprogram has no online release",
    }),
    "当前小程序还没有线上发布版本，微信暂时不允许生成可复制的小程序链接。请先在微信公众平台发布一次线上版本。"
  );
});
