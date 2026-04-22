const assert = require("assert/strict");

process.env.PRISMA_AUTO_SYNC = "0";

const authService = require("../src/services/authService");

const selectExistingUserForLogin =
  authService.__test__ && authService.__test__.selectExistingUserForLogin;

assert.equal(
  typeof selectExistingUserForLogin,
  "function",
  "Expected authService.__test__.selectExistingUserForLogin to be exposed for login selection verification.",
);

const mobileBoundDevUser = {
  id: "user_mobile_1222",
  mobile: "12222222222",
  openId: "openid-dev::12222222222",
  unionId: "unionid-dev::12222222222",
};

const selectedForSilentLogin = selectExistingUserForLogin({
  normalizedMobile: null,
  existingByMobile: null,
  existingByOpenId: null,
  preferredDevUser: mobileBoundDevUser,
  fallbackDevUser: mobileBoundDevUser,
});

assert.equal(
  selectedForSilentLogin,
  null,
  "Silent WeChat login must not auto-select a different mobile-bound dev account when no exact identity match exists.",
);

const selectedForPhoneLogin = selectExistingUserForLogin({
  normalizedMobile: "18750086213",
  existingByMobile: {
    id: "user_mobile_1875",
    mobile: "18750086213",
    openId: "openid-dev::18750086213",
    unionId: "unionid-dev::18750086213",
  },
  existingByOpenId: null,
  preferredDevUser: mobileBoundDevUser,
  fallbackDevUser: mobileBoundDevUser,
});

assert.equal(
  selectedForPhoneLogin && selectedForPhoneLogin.mobile,
  "18750086213",
  "Explicit phone login must still resolve to the requested mobile account.",
);

console.log("auth silent login selection test passed");
