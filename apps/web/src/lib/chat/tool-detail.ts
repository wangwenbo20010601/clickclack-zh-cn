// Tool-call presentation detail for coalesced preamble blocks.
//
// Each agent_tool row carries a tool name (the bridge's toolName/title) and an
// optional argument-derived detail string. To give the tool sub-items a
// readable label we derive a stable glyph + short human action from the name,
// mirroring the clickglass tool-line treatment so the two surfaces read alike.

export type ToolDetail = {
  // The raw tool name as stored (e.g. "exec", "read", "browserControl").
  name: string;
  // A small glyph hint for the tool category.
  glyph: string;
  // A short human action label (e.g. "Ran shell command", "Edited file").
  action: string;
  // A short "what/where" summary derived from the call (command, path, url).
  detail?: string;
};

const EXACT: Record<string, { glyph: string; action: string }> = {
  bash: { glyph: "\u{1F5A5}", action: "已运行终端命令" },
  exec: { glyph: "\u{1F5A5}", action: "已运行终端命令" },
  command: { glyph: "\u{1F5A5}", action: "已运行终端命令" },
  bashsession: { glyph: "\u{1F5A5}", action: "已管理终端会话" },
  sessions_send: { glyph: "\u{1F5A5}", action: "已管理终端会话" },
  read: { glyph: "\u{1F4D6}", action: "已读取文件" },
  write: { glyph: "\u{1F4DD}", action: "已写入文件" },
  edit: { glyph: "\u270F", action: "已编辑文件" },
  apply_patch: { glyph: "\u{1F9E9}", action: "已应用补丁" },
  applypatch: { glyph: "\u{1F9E9}", action: "已应用补丁" },
  browsercontrol: { glyph: "\u{1F310}", action: "已操作浏览器" },
  websearch: { glyph: "\u{1F50D}", action: "已搜索网页" },
  webfetch: { glyph: "\u{1F517}", action: "已获取网页" },
  image: { glyph: "\u{1F5BC}", action: "已分析图片" },
  imagecreate: { glyph: "\u{1F3A8}", action: "已生成图片" },
  scheduler: { glyph: "\u23F0", action: "已安排任务" },
  sendmessage: { glyph: "\u{1F4E4}", action: "已发送消息" },
  message: { glyph: "\u{1F4E4}", action: "已发送消息" },
  systemctl: { glyph: "\u2699", action: "已操作系统" },
  process: { glyph: "\u2699", action: "已管理进程" },
  devicecontrol: { glyph: "\u{1F4F1}", action: "已操作设备" },
  pdfparse: { glyph: "\u{1F4C4}", action: "已解析 PDF" },
  statuscheck: { glyph: "\u{1F4CA}", action: "已检查状态" },
};

type Rule = { test: (lower: string) => boolean; glyph: string; action: string };

const RULES: Rule[] = [
  { test: (l) => l.includes("search"), glyph: "\u{1F50D}", action: "已搜索" },
  { test: (l) => l.includes("fetch"), glyph: "\u{1F517}", action: "已获取" },
  { test: (l) => l.includes("browser"), glyph: "\u{1F310}", action: "已操作浏览器" },
  { test: (l) => l.includes("patch"), glyph: "\u{1F9E9}", action: "已应用补丁" },
  { test: (l) => l.includes("write"), glyph: "\u{1F4DD}", action: "已写入文件" },
  { test: (l) => l.includes("edit"), glyph: "\u270F", action: "已编辑文件" },
  { test: (l) => l.includes("read"), glyph: "\u{1F4D6}", action: "已读取文件" },
  { test: (l) => l.includes("session"), glyph: "\u{1F5A5}", action: "已管理终端会话" },
  {
    test: (l) => l.includes("bash") || l.includes("shell") || l.includes("exec"),
    glyph: "\u{1F5A5}",
    action: "已运行命令",
  },
  { test: (l) => l.includes("image"), glyph: "\u{1F5BC}", action: "已处理图片" },
  {
    test: (l) => l.includes("message") || l.includes("send"),
    glyph: "\u{1F4E4}",
    action: "已发送消息",
  },
  {
    test: (l) => l.includes("agent") || l.includes("subagent"),
    glyph: "\u{1F916}",
    action: "已运行子智能体",
  },
  {
    test: (l) => l.includes("schedul") || l.includes("cron"),
    glyph: "\u23F0",
    action: "已安排任务",
  },
  { test: (l) => l.includes("device"), glyph: "\u{1F4F1}", action: "已操作设备" },
  {
    test: (l) => l.includes("file") || l.includes("dir"),
    glyph: "\u{1F4C1}",
    action: "已处理文件",
  },
];

export function toolDetail(rawName: string, detail?: string): ToolDetail {
  const name = String(rawName || "").trim();
  const lower = name.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const trimmedDetail = String(detail || "").trim() || undefined;
  const exact = EXACT[lower];
  if (exact) return { name, glyph: exact.glyph, action: exact.action, detail: trimmedDetail };
  for (const rule of RULES) {
    if (rule.test(lower))
      return { name, glyph: rule.glyph, action: rule.action, detail: trimmedDetail };
  }
  // Unknown or empty name: a generic tool glyph. When the name is empty the
  // detail (the full body) carries the meaning.
  return { name: name || "tool", glyph: "\u{1F527}", action: "已使用工具", detail: trimmedDetail };
}
