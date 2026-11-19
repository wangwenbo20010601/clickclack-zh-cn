<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { APIError } from "../../../lib/api";
  import { channelDisplayTitle } from "../../../lib/chat/channels";
  import {
    BOT_SCOPE_BUNDLES,
    activeTokens,
    botLoadErrorMessage,
    createWorkspaceBot,
    createWorkspaceBotToken,
    isServiceBot,
    suggestHandleFrom,
    type BotScopeBundle,
    type BotToken,
    type BotWithTokens,
  } from "../../../lib/bots";
  import {
    createAppInstallation,
    integrationsLoadErrorMessage,
    type AppInstallation,
  } from "../../../lib/integrations";
  import { AGENT_ACTIVITY_SCOPE, APP_CATALOG, type AppManifest } from "../../../lib/app-catalog";
  import {
    listWorkspaceMembersPage,
    type WorkspaceMember,
  } from "../../../lib/workspace-members";
  import type { Channel, User } from "../../../lib/types";
  import TokenRevealPanel from "../bots/TokenRevealPanel.svelte";

  type Props = {
    workspaceID: string;
    workspaceIdentifier: string;
    currentUserID: string;
    bots: BotWithTokens[];
    boundBotIDs: Set<string>;
    channels: Channel[];
    onInstalled: (installation: AppInstallation, bot: User, token?: BotToken) => void;
    onBotTokensChanged: (botID: string) => void;
    onClose: () => void;
  };

  let {
    workspaceID,
    workspaceIdentifier,
    currentUserID,
    bots,
    boundBotIDs,
    channels,
    onInstalled,
    onBotTokensChanged,
    onClose,
  }: Props = $props();

  type Step = "app" | "bot" | "config" | "reveal";

  let step = $state<Step>("app");
  let manifest = $state<AppManifest | null>(null);

  // Bot step
  let botMode = $state<"create" | "existing">("create");
  let connect = $state<"code" | "token">("code");
  let displayName = $state("");
  let handle = $state("");
  let handleEdited = $state(false);
  let ownership = $state<"service" | "user">("service");
  let tokenName = $state("default");
  let scopeBundle = $state<BotScopeBundle>("bot:write");
  let existingBotID = $state("");

  // Config step (manifest-driven)
  let defaultChannel = $state("");
  let allowMode = $state<"everyone" | "specific">("everyone");
  let allowMembers = $state<{ id: string; label: string }[]>([]);
  let memberQuery = $state("");
  let memberResults = $state<WorkspaceMember[]>([]);
  let memberSearchTimer: ReturnType<typeof setTimeout> | null = null;
  let memberSearchGeneration = 0;
  let agentActivity = $state(false);

  let submitting = $state(false);
  let error = $state("");

  // Set when bot/token creation succeeded but the installation call failed,
  // so retrying doesn't create a second bot or token.
  let createdBot = $state<User | null>(null);
  let createdToken = $state<BotToken | null>(null);
  let result = $state<{ installation: AppInstallation; bot: User; token: BotToken | null } | null>(
    null,
  );
  let credentialsAttempted = $state(false);
  let botSetupNonce = $state(crypto.randomUUID());
  let installationSetupNonce = $state(crypto.randomUUID());
  const hasPartialCredentials = $derived(
    !!createdBot && (connect === "code" || !!createdToken),
  );
  const credentialsLocked = $derived(credentialsAttempted || hasPartialCredentials);

  const availableBots = $derived(
    bots.filter(
      (entry) =>
        !boundBotIDs.has(entry.bot.id) &&
        (isServiceBot(entry.bot) || entry.bot.owner_user_id === currentUserID),
    ),
  );

  const activeChannels = $derived(channels.filter((channel) => !channel.archived_at));
  const channelNames = $derived(activeChannels.map((channel) => channel.name).filter(Boolean));

  $effect(() => {
    if (!handleEdited) {
      handle = suggestHandleFrom(displayName);
    }
  });

  $effect(() => {
    if (!credentialsLocked && !channelNames.includes(defaultChannel)) {
      defaultChannel = channelNames[0] ?? "";
    }
  });

  function pickManifest(next: AppManifest) {
    if (memberSearchTimer) clearTimeout(memberSearchTimer);
    memberSearchTimer = null;
    memberSearchGeneration += 1;
    manifest = next;
    botMode = "create";
    // Only manifests with a code snippet (OpenClaw) support the setup-code
    // connect path; everything else stays token-only.
    connect = next.buildCodeSnippet ? "code" : "token";
    displayName = "";
    handle = "";
    handleEdited = false;
    ownership = "service";
    tokenName = "default";
    scopeBundle = next.suggestedScopeBundle;
    existingBotID = "";
    defaultChannel = untrack(() => channelNames[0] ?? "");
    allowMode = "everyone";
    allowMembers = [];
    memberQuery = "";
    memberResults = [];
    agentActivity = false;
    createdBot = null;
    createdToken = null;
    credentialsAttempted = false;
    botSetupNonce = crypto.randomUUID();
    installationSetupNonce = crypto.randomUUID();
    result = null;
    error = "";
    step = "bot";
  }

  function onHandleInput(event: Event) {
    handleEdited = true;
    handle = (event.target as HTMLInputElement).value;
  }

  const hasConfigStep = $derived((manifest?.configFields.length ?? 0) > 0);

  const botStepValid = $derived(
    botMode === "create"
      ? displayName.trim().length > 0 && handle.trim().length > 0 && tokenName.trim().length > 0
      : existingBotID.length > 0 && tokenName.trim().length > 0,
  );

  function advanceFromBot() {
    if (!botStepValid) return;
    error = "";
    if (hasConfigStep) {
      step = "config";
    } else {
      void submit();
    }
  }

  function onMemberQueryInput(event: Event) {
    memberQuery = (event.target as HTMLInputElement).value;
    if (memberSearchTimer) clearTimeout(memberSearchTimer);
    const generation = ++memberSearchGeneration;
    const query = memberQuery.trim();
    if (!query) {
      memberResults = [];
      return;
    }
    memberSearchTimer = setTimeout(async () => {
      try {
        const page = await listWorkspaceMembersPage({ workspaceID, query, limit: 8 });
        if (generation !== memberSearchGeneration) return;
        const chosen = new Set(allowMembers.map((m) => m.id));
        memberResults = page.members.filter(
          (member) => member.user.kind === "human" && !chosen.has(member.user.id),
        );
      } catch {
        if (generation !== memberSearchGeneration) return;
        memberResults = [];
      }
    }, 250);
  }

  function addAllowMember(member: WorkspaceMember) {
    allowMembers = [
      ...allowMembers,
      {
        id: member.user.id,
        label: member.user.display_name || member.user.handle || member.user.id,
      },
    ];
    memberQuery = "";
    memberResults = [];
  }

  function removeAllowMember(id: string) {
    allowMembers = allowMembers.filter((member) => member.id !== id);
  }

  const requiresDefaultChannel = $derived(
    manifest?.configFields.some((field) => field.id === "default_channel") ?? false,
  );
  const configStepValid = $derived(
    (!requiresDefaultChannel || defaultChannel.length > 0) &&
      (allowMode === "everyone" || allowMembers.length > 0),
  );

  const allowFromValue = $derived.by(() => {
    if (allowMode === "everyone") return ["*"];
    return allowMembers.map((member) => member.id);
  });

  const defaultToValue = $derived(`channel:${defaultChannel}`);

  const revealScopes = $derived.by(() => {
    const scopes = [scopeBundle as string];
    if (agentActivity) scopes.push(AGENT_ACTIVITY_SCOPE);
    return scopes;
  });

  async function submit() {
    if (!manifest || submitting || (hasConfigStep && !configStepValid)) return;
    submitting = true;
    error = "";
    try {
      let bot = createdBot;
      let token = createdToken;
      const needsToken = connect === "token";
      if (!bot || (needsToken && !token)) {
        credentialsAttempted = true;
        const scopes = [scopeBundle as string];
        if (agentActivity) scopes.push(AGENT_ACTIVITY_SCOPE);
        if (botMode === "create") {
          const response = await createWorkspaceBot(workspaceID, {
            display_name: displayName.trim(),
            handle: handle.trim(),
            owner_user_id: ownership === "user" ? currentUserID : undefined,
            // Code mode: no credential at creation — the setup code shown on
            // the reveal step mints the token when OpenClaw claims it.
            ...(needsToken
              ? {
                  token_name: tokenName.trim() || "default",
                  scopes,
                  setup_nonce: botSetupNonce,
                }
              : { initial_token: false, setup_nonce: botSetupNonce }),
          });
          bot = response.bot;
          token = response.bot_token ?? null;
        } else {
          const entry = availableBots.find((candidate) => candidate.bot.id === existingBotID);
          if (!entry) throw new Error("请选择要绑定此应用的机器人。");
          bot = entry.bot;
          if (needsToken) {
            token = await createWorkspaceBotToken(workspaceID, entry.bot.id, {
              name: tokenName.trim() || "default",
              scopes,
              setup_nonce: botSetupNonce,
            });
          }
        }
        createdBot = bot;
        createdToken = token;
      }

      const config: Record<string, unknown> = {};
      if (hasConfigStep) {
        config.default_to = defaultToValue;
        config.allow_from = allowFromValue;
        config.agent_activity = agentActivity;
      }
      const installation = await createAppInstallation(workspaceID, {
        app_slug: manifest.slug,
        display_name: bot.display_name || manifest.name,
        bot_user_id: bot.id,
        config,
        setup_nonce: installationSetupNonce,
      });
      result = { installation, bot, token };
      step = "reveal";
      onInstalled(installation, bot, token ?? undefined);
    } catch (err) {
      const credentialRequestWasRejected =
        !createdBot && err instanceof APIError && err.status >= 400 && err.status < 500;
      if (credentialRequestWasRejected) {
        credentialsAttempted = false;
        botSetupNonce = crypto.randomUUID();
      }
      error = createdBot
        ? `${integrationsLoadErrorMessage(err)} 机器人已就绪，重试会复用该机器人和同一安装请求。`
        : credentialsAttempted && connect === "token"
          ? `${botLoadErrorMessage(err)} 重试会复用同一机器人和令牌记录。`
          : botLoadErrorMessage(err);
    } finally {
      submitting = false;
    }
  }

  function back() {
    error = "";
    if (step === "config") step = "bot";
    else if (step === "bot") step = "app";
  }

  const stepIndex = $derived(step === "app" ? 1 : step === "bot" ? 2 : step === "config" ? 3 : 4);
  const stepCount = $derived(hasConfigStep || step === "app" ? 4 : 3);

  onDestroy(() => {
    if (memberSearchTimer) clearTimeout(memberSearchTimer);
    memberSearchGeneration += 1;
  });
