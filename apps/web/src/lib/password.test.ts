import test from "node:test";
import assert from "node:assert/strict";
import { MIN_PASSWORD_LENGTH, canChangePassword, validateNewPassword } from "./password.ts";

test("canChangePassword needs both the deployment flag and an enrolled account", () => {
  assert.equal(canChangePassword({ password_enrolled: true }, ["password"]), true);
  assert.equal(canChangePassword({ password_enrolled: true }, ["github"]), false);
  assert.equal(canChangePassword({ password_enrolled: false }, ["password"]), false);
  assert.equal(canChangePassword({}, ["password"]), false);
  assert.equal(canChangePassword({ password_enrolled: true }, []), false);
});

test("validateNewPassword reports the first unmet requirement", () => {
  assert.equal(validateNewPassword("", "longenough", "longenough"), "请输入当前密码。");
  assert.equal(validateNewPassword("current", "", ""), "请输入新密码。");
  assert.equal(
    validateNewPassword("current", "short", "short"),
    `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符。`,
  );
  assert.equal(
    validateNewPassword("current", "longenough", "longenougi"),
    "两次输入的新密码不一致。",
  );
});

test("validateNewPassword accepts a confirmed password at the minimum length", () => {
  const atMinimum = "x".repeat(MIN_PASSWORD_LENGTH);
  assert.equal(validateNewPassword("current", atMinimum, atMinimum), "");
});

test("validateNewPassword counts Unicode characters rather than UTF-16 units", () => {
  const short = "🦞".repeat(4);
  assert.notEqual(validateNewPassword("current", short, short), "");
  const valid = "🦞".repeat(MIN_PASSWORD_LENGTH);
  assert.equal(validateNewPassword("current", valid, valid), "");
});
