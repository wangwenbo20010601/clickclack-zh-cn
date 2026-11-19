<script lang="ts">
  import { onMount } from "svelte";
  import type { BotSetupCode, BotToken } from "../../../lib/bots";
  import {
    buildOpenClawCodeSnippet,
    buildOpenClawConfigSnippet,
    buildOpenClawShellSnippet,
    botLoadErrorMessage,
    createWorkspaceBotSetupCode,
    expandBotScopes,
    summarizeBotScopes,
    type OpenClawAccountMode,
  } from "../../../lib/bots";
  import type { AppSnippetInput } from "../../../lib/app-catalog";

  type SnippetBuilder = (input: AppSnippetInput) => string;

  type Props = {
    // Which single credential this reveal presents. "code" shows only the
    // one-time setup code (no token exists yet); "token" shows only the
    // freshly minted raw token.
    connect?: "code" | "token";
    token?: BotToken | null;
    // Required in code mode, where no token carries these along.
    workspaceID?: string;
    tokenName?: string;
    scopes?: string[];
    botHandle: string;
    botUserID: string;
    workspace: string;
    defaultTo?: string;
    allowFrom?: string[];
    agentActivity?: boolean;
    configSnippetBuilder?: SnippetBuilder | null;
    shellSnippetBuilder?: SnippetBuilder | null;
    codeSnippetBuilder?: SnippetBuilder | null;
    onDismiss: () => void;
  };

  let {
    connect = "token",
    token = null,
    workspaceID,
    tokenName,
    scopes,
    botHandle,
    botUserID,
    workspace,
    defaultTo,
    allowFrom,
    agentActivity,
    configSnippetBuilder = (input) => buildOpenClawConfigSnippet(input),
    shellSnippetBuilder = (input) => buildOpenClawShellSnippet(input),
    codeSnippetBuilder = (input) =>
      buildOpenClawCodeSnippet({
        code: input.setupCode ?? "",
        botHandle: input.botHandle,
        mode: input.mode,
        claimURL: input.setupClaimURL,
        apiBaseURL: input.apiBaseURL,
      }),
    onDismiss,
  }: Props = $props();

  const codeMode = $derived(connect === "code" && !!codeSnippetBuilder);
  const scopeChips = $derived(token?.scopes ?? scopes ?? []);
  const scopeSummary = $derived(summarizeBotScopes(scopeChips));
  // Bundle shorthand from the create/mint forms hides the permissions it
  // grants; the detailed list must always show the concrete scopes.
  const expandedScopes = $derived(expandBotScopes(scopeChips));

  let acknowledged = $state(false);
  let mode = $state<OpenClawAccountMode>("single");
  let copied = $state<"token" | "config" | "shell" | "code" | null>(null);

  // Setup-code connect path (claim-time mint): the code below mints its own
  // token when OpenClaw claims it, so the raw token never travels by hand.
  let setupCode = $state<BotSetupCode | null>(null);
  let mintingCode = $state(false);
  let codeError = $state("");
  let mintedAtMs = $state(0);
  let nowMs = $state(Date.now());

  async function mintSetupCode() {
    if (!codeMode || mintingCode) return;
    const mintWorkspaceID = workspaceID ?? token?.workspace_id;
    if (!mintWorkspaceID) {
      codeError = "此设置码缺少工作区信息。请从机器人的列表项中生成。";
      return;
    }
    const requestedAtMs = Date.now();
    mintingCode = true;
    codeError = "";
    setupCode = null;
    copied = copied === "code" ? null : copied;
    try {
      const minted = await createWorkspaceBotSetupCode(mintWorkspaceID, botUserID, {
        name: tokenName ?? token?.name ?? "default",
        scopes: scopes ?? token?.scopes,
        defaults: {
          defaultTo,
          allowFrom,
          agentActivity,
        },
      });
      if (!minted.code) throw new Error("服务器未返回设置码。请重试。");
      setupCode = minted;
      // Starting at request dispatch is conservative: a slow response may make
      // the UI expire early, but can never leave an already-expired code visible.
      mintedAtMs = requestedAtMs;
      nowMs = Date.now();
    } catch (err) {
      codeError = botLoadErrorMessage(err);
    } finally {
      mintingCode = false;
    }
  }

  onMount(() => {
    if (codeMode) void mintSetupCode();
  });

  $effect(() => {
    const activeCode = setupCode;
    const startedAtMs = mintedAtMs;
    if (!activeCode) return;
    const ttl = Date.parse(activeCode.expires_at) - Date.parse(activeCode.created_at);
    if (!Number.isFinite(ttl) || ttl <= 0) return;
    const timer = setInterval(() => {
      const currentMs = Date.now();
      nowMs = currentMs;
      if (currentMs - startedAtMs >= ttl) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  });

  // Remaining time anchored to the server-side TTL and the locally observed
  // mint moment, so a skewed client clock cannot fake early expiry.
  const codeRemainingMs = $derived.by(() => {
    if (!setupCode) return 0;
    const ttl = Date.parse(setupCode.expires_at) - Date.parse(setupCode.created_at);
    if (!Number.isFinite(ttl) || ttl <= 0) return 0;
    return Math.max(0, ttl - (nowMs - mintedAtMs));
  });
  const codeExpired = $derived(!!setupCode && codeRemainingMs <= 0);
  const codeCountdown = $derived.by(() => {
    const total = Math.ceil(codeRemainingMs / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
  });

  const snippetInput = $derived<AppSnippetInput>({
    workspace,
    botHandle,
    botUserID,
    token: token?.token ?? "",
    mode,
    defaultTo,
    allowFrom,
    agentActivity,
  });
  const configSnippet = $derived(configSnippetBuilder?.(snippetInput) ?? "");
  const shellSnippet = $derived(shellSnippetBuilder?.(snippetInput) ?? "");
  const codeSnippet = $derived(
    setupCode?.code && codeSnippetBuilder
      ? codeSnippetBuilder({
          ...snippetInput,
          setupCode: setupCode.code,
          setupClaimURL: setupCode.claim_url,
          apiBaseURL: setupCode.api_base_url,
        })
      : "",
  );

  async function copyTo(value: string, kind: "token" | "config" | "shell" | "code") {
    try {
      await navigator.clipboard.writeText(value);
      copied = kind;
      setTimeout(() => {
        if (copied === kind) copied = null;
      }, 1800);
    } catch {
      // Clipboard may be blocked; the value is still visible in the input.
    }
  }
</script>

<section class="ws-bots__reveal" aria-live="polite">
  <header class="ws-bots__reveal-header">
    <div>
      {#if codeMode}
        <h3 class="ws-bots__reveal-title">机器人已准备好连接</h3>
        <p class="ws-bots__reveal-hint">
          在运行 OpenClaw 的机器上执行以下命令。一次性设置码会在那里生成机器人令牌，无需手动复制凭据。
        </p>
      {:else}
        <h3 class="ws-bots__reveal-title">新令牌已生成</h3>
        <p class="ws-bots__reveal-hint">
          请立即复制。ClickClack 仅保存哈希值，原始令牌只会显示这一次。如果丢失，请生成新令牌并撤销此令牌。
        </p>
      {/if}
    </div>
  </header>

  {#if codeMode}
    <div class="ws-bots__reveal-field">
      <div class="ws-bots__reveal-snippet-header">
        <span class="ws-bots__reveal-label">添加到 OpenClaw</span>
        {#if setupCode && !codeExpired}
          <button type="button" class="ws-btn ws-btn--primary" onclick={() => copyTo(codeSnippet, "code")}>
            {copied === "code" ? "已复制" : "复制命令"}
          </button>
        {/if}
      </div>
      {#if setupCode && !codeExpired}
        <pre class="ws-bots__reveal-snippet"><code>{codeSnippet}</code></pre>
        <p class="ws-bots__reveal-hint">
          一次性设置码，仅可使用一次。
          <span aria-hidden="true">将在 <strong>{codeCountdown}</strong> 后过期。</span>
          <span class="sr-only">设置码在生成十分钟后过期。</span>
          运行中的 <code>openclaw gateway</code> 会自动识别新频道。
        </p>
      {:else if codeExpired}
        <p class="ws-bots__reveal-hint" role="status">
          此设置码在使用前已过期。有效期为 10 分钟，请在准备就绪后生成新设置码。
        </p>
        <div>
          <button type="button" class="ws-btn" onclick={mintSetupCode} disabled={mintingCode}>
            {mintingCode ? "正在生成…" : "生成新设置码"}
          </button>
        </div>
      {:else if mintingCode}
        <p class="ws-bots__reveal-hint">正在生成设置码…</p>
      {:else if codeError}
        <p class="ws-bots__form-error" role="alert">{codeError}</p>
        <div>
          <button type="button" class="ws-btn" onclick={mintSetupCode}>重试</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if codeMode || ((configSnippetBuilder || shellSnippetBuilder) && token)}
  <div class="ws-bots__reveal-field">
    <span class="ws-bots__reveal-label">OpenClaw 账户模式</span>
    <div class="ws-bots__setup-mode" role="group" aria-label="OpenClaw 账户模式">
      <button
        type="button"
        class:is-active={mode === "single"}
        onclick={() => (mode = "single")}
      >
        单个机器人
      </button>
      <button
        type="button"
        class:is-active={mode === "named"}
        onclick={() => (mode = "named")}
      >
        命名账户
      </button>
    </div>
  </div>
  {/if}

  {#if !codeMode && token}
    <div class="ws-bots__reveal-field">
      <label class="ws-bots__reveal-label" for="ws-bots-reveal-token">令牌</label>
      <div class="ws-bots__reveal-row">
        <input
          id="ws-bots-reveal-token"
          class="ws-bots__reveal-input"
          type="text"
          readonly
          value={token.token ?? ""}
        />
        <button
          type="button"
          class="ws-btn ws-btn--primary"
          onclick={() => copyTo(token?.token ?? "", "token")}
        >
          {copied === "token" ? "已复制" : "复制"}
        </button>
      </div>
    </div>

    {#if shellSnippetBuilder || configSnippetBuilder}
      <details class="ws-bots__reveal-details">
        <summary class="ws-bots__reveal-summary">OpenClaw 设置</summary>
        <div class="ws-bots__reveal-details-body">
          {#if shellSnippetBuilder}
            <div class="ws-bots__reveal-snippet-header">
              <span class="ws-bots__reveal-label">使用令牌添加到 OpenClaw</span>
              <button
                type="button"
                class="ws-btn"
                onclick={() => copyTo(shellSnippet, "shell")}
              >
                {copied === "shell" ? "已复制" : "复制命令"}
              </button>
            </div>
            <pre class="ws-bots__reveal-snippet"><code>{shellSnippet}</code></pre>
            <p class="ws-bots__reveal-hint">
              运行中的 OpenClaw 网关会自动识别此配置。尚未启动时，可运行
              <code>openclaw gateway</code>。
            </p>
          {/if}

          {#if configSnippetBuilder}
            <div class="ws-bots__reveal-snippet-header">
              <span class="ws-bots__reveal-label">OpenClaw 配置</span>
              <button
                type="button"
                class="ws-btn"
                onclick={() => copyTo(configSnippet, "config")}
              >
                {copied === "config" ? "已复制" : "复制配置"}
              </button>
            </div>
            <pre class="ws-bots__reveal-snippet"><code>{configSnippet}</code></pre>
            <p class="ws-bots__reveal-hint">
              以上命令会自动写入此配置。你也可以手动安装，或添加命令未涵盖的选项（智能体活动、默认频道、允许列表）。
            </p>
          {/if}
        </div>
      </details>
    {/if}
  {/if}

  {#if scopeChips.length}
    <div class="ws-bots__reveal-field">
      <span class="ws-bots__reveal-label">权限范围</span>
      <div class="ws-bots__scope-row">
        {#if scopeSummary.bundleLabel}
          <span class="ws-bots__scope-chip ws-bots__scope-chip--bundle">
            {scopeSummary.bundleLabel}
          </span>
        {/if}
        {#each scopeSummary.extras as scope (scope)}
          <span class="ws-bots__scope-chip">{scope}</span>
        {/each}
      </div>
      {#if scopeSummary.bundle && expandedScopes.length > 1}
        <details class="ws-bots__scope-details">
          <summary>全部 {expandedScopes.length} 项权限</summary>
          <div class="ws-bots__scope-row">
            {#each expandedScopes as scope (scope)}
              <span class="ws-bots__scope-chip">{scope}</span>
            {/each}
          </div>
        </details>
      {/if}
    </div>
  {/if}

  <label class="ws-bots__reveal-ack">
    <input type="checkbox" bind:checked={acknowledged} />
    {#if codeMode}
      <span>我已运行命令，或稍后从机器人的列表项中生成新设置码。</span>
    {:else}
      <span>我已将此令牌复制到安全的地方。</span>
    {/if}
  </label>

  <div class="ws-bots__reveal-actions">
    <button type="button" class="ws-btn ws-btn--primary" disabled={!acknowledged} onclick={onDismiss}>
      完成
    </button>
  </div>
</section>