</script>

<section class="ws-intg__wizard" aria-label="添加应用">
  <header class="ws-intg__wizard-header">
    <div>
      <h3 class="ws-bots__form-title">
        {#if manifest && step !== "app"}安装 {manifest.name}{:else}添加应用{/if}
      </h3>
      <p class="ws-bots__form-hint">
        {#if step === "app"}
          选择要连接的应用。应用将在此工作区获得机器人身份，并使用令牌接入。
        {:else if step === "bot"}
          机器人代表应用在此工作区中的身份，包括名称、头像和用于身份验证的令牌。
        {:else if step === "config"}
          设置智能体在此工作区中的行为。这些选项会生成需要粘贴到平台中的配置。
        {:else}
          {#if result?.token}
            应用已安装。请复制下方令牌和设置，原始令牌仅显示这一次。
          {:else}
            应用已安装。运行下方设置命令即可连接，一次性设置码会生成机器人令牌。
          {/if}
        {/if}
      </p>
    </div>
    <span class="ws-intg__wizard-step">第 {stepIndex} 步，共 {stepCount} 步</span>
  </header>

  {#if step === "app"}
    <div class="ws-intg__catalog">
      {#each APP_CATALOG as entry (entry.slug)}
        <button type="button" class="ws-intg__catalog-card" onclick={() => pickManifest(entry)}>
          <span class="ws-intg__app-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              {#each entry.icon as path (path)}
                <path d={path} />
              {/each}
            </svg>
          </span>
          <span class="ws-intg__catalog-name">{entry.name}</span>
          <span class="ws-intg__catalog-desc">{entry.description}</span>
        </button>
      {/each}
    </div>
    <div class="ws-bots__form-actions">
      <button type="button" class="ws-btn" onclick={onClose}>取消</button>
    </div>
  {:else if step === "bot"}
    <form
      class="ws-intg__wizard-body"
      onsubmit={(event) => {
        event.preventDefault();
        advanceFromBot();
      }}
    >
      <fieldset class="ws-bots__form-field" disabled={credentialsLocked}>
        <legend class="ws-bots__form-label">机器人身份</legend>
        <div class="ws-bots__choices">
          <label class="ws-bots__choice" class:is-active={botMode === "create"}>
            <input type="radio" name="intg-bot-mode" value="create" bind:group={botMode} />
            <span class="ws-bots__choice-title">创建新机器人</span>
            <span class="ws-bots__choice-hint">推荐。为此应用创建专属身份。</span>
          </label>
          <label
            class="ws-bots__choice"
            class:is-active={botMode === "existing"}
            class:is-disabled={availableBots.length === 0}
          >
            <input
              type="radio"
              name="intg-bot-mode"
              value="existing"
              bind:group={botMode}
              disabled={availableBots.length === 0}
            />
            <span class="ws-bots__choice-title">使用现有机器人</span>
            <span class="ws-bots__choice-hint">
              {availableBots.length === 0
                ? "此工作区没有未绑定的机器人。"
                : "绑定尚未关联其他应用的机器人，并为其生成新令牌。"}
            </span>
          </label>
        </div>
      </fieldset>

      {#if botMode === "create"}
        <div class="ws-bots__form-grid">
          <label class="ws-bots__form-field">
            <span class="ws-bots__form-label">显示名称</span>
            <input
              class="ws-bots__form-input"
              type="text"
              bind:value={displayName}
              placeholder={manifest?.suggestedBotName || "我的应用"}
              maxlength="80"
              required
              disabled={credentialsLocked}
            />
          </label>
          <label class="ws-bots__form-field">
            <span class="ws-bots__form-label">用户名</span>
            <div class="ws-bots__form-handle">
              <span aria-hidden="true">@</span>
              <input
                class="ws-bots__form-input"
                type="text"
                value={handle}
                oninput={onHandleInput}
                placeholder={manifest?.suggestedBotHandle || "my-app"}
                required
                disabled={credentialsLocked}
              />
            </div>
          </label>
        </div>

        <fieldset class="ws-bots__form-field" disabled={credentialsLocked}>
          <legend class="ws-bots__form-label">归属</legend>
          <div class="ws-bots__choices">
            <label class="ws-bots__choice" class:is-active={ownership === "service"}>
              <input type="radio" name="intg-ownership" value="service" bind:group={ownership} />
              <span class="ws-bots__choice-title">服务机器人</span>
              <span class="ws-bots__choice-hint">
                归工作区所有。所有者和管理员均可更换其令牌。
              </span>
            </label>
            <label class="ws-bots__choice" class:is-active={ownership === "user"}>
              <input type="radio" name="intg-ownership" value="user" bind:group={ownership} />
              <span class="ws-bots__choice-title">个人机器人</span>
              <span class="ws-bots__choice-hint">
                归你所有。仅你可以更换或撤销其令牌。
              </span>
            </label>
          </div>
        </fieldset>
      {:else}
        <label class="ws-bots__form-field">
          <span class="ws-bots__form-label">机器人</span>
          <select
            class="ws-bots__form-input"
            bind:value={existingBotID}
            required
            disabled={credentialsLocked}
          >
            <option value="" disabled>选择机器人…</option>
            {#each availableBots as entry (entry.bot.id)}
              <option value={entry.bot.id}>
                {entry.bot.display_name || entry.bot.handle} (@{entry.bot.handle})
                {isServiceBot(entry.bot) ? " · 服务机器人" : " · 个人所有"}
                · {activeTokens(entry.tokens).length} 个有效令牌
              </option>
            {/each}
          </select>
        </label>
      {/if}

      {#if manifest?.buildCodeSnippet}
        <fieldset class="ws-bots__form-field" disabled={credentialsLocked}>
          <legend class="ws-bots__form-label">选择连接方式</legend>
          <div class="ws-bots__choices">
            <label class="ws-bots__choice" class:is-active={connect === "code"}>
              <input type="radio" name="intg-connect" value="code" bind:group={connect} />
              <span class="ws-bots__choice-title">设置码（推荐）</span>
              <span class="ws-bots__choice-hint">
                在运行 OpenClaw 的机器上执行一条命令。一次性设置码会直接在那里生成令牌，无需手动复制。
              </span>
            </label>
            <label class="ws-bots__choice" class:is-active={connect === "token"}>
              <input type="radio" name="intg-connect" value="token" bind:group={connect} />
              <span class="ws-bots__choice-title">手动配置令牌</span>
              <span class="ws-bots__choice-hint">
                立即生成原始令牌并自行配置，适用于手动编写配置或其他客户端。
              </span>
            </label>
          </div>
        </fieldset>
      {/if}

      <fieldset class="ws-bots__form-field" disabled={credentialsLocked}>
        <legend class="ws-bots__form-label">令牌权限范围</legend>
        <div class="ws-bots__choices">
          {#each BOT_SCOPE_BUNDLES as bundle (bundle.id)}
            <label class="ws-bots__choice" class:is-active={scopeBundle === bundle.id}>
              <input type="radio" name="intg-scope" value={bundle.id} bind:group={scopeBundle} />
              <span class="ws-bots__choice-title">{bundle.label}</span>
              <span class="ws-bots__choice-hint">{bundle.hint}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <label class="ws-bots__form-field">
        <span class="ws-bots__form-label">令牌名称</span>
        <input
          class="ws-bots__form-input"
          type="text"
          bind:value={tokenName}
          placeholder="production"
          maxlength="80"
          required
          disabled={credentialsLocked}
        />
      </label>

      {#if error}
        <p class="ws-bots__form-error" role="alert">{error}</p>
      {/if}

      <div class="ws-bots__form-actions">
        <button
          type="button"
          class="ws-btn"
          onclick={back}
          disabled={submitting || credentialsLocked}
        >
          返回
        </button>
        <button
          type="submit"
          class="ws-btn ws-btn--primary"
          disabled={!botStepValid || submitting}
        >
          {hasConfigStep ? "继续" : submitting ? "正在安装…" : "安装"}
        </button>
      </div>
    </form>
  {:else if step === "config" && manifest}
    <form
      class="ws-intg__wizard-body"
      onsubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label class="ws-bots__form-field">
        <span class="ws-bots__form-label">默认频道</span>
        <select
          class="ws-bots__form-input"
          bind:value={defaultChannel}
          disabled={credentialsLocked || channelNames.length === 0}
        >
          {#each activeChannels as channel (channel.id)}
            <option value={channel.name}>#{channelDisplayTitle(channel)}</option>
          {/each}
        </select>
        <span class="ws-bots__form-hint">
          {channelNames.length === 0
            ? "请先创建或恢复频道，再安装此应用。"
            : "未指定目标时，智能体会向此频道发送消息。"}
        </span>
      </label>

      <fieldset class="ws-bots__form-field" disabled={credentialsLocked}>
        <legend class="ws-bots__form-label">谁可以与此智能体对话</legend>
        <div class="ws-bots__choices">
          <label class="ws-bots__choice" class:is-active={allowMode === "everyone"}>
            <input type="radio" name="intg-allow" value="everyone" bind:group={allowMode} />
            <span class="ws-bots__choice-title">工作区中的所有人</span>
            <span class="ws-bots__choice-hint">所有成员均可向智能体发消息或提及它。</span>
          </label>
          <label class="ws-bots__choice" class:is-active={allowMode === "specific"}>
            <input type="radio" name="intg-allow" value="specific" bind:group={allowMode} />
            <span class="ws-bots__choice-title">仅指定成员</span>
            <span class="ws-bots__choice-hint">
              智能体会忽略其他人，由平台的 allowFrom 列表控制。
            </span>
          </label>
        </div>
      </fieldset>

      {#if allowMode === "specific"}
        <div class="ws-bots__form-field">
          <span class="ws-bots__form-label">允许的成员</span>
          {#if allowMembers.length > 0}
            <div class="ws-intg__chips">
              {#each allowMembers as member (member.id)}
                <span class="ws-intg__chip">
                  {member.label}
                  <button
                    type="button"
                    class="ws-intg__chip-remove"
                    aria-label={`移除 ${member.label}`}
                    onclick={() => removeAllowMember(member.id)}
                    disabled={credentialsLocked}
                  >
                    ×
                  </button>
                </span>
              {/each}
            </div>
          {/if}
          <input
            class="ws-bots__form-input"
            type="search"
            placeholder="按姓名或用户名搜索成员"
            value={memberQuery}
            oninput={onMemberQueryInput}
            disabled={credentialsLocked}
          />
          {#if memberResults.length > 0}
            <ul class="ws-intg__member-results">
              {#each memberResults as member (member.user.id)}
                <li>
                  <button
                    type="button"
                    class="ws-intg__member-result"
                    onclick={() => addAllowMember(member)}
                    disabled={credentialsLocked}
                  >
                    {member.user.display_name || member.user.handle}
                    <code class="ws-members__handle">@{member.user.handle}</code>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}

      <label class="ws-bots__form-field ws-intg__toggle">
        <input type="checkbox" bind:checked={agentActivity} disabled={credentialsLocked} />
        <span>
          <span class="ws-bots__choice-title">实时显示智能体活动</span>
          <span class="ws-bots__choice-hint">
            智能体工作时，在对话中显示其思考和工具执行进度。此选项会授予
            <code>agent_activity:write</code> 令牌权限。
          </span>
        </span>
      </label>

      {#if error}
        <p class="ws-bots__form-error" role="alert">{error}</p>
      {/if}

      <div class="ws-bots__form-actions">
        <button
          type="button"
          class="ws-btn"
          onclick={back}
          disabled={submitting || credentialsLocked}
        >
          返回
        </button>
        <button
          type="submit"
          class="ws-btn ws-btn--primary"
          disabled={!configStepValid || submitting}
        >
          {submitting ? "正在安装…" : credentialsAttempted ? "重试安装" : "安装"}
        </button>
      </div>
    </form>
  {:else if step === "reveal" && result && manifest}
    <TokenRevealPanel
      connect={result.token ? "token" : "code"}
      token={result.token}
      {workspaceID}
      tokenName={tokenName.trim() || "default"}
      scopes={revealScopes}
      botHandle={result.bot.handle}
      botUserID={result.bot.id}
      workspace={workspaceIdentifier}
      defaultTo={hasConfigStep ? defaultToValue : undefined}
      allowFrom={hasConfigStep ? allowFromValue : undefined}
      agentActivity={hasConfigStep ? agentActivity : undefined}
      configSnippetBuilder={manifest.buildConfigSnippet}
      shellSnippetBuilder={manifest.buildShellSnippet}
      codeSnippetBuilder={manifest.buildCodeSnippet}
      onDismiss={() => {
        if (!result?.token) onBotTokensChanged(result.bot.id);
        onClose();
      }}
    />
  {/if}
</section>
