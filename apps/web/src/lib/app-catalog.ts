// The app catalog: manifest-driven guided installs (Model 1 — agents
// connect INTO ClickClack via bot tokens; ClickClack never embeds agent
// runtimes). Each manifest describes how to install one agent platform:
// what the bot should look like, which token scopes it needs, what
// config the wizard collects, and how to render the platform-specific
// setup snippet. Adding support for a new agent platform means adding
// one manifest here — no core changes.
import {
  buildOpenClawCodeSnippet,
  buildOpenClawConfigSnippet,
  buildOpenClawShellSnippet,
  type BotScopeBundle,
  type OpenClawAccountMode,
} from "./bots";

// Dedicated scope required for durable agent activity rows (streamed
// "Thinking…" commentary + tool progress). Deliberately excluded from the
// bot:* bundles on the backend; installs opt in explicitly.
export const AGENT_ACTIVITY_SCOPE = "agent_activity:write";

export type AppConfigFieldId = "default_channel" | "allow_from" | "agent_activity";

export type AppConfigField = {
  id: AppConfigFieldId;
  label: string;
  hint: string;
};

export type AppSnippetInput = {
  workspace: string;
  botHandle: string;
  botUserID: string;
  token: string;
  mode: OpenClawAccountMode;
  defaultTo?: string;
  allowFrom?: string[];
  agentActivity?: boolean;
  // One-time setup code, set when rendering the code-based connect snippet.
  setupCode?: string;
  setupClaimURL?: string;
  apiBaseURL?: string;
};

export type AppManifest = {
  slug: string;
  name: string;
  description: string;
  // 24×24 stroke icon path data, matching the settings rail convention.
  icon: string[];
  suggestedScopeBundle: BotScopeBundle;
  suggestedBotName: string;
  suggestedBotHandle: string;
  configFields: AppConfigField[];
  // null → no platform snippet (generic install; the token reveal is enough).
  buildConfigSnippet: ((input: AppSnippetInput) => string) | null;
  buildShellSnippet: ((input: AppSnippetInput) => string) | null;
  // Setup-code one-liner (input.setupCode set). null → no code-based connect.
  buildCodeSnippet: ((input: AppSnippetInput) => string) | null;
};

export const APP_CATALOG: AppManifest[] = [
  {
    slug: "openclaw",
    name: "OpenClaw",
    description:
      "将 OpenClaw 智能体作为机器人用户接入。OpenClaw 在 ClickClack 外部运行，使用此处生成的机器人令牌建立实时连接。",
    icon: [
      "M12 8V4H8",
      "M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
      "M9 13v2",
      "M15 13v2",
    ],
    suggestedScopeBundle: "bot:write",
    suggestedBotName: "OpenClaw",
    suggestedBotHandle: "openclaw",
    configFields: [
      {
        id: "default_channel",
        label: "默认频道",
        hint: "未指定目标时，智能体将在此频道发送消息。",
      },
      {
        id: "allow_from",
        label: "谁可以与此智能体对话",
        hint: "可选择工作区中的所有人或指定成员。",
      },
      {
        id: "agent_activity",
        label: "智能体活动",
        hint: "将智能体工作时的思考和工具执行进度实时显示在对话中。这将授予令牌 agent_activity:write 权限。",
      },
    ],
    buildConfigSnippet: (input) =>
      buildOpenClawConfigSnippet({
        workspace: input.workspace,
        botHandle: input.botHandle,
        botUserID: input.botUserID,
        mode: input.mode,
        defaultTo: input.defaultTo,
        allowFrom: input.allowFrom,
        agentActivity: input.agentActivity,
      }),
    buildShellSnippet: (input) =>
      buildOpenClawShellSnippet({
        botHandle: input.botHandle,
        token: input.token,
        mode: input.mode,
        workspace: input.workspace,
      }),
    buildCodeSnippet: (input) =>
      buildOpenClawCodeSnippet({
        code: input.setupCode ?? "",
        botHandle: input.botHandle,
        mode: input.mode,
        claimURL: input.setupClaimURL,
        apiBaseURL: input.apiBaseURL,
      }),
  },
  {
    slug: "custom",
    name: "自定义应用",
    description:
      "适用于通过机器人令牌调用 ClickClack API 的外部应用或脚本。无需针对特定平台设置，即可获取机器人、令牌和 API。",
    icon: [
      "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
    ],
    suggestedScopeBundle: "bot:write",
    suggestedBotName: "",
    suggestedBotHandle: "",
    configFields: [],
    buildConfigSnippet: null,
    buildShellSnippet: null,
    buildCodeSnippet: null,
  },
];

export function manifestBySlug(slug: string): AppManifest | undefined {
  return APP_CATALOG.find((manifest) => manifest.slug === slug);
}

// Display metadata for installations whose slug has no manifest (installed
// via the API directly). Falls back to a generic plug icon.
export function manifestForInstallation(appSlug: string): AppManifest {
  return (
    manifestBySlug(appSlug) ?? {
      slug: appSlug,
      name: appSlug,
      description: "",
      icon: ["M9 2v6", "M15 2v6", "M12 17v5", "M5 8h14l-1 7a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4L5 8Z"],
      suggestedScopeBundle: "bot:write",
      suggestedBotName: "",
      suggestedBotHandle: "",
      configFields: [],
      buildConfigSnippet: null,
      buildShellSnippet: null,
      buildCodeSnippet: null,
    }
  );
}
