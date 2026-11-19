import type { User } from "./types";

// Mirrors passwordauth.MinPasswordLength. The server is the authority; this
// only saves a round trip on an obviously short secret.
export const MIN_PASSWORD_LENGTH = 8;

export function canChangePassword(
  user: Pick<User, "password_enrolled">,
  methods: string[],
): boolean {
  return methods.includes("password") && user.password_enrolled === true;
}

export function validateNewPassword(current: string, next: string, confirm: string): string {
  if (!current) return "请输入当前密码。";
  if (!next) return "请输入新密码。";
  if ([...next].length < MIN_PASSWORD_LENGTH) {
    return `新密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符。`;
  }
  if (next !== confirm) return "两次输入的新密码不一致。";
  return "";
}
