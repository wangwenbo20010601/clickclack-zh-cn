<script lang="ts">
  import {
    activeTokens,
    botLoadErrorMessage,
    deleteBot as deleteBotIdentity,
    isServiceBot,
    listWorkspaceBots,
    listWorkspaceBotTokens,
    removeBotFromWorkspace,
    revokeBotToken,
    expandBotScopes,
    summarizeBotScopes,
    type BotToken,
    type BotWithTokens,
    type CreateBotResponse,
  } from "#lib/bots";
  import { APIError } from "#lib/api";
  import { isWorkspaceManager } from "#lib/permissions";
  import BotCreateForm, {
    type BotCreateDetail,
  } from "../../../../../../components/settings/bots/BotCreateForm.svelte";
  import BotTokenForm from "../../../../../../components/settings/bots/BotTokenForm.svelte";
  import TokenRevealPanel from "../../../../../../components/settings/bots/TokenRevealPanel.svelte";
  import { untrack } from "svelte";

  let { data } = $props();

  let bots = $state<BotWithTokens[]>(untrack(() => data.bots));
  let loadError = $state(untrack(() => data.loadError));
  let refreshing = $state(false);
  let showCreate = $state(false);
  let revealed = $state<{
    bot: BotWithTokens["bot"];
    connect: "code" | "token";
    token?: BotToken;
    tokenName?: string;
    scopes?: string[];
  } | null>(null);
  let expandedBotID = $state<string | null>(null);
  let mintingBotID = $state<string | null>(null);
  let mintingMode = $state<"token" | "code">("token");
  let pendingAction = $state<
    { botID: string; kind: "revoke" | "remove" | "delete" } | null
  >(null);
  let actionError = $state("");
  let scopesExpandedTokenID = $state<string | null>(null);

  function toggleScopeList(tokenID: string) {
    scopesExpandedTokenID = scopesExpandedTokenID === tokenID ? null : tokenID;
  }

  const me = $derived(data.me);
  const workspaceID = $derived(data.workspaceID);
  const workspaceIdentifier = $derived(data.workspaceIdentifier || data.workspaceID);
  const canManage = $derived(isWorkspaceManager(data.workspace?.role));
  const canCreateService = $derived(canManage);

  function ownerBadge(bot: BotWithTokens["bot"]): string {
    if (isServiceBot(bot)) return "服务机器人";
    if (me && bot.owner_user_id === me.id) return "归你所有";
    return `个人所有`;
  }

  function canRotate(bot: BotWithTokens["bot"]): boolean {
    if (isServiceBot(bot)) return canManage;
    return !!me && bot.owner_user_id === me.id;
  }

  function canRemove(): boolean {
    return canManage;
  }

  function canDelete(bot: BotWithTokens["bot"]): boolean {
    if (isServiceBot(bot)) return canManage;
    return !!me && bot.owner_user_id === me.id;
  }

  function toggleExpand(botID: string) {
    expandedBotID = expandedBotID === botID ? null : botID;
  }

  async function refresh() {
    refreshing = true;
    try {
      bots = await listWorkspaceBots(workspaceID);
      loadError = "";
    } catch (err) {
      loadError = botLoadErrorMessage(err);
    } finally {
      refreshing = false;
    }
  }

  async function refreshOneBotTokens(botID: string) {
    try {
      const tokens = await listWorkspaceBotTokens(workspaceID, botID);
      bots = bots.map((b) => (b.bot.id === botID ? { ...b, tokens } : b));
    } catch (err) {
      actionError = botLoadErrorMessage(err);
    }
  }

  function handleCreated(response: CreateBotResponse, detail: BotCreateDetail) {
    showCreate = false;
    revealed = {
      bot: response.bot,
      connect: detail.connect,
      token: response.bot_token,
      tokenName: detail.tokenName,
      scopes: detail.scopes,
    };
    bots = [
      { bot: response.bot, tokens: response.bot_token ? [response.bot_token] : [] },
      ...bots,
    ];
    expandedBotID = response.bot.id;
  }

  function startMinting(botID: string, mode: "token" | "code") {
    actionError = "";
    mintingBotID = botID;
    mintingMode = mode;
  }

  async function handleTokenCreated(bot: BotWithTokens["bot"], token: BotToken) {
    mintingBotID = null;
    revealed = { bot, connect: "token", token };
    await refreshOneBotTokens(bot.id);
  }

  function handleCodeRequested(bot: BotWithTokens["bot"], name: string, scopes: string[]) {
    mintingBotID = null;
    revealed = { bot, connect: "code", tokenName: name, scopes };
  }

  async function revokeOne(bot: BotWithTokens["bot"], token: BotToken) {
    if (!confirm(`撤销“${token.name || "令牌"}”？所有使用此令牌的连接将立即失效。`)) {
      return;
    }
    pendingAction = { botID: bot.id, kind: "revoke" };
    actionError = "";
    try {
      await revokeBotToken(token.id);
      await refreshOneBotTokens(bot.id);
    } catch (err) {
      actionError = botLoadErrorMessage(err);
    } finally {
      pendingAction = null;
    }
  }

  async function removeBot(bot: BotWithTokens["bot"]) {
    const message = `将 ${botLabel(bot)} 从此工作区移除？它在此工作区的令牌将被撤销。`;
    if (!confirm(message)) return;
    pendingAction = { botID: bot.id, kind: "remove" };
    actionError = "";
    try {
      await removeBotFromWorkspace(workspaceID, bot.id);
      bots = bots.filter((b) => b.bot.id !== bot.id);
      if (expandedBotID === bot.id) expandedBotID = null;
    } catch (err) {
      actionError = botLoadErrorMessage(err);
    } finally {
      pendingAction = null;
    }
  }

  async function deleteBotEverywhere(bot: BotWithTokens["bot"]) {
    const label = botLabel(bot);
    const release = bot.handle ? `，并释放 ${formatHandle(bot.handle)} 以供再次使用` : "";
    const message = `在所有工作区中删除 ${label}？此操作会永久停用该机器人身份，并撤销它在所有工作区中的全部令牌和集成${release}。现有消息会保留原身份，并标记为已删除。`;
    if (!confirm(message)) return;
    pendingAction = { botID: bot.id, kind: "delete" };
    actionError = "";
    try {
      await deleteBotIdentity(bot.id);
      bots = bots.filter((entry) => entry.bot.id !== bot.id);
      if (expandedBotID === bot.id) expandedBotID = null;
      if (revealed?.bot.id === bot.id) revealed = null;
    } catch (err) {
      actionError =
        err instanceof APIError && err.status === 403 ? err.message : botLoadErrorMessage(err);
    } finally {
      pendingAction = null;
    }
  }

  function formatDate(value: string | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
  }

  function formatHandle(handle: string): string {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  function botLabel(bot: BotWithTokens["bot"]): string {
    return bot.handle ? formatHandle(bot.handle) : bot.display_name || "此机器人";
  }

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  const countLabel = $derived(`${bots.length} 个机器人`);
</script>

<div class="ws-bots-page">
  <header class="ws-page__header">
    <h1 class="ws-page__h1">机器人与智能体</h1>
    <p class="ws-page__lead">
      机器人是通过令牌认证的工作区成员。将令牌配置到 OpenClaw，即可让智能体接入此工作区。
    </p>
  </header>

  <div class="ws-bots__toolbar">
    <div class="ws-bots__count">{countLabel}</div>
    <div class="ws-bots__toolbar-actions">
      <button
        type="button"
        class="ws-btn"
        onclick={refresh}
        disabled={refreshing}
        title="刷新"
      >
        {refreshing ? "正在刷新…" : "刷新"}
      </button>
      {#if me}
        <button
          type="button"
          class="ws-btn ws-btn--primary"
          onclick={() => {
            showCreate = true;
            revealed = null;
          }}
          disabled={showCreate}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          添加机器人
        </button>
      {/if}
    </div>
  </div>

  {#if loadError}
    <div class="ws-settings__error">{loadError}</div>
  {/if}

  {#if revealed && me}
    {#key revealed}
      <TokenRevealPanel
        connect={revealed.connect}
        token={revealed.token}
        workspaceID={workspaceID}
        tokenName={revealed.tokenName}
        scopes={revealed.scopes}
        botHandle={revealed.bot.handle}
        botUserID={revealed.bot.id}
        workspace={workspaceIdentifier}
        onDismiss={() => {
          const botID = revealed?.bot.id;
          const wasCode = revealed?.connect === "code";
          revealed = null;
          // A claimed code mints a token in the background; refresh so the
          // row's token count reflects reality.
          if (wasCode && botID) void refreshOneBotTokens(botID);
        }}
      />
    {/key}
  {/if}

  {#if showCreate && me}
    <div class="ws-bots__panel">
      <BotCreateForm
        workspaceID={workspaceID}
        currentUserID={me.id}
        {canCreateService}
        onCreated={handleCreated}
        onCancel={() => (showCreate = false)}
      />
    </div>
  {/if}

  {#if actionError}
    <div class="ws-settings__error">{actionError}</div>
  {/if}

  {#if bots.length === 0 && !loadError}
    <div class="ws-bots__empty">
      暂无机器人。添加机器人，将智能体接入此工作区。
    </div>
  {:else}
    <div class="ws-bots__list">
      {#each bots as entry (entry.bot.id)}
        {@const bot = entry.bot}
        {@const tokens = activeTokens(entry.tokens)}
        {@const expanded = expandedBotID === bot.id}
        {@const acting = pendingAction?.botID === bot.id}
        {@const minting = mintingBotID === bot.id}
        <div class="ws-bots__row" class:is-expanded={expanded}>
          <button
            type="button"
            class="ws-bots__row-main"
            aria-expanded={expanded}
            onclick={() => toggleExpand(bot.id)}
          >
            <span
              class="ws-members__avatar ws-members__avatar--{isServiceBot(bot) ? 'human' : 'bot'}"
              aria-hidden="true"
            >
              {#if bot.avatar_url}
                <img src={bot.avatar_url} alt="" />
              {:else}
                {initials(bot.display_name || bot.handle || "?")}
              {/if}
            </span>
            <div class="ws-bots__row-text">
              <div class="ws-bots__row-name">{bot.display_name || bot.handle}</div>
              <div class="ws-bots__row-meta">
                {#if bot.handle}
                  <code class="ws-members__handle">{formatHandle(bot.handle)}</code>
                  <span class="ws-members__dot" aria-hidden="true">·</span>
                {/if}
                <span>创建于 {formatDate(bot.created_at)}</span>
                <span class="ws-members__dot" aria-hidden="true">·</span>
                <span>{tokens.length} 个有效令牌</span>
              </div>
            </div>
            <span class="ws-bots__owner-pill ws-bots__owner-pill--{isServiceBot(bot) ? 'service' : 'user'}">
              {ownerBadge(bot)}
            </span>
            <span class="ws-bots__chevron" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points={expanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
              </svg>
            </span>
          </button>

          {#if expanded}
            <div class="ws-bots__detail">
              <div class="ws-bots__detail-header">
                <div>
                  <h4 class="ws-bots__detail-title">令牌</h4>
                  <p class="ws-bots__detail-hint">
                    每个令牌用于验证一个 OpenClaw 进程。更换可生成新令牌，撤销则会断开所有使用该令牌的连接。
                  </p>
                </div>
                <div class="ws-bots__detail-actions">
                  {#if canRotate(bot)}
                    <button
                      type="button"
                      class="ws-btn"
                      onclick={() => startMinting(bot.id, "code")}
                      disabled={acting || minting}
                    >
                      新建设置码
                    </button>
                    <button
                      type="button"
                      class="ws-btn"
                      onclick={() => startMinting(bot.id, "token")}
                      disabled={acting || minting}
                    >
                      生成新令牌
                    </button>
                  {/if}
                  {#if canRemove()}
                    <button
                      type="button"
                      class="ws-btn ws-btn--danger"
                      onclick={() => removeBot(bot)}
                      disabled={acting}
                    >
                      {acting && pendingAction?.kind === "remove"
                        ? "正在移除…"
                        : "从工作区移除"}
                    </button>
                  {/if}
                  {#if canDelete(bot)}
                    <button
                      type="button"
                      class="ws-btn ws-btn--danger"
                      onclick={() => deleteBotEverywhere(bot)}
                      disabled={acting}
                    >
                      {acting && pendingAction?.kind === "delete" ? "正在删除…" : "删除机器人"}
                    </button>
                  {/if}
                </div>
              </div>

              {#if minting}
                <div class="ws-bots__token-form-panel">
                  <BotTokenForm
                    {workspaceID}
                    botUserID={bot.id}
                    mode={mintingMode}
                    onCreated={(token) => handleTokenCreated(bot, token)}
                    onCode={(name, scopes) => handleCodeRequested(bot, name, scopes)}
                    onCancel={() => (mintingBotID = null)}
                  />
                </div>
              {/if}

              {#if tokens.length === 0}
                <p class="ws-bots__detail-empty">没有有效令牌。生成令牌后即可让机器人上线。</p>
              {:else}
                <ul class="ws-bots__token-list">
                  {#each tokens as token (token.id)}
                    <li class="ws-bots__token-row">
                      <div class="ws-bots__token-main">
                        <div class="ws-bots__token-name">{token.name || "令牌"}</div>
                        <div class="ws-bots__token-meta">
                          创建于 {formatDate(token.created_at)}
                          {#if token.last_used_at}
                            · 上次使用于 {formatDate(token.last_used_at)}
                          {/if}
                        </div>
                        {#if token.scopes?.length}
                          {@const summary = summarizeBotScopes(token.scopes)}
                          {@const fullScopes = expandBotScopes(token.scopes)}
                          <div class="ws-bots__scope-row">
                            {#if summary.bundleLabel}
                              <span class="ws-bots__scope-chip ws-bots__scope-chip--bundle">
                                {summary.bundleLabel}
                              </span>
                            {/if}
                            {#each summary.extras as scope (scope)}
                              <span class="ws-bots__scope-chip">{scope}</span>
                            {/each}
                            {#if summary.bundle}
                              <button
                                type="button"
                                class="ws-bots__scope-toggle"
                                aria-expanded={scopesExpandedTokenID === token.id}
                                aria-controls="ws-bots-scopes-{token.id}"
                                onclick={() => toggleScopeList(token.id)}
                              >
                                {scopesExpandedTokenID === token.id
                                  ? "隐藏权限范围"
                                  : `全部 ${fullScopes.length} 项权限`}
                              </button>
                            {/if}
                          </div>
                          {#if summary.bundle && scopesExpandedTokenID === token.id}
                            <div class="ws-bots__scope-row" id="ws-bots-scopes-{token.id}">
                              {#each fullScopes as scope (scope)}
                                <span class="ws-bots__scope-chip">{scope}</span>
                              {/each}
                            </div>
                          {/if}
                        {/if}
                      </div>
                      {#if canRotate(bot)}
                        <button
                          type="button"
                          class="ws-btn ws-btn--danger"
                          onclick={() => revokeOne(bot, token)}
                          disabled={acting}
                        >
                          撤销
                        </button>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
