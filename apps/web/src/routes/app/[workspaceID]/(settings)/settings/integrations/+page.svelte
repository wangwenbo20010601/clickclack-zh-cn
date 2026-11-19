<script lang="ts">
  import { untrack } from "svelte";
  import { api, APIError } from "#lib/api";
  import { requestCurrentUser } from "#lib/appearance";
  import {
    activeOnly,
    attachedTo,
    integrationsLoadErrorMessage,
    listAppInstallations,
    listConnectedAccounts,
    listEventSubscriptions,
    listEventTypes,
    listSlashCommands,
    revokeAppInstallation,
    revokeConnectedAccount,
    unattached,
    type AppInstallation,
    type ConnectedAccount,
    type EventSubscription,
    type SlashCommand,
  } from "#lib/integrations";
  import {
    isServiceBot,
    listWorkspaceBots,
    listWorkspaceBotTokens,
    type BotToken,
    type BotWithTokens,
  } from "#lib/bots";
  import { manifestForInstallation } from "#lib/app-catalog";
  import { isWorkspaceManager } from "#lib/permissions";
  import type { Channel, User } from "#lib/types";
  import InstallWizard from "../../../../../../components/settings/integrations/InstallWizard.svelte";
  import SlashCommandsPanel from "../../../../../../components/settings/integrations/SlashCommandsPanel.svelte";
  import EventSubscriptionsPanel from "../../../../../../components/settings/integrations/EventSubscriptionsPanel.svelte";

  let { data } = $props();

  let installations = $state<AppInstallation[]>(untrack(() => data.installations));
  let commands = $state<SlashCommand[]>(untrack(() => data.commands));
  let subscriptions = $state<EventSubscription[]>(untrack(() => data.subscriptions));
  let connectedAccounts = $state<ConnectedAccount[]>(untrack(() => data.connectedAccounts));
  let bots = $state<BotWithTokens[]>(untrack(() => data.bots));
  let channels = $state<Channel[]>(untrack(() => data.channels));
  let eventTypes = $state<string[]>(untrack(() => data.eventTypes));
  let me = $state<User | null>(untrack(() => data.me));
  let loaded = $state({ ...untrack(() => data.loaded) });
  let loadError = $state(untrack(() => data.loadError));
  let refreshing = $state(false);
  let refreshGeneration = 0;
  let mutationRevision = 0;
  let showWizard = $state(false);
  let expandedID = $state("");
  let actionError = $state("");
  // Cascade-revoke confirm state for one installation at a time.
  let revokePending = $state<{
    installation: AppInstallation;
    revokeTokens: boolean;
    deleteBot: boolean;
  } | null>(null);
  let revoking = $state(false);
  let accountBusyIDs = $state<Set<string>>(new Set());

  const workspaceID = $derived(data.workspaceID);
  const workspaceIdentifier = $derived(data.workspaceIdentifier || data.workspaceID);
  const canManage = $derived(isWorkspaceManager(data.workspace?.role));
  const canAssessRevoke = $derived(loaded.commands && loaded.subscriptions && loaded.bots);

  const activeInstallations = $derived(activeOnly(installations));
  const activeCommands = $derived(activeOnly(commands));
  const activeSubscriptions = $derived(activeOnly(subscriptions));
  const unattachedCommands = $derived(unattached(activeCommands));
  const unattachedSubscriptions = $derived(unattached(activeSubscriptions));
  const boundBotIDs = $derived(
    new Set(activeInstallations.map((installation) => installation.bot_user_id)),
  );

  const countLabel = $derived(
    `已安装 ${activeInstallations.length} 个应用`,
  );

  function botFor(installation: AppInstallation) {
    return bots.find((entry) => entry.bot.id === installation.bot_user_id)?.bot;
  }

  function botLabel(bot: User): string {
    return bot.handle ? `@${bot.handle}` : bot.display_name || "此机器人";
  }

  function settledErrors(results: PromiseSettledResult<unknown>[]): string {
    const messages = results
      .filter((result): result is PromiseRejectedResult => result.status === "rejected")
      .map((result) => integrationsLoadErrorMessage(result.reason));
    return messages.length > 0
      ? `部分集成数据无法加载。${[...new Set(messages)].join(" ")}`
      : "";
  }

  async function refresh() {
    const generation = ++refreshGeneration;
    const revision = mutationRevision;
    refreshing = true;
    try {
      const [
        installationsResult,
        commandsResult,
        subscriptionsResult,
        accountsResult,
        botsResult,
        channelsResult,
        eventTypesResult,
        meResult,
      ] = await Promise.allSettled([
          listAppInstallations(workspaceID),
          listSlashCommands(workspaceID),
          listEventSubscriptions(workspaceID),
          listConnectedAccounts(workspaceID),
          listWorkspaceBots(workspaceID),
          api<{ channels: Channel[] }>(`/api/workspaces/${workspaceID}/channels`),
          listEventTypes(),
          requestCurrentUser(),
        ]);

      if (generation !== refreshGeneration || revision !== mutationRevision) return;
      if (installationsResult.status === "fulfilled") installations = installationsResult.value;
      if (commandsResult.status === "fulfilled") commands = commandsResult.value;
      if (subscriptionsResult.status === "fulfilled") subscriptions = subscriptionsResult.value;
      if (accountsResult.status === "fulfilled") connectedAccounts = accountsResult.value;
      if (botsResult.status === "fulfilled") bots = botsResult.value;
      if (channelsResult.status === "fulfilled") channels = channelsResult.value.channels ?? [];
      if (eventTypesResult.status === "fulfilled") eventTypes = eventTypesResult.value;
      if (meResult.status === "fulfilled") {
        me = meResult.value.user;
      }
      loaded = {
        installations: loaded.installations || installationsResult.status === "fulfilled",
        commands: loaded.commands || commandsResult.status === "fulfilled",
        subscriptions: loaded.subscriptions || subscriptionsResult.status === "fulfilled",
        connectedAccounts:
          loaded.connectedAccounts || accountsResult.status === "fulfilled",
        bots: loaded.bots || botsResult.status === "fulfilled",
        channels: loaded.channels || channelsResult.status === "fulfilled",
        eventTypes: loaded.eventTypes || eventTypesResult.status === "fulfilled",
        me: loaded.me || meResult.status === "fulfilled",
      };
      loadError = settledErrors([
        installationsResult,
        commandsResult,
        subscriptionsResult,
        accountsResult,
        botsResult,
        channelsResult,
        eventTypesResult,
        meResult,
      ]);
    } finally {
      if (generation === refreshGeneration) refreshing = false;
    }
  }

  function markMutation() {
    mutationRevision += 1;
  }

  function setAccountBusy(id: string, busy: boolean) {
    const next = new Set(accountBusyIDs);
    if (busy) {
      next.add(id);
    } else {
      next.delete(id);
    }
    accountBusyIDs = next;
  }

  function handleCommandChanged(command: SlashCommand) {
    markMutation();
    const { signing_secret: _, ...commandMetadata } = command;
    commands = [commandMetadata, ...commands.filter((entry) => entry.id !== command.id)];
  }

  function handleSubscriptionChanged(subscription: EventSubscription) {
    markMutation();
    const { signing_secret: _, ...subscriptionMetadata } = subscription;
    subscriptions = [
      subscriptionMetadata,
      ...subscriptions.filter((entry) => entry.id !== subscription.id),
    ];
  }

  function handleInstalled(installation: AppInstallation, bot: User, token?: BotToken) {
    markMutation();
    const existingBot = bots.find((entry) => entry.bot.id === bot.id);
    let updatedTokens = existingBot?.tokens ?? [];
    if (token) {
      const { token: _, ...tokenMetadata } = token;
      updatedTokens = [tokenMetadata, ...updatedTokens.filter((entry) => entry.id !== token.id)];
    }
    const updatedBot = { bot, tokens: updatedTokens };
    installations = [installation, ...installations];
    bots = [updatedBot, ...bots.filter((entry) => entry.bot.id !== bot.id)];
    expandedID = installation.id;
  }

  async function refreshBotTokens(botID: string) {
    try {
      const tokens = await listWorkspaceBotTokens(workspaceID, botID);
      bots = bots.map((entry) => (entry.bot.id === botID ? { ...entry, tokens } : entry));
    } catch (err) {
      actionError = integrationsLoadErrorMessage(err);
    }
  }

  function startRevoke(installation: AppInstallation) {
    if (!canAssessRevoke) return;
    actionError = "";
    revokePending = { installation, revokeTokens: false, deleteBot: false };
  }

  async function confirmRevoke() {
    if (!revokePending || revoking) return;
    const { installation, revokeTokens, deleteBot } = revokePending;
    revoking = true;
    actionError = "";
    try {
      const result = await revokeAppInstallation(installation.id, {
        revoke_slash_commands: true,
        revoke_event_subscriptions: true,
        revoke_bot_tokens: deleteBot ? false : revokeTokens,
        delete_bot: deleteBot,
      });
      markMutation();
      if (result.deleted_bot) {
        const deletedBotID = result.deleted_bot.id;
        const deletedInstallationIDs = new Set(
          installations
            .filter((entry) => entry.bot_user_id === deletedBotID)
            .map((entry) => entry.id),
        );
        installations = installations.filter((entry) => entry.bot_user_id !== deletedBotID);
        commands = commands.filter((entry) => entry.bot_user_id !== deletedBotID);
        subscriptions = subscriptions.filter(
          (entry) =>
            !entry.app_installation_id ||
            !deletedInstallationIDs.has(entry.app_installation_id),
        );
        connectedAccounts = connectedAccounts.filter((entry) => entry.user_id !== deletedBotID);
        bots = bots.filter((entry) => entry.bot.id !== deletedBotID);
        await refresh();
      } else {
        installations = [
          result.installation,
          ...installations.filter((entry) => entry.id !== installation.id),
        ];
        commands = commands.filter((entry) => entry.app_installation_id !== installation.id);
        subscriptions = subscriptions.filter(
          (entry) => entry.app_installation_id !== installation.id,
        );
      }
      if (!result.deleted_bot && revokeTokens) {
        const revokedAt = new Date().toISOString();
        bots = bots.map((entry) =>
          entry.bot.id === installation.bot_user_id
            ? {
                ...entry,
                tokens: entry.tokens.map((token) =>
                  token.revoked_at ? token : { ...token, revoked_at: revokedAt },
                ),
              }
            : entry,
        );
      }
      revokePending = null;
      if (expandedID === installation.id) expandedID = "";
    } catch (err) {
      actionError =
        deleteBot && err instanceof APIError && err.status === 403
          ? err.message
          : integrationsLoadErrorMessage(err);
    } finally {
      revoking = false;
    }
  }

  async function revokeAccount(account: ConnectedAccount) {
    if (accountBusyIDs.has(account.id)) return;
    if (
      !confirm(
        `断开 ${account.display_name || account.provider_account_id}（${account.provider}）的连接？应用将立即失去此账户绑定。`,
      )
    ) {
      return;
    }
    setAccountBusy(account.id, true);
    actionError = "";
    try {
      await revokeConnectedAccount(account.id);
      markMutation();
      connectedAccounts = connectedAccounts.filter((entry) => entry.id !== account.id);
    } catch (err) {
      actionError = integrationsLoadErrorMessage(err);
    } finally {
      setAccountBusy(account.id, false);
    }
  }

  function canRevokeAccount(account: ConnectedAccount): boolean {
    return canManage || (!!me && account.user_id === me.id);
  }

  function formatDate(value: string | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
  }

  function revokeImpact(installation: AppInstallation): {
    commandCount: number;
    subscriptionCount: number;
    tokenCount: number;
  } {
    const bot = bots.find((entry) => entry.bot.id === installation.bot_user_id);
    return {
      commandCount: attachedTo(activeCommands, installation.id).length,
      subscriptionCount: attachedTo(activeSubscriptions, installation.id).length,
      tokenCount: bot ? bot.tokens.filter((token) => !token.revoked_at).length : 0,
    };
  }

  function canRevokeInstallationTokens(installation: AppInstallation): boolean {
    const bot = botFor(installation);
    return !!bot && (isServiceBot(bot) || bot.owner_user_id === me?.id);
  }

  function canDeleteInstallationBot(installation: AppInstallation): boolean {
    const bot = botFor(installation);
    if (!bot) return false;
    if (isServiceBot(bot)) return canManage;
    return bot.owner_user_id === me?.id;
  }
</script>

<div class="ws-intg-page">
  <header class="ws-page__header">
    <h1 class="ws-page__h1">集成</h1>
    <p class="ws-page__lead">
      连接到此工作区的应用。每次安装都会将智能体平台绑定到一个机器人身份，并拥有独立的令牌、斜杠命令和事件订阅。
    </p>
  </header>

  <div class="ws-bots__toolbar">
    <div class="ws-bots__count">{countLabel}</div>
    <div class="ws-bots__toolbar-actions">
      <button type="button" class="ws-btn" onclick={refresh} disabled={refreshing} title="刷新">
        {refreshing ? "正在刷新…" : "刷新"}
      </button>
      {#if canManage && me}
        <button
          type="button"
          class="ws-btn ws-btn--primary"
          onclick={() => (showWizard = true)}
          disabled={showWizard || !loaded.installations || !loaded.bots || !loaded.channels}
          title={
            !loaded.installations || !loaded.bots || !loaded.channels
              ? "添加应用前请刷新，以确保应用安装、机器人和频道数据为最新。"
              : undefined
          }
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          添加应用
        </button>
      {/if}
    </div>
  </div>

  {#if loadError}
    <div class="ws-settings__error">{loadError}</div>
  {/if}
  {#if actionError}
    <div class="ws-settings__error">{actionError}</div>
  {/if}

  {#if showWizard && me}
    <InstallWizard
      {workspaceID}
      {workspaceIdentifier}
      currentUserID={me.id}
      {bots}
      {boundBotIDs}
      {channels}
      onInstalled={handleInstalled}
      onBotTokensChanged={(botID) => void refreshBotTokens(botID)}
      onClose={() => (showWizard = false)}
    />
  {/if}

  {#if activeInstallations.length === 0 && loaded.installations}
    <div class="ws-bots__empty">
      尚未安装应用。添加应用，将智能体平台接入此工作区。
    </div>
  {:else if activeInstallations.length > 0}
    <div class="ws-bots__list">
      {#each activeInstallations as installation (installation.id)}
        {@const manifest = manifestForInstallation(installation.app_slug)}
        {@const bot = botFor(installation)}
        {@const expanded = expandedID === installation.id}
        {@const pendingHere = revokePending?.installation.id === installation.id}
        <div class="ws-bots__row" class:is-expanded={expanded}>
          <button
            type="button"
            class="ws-bots__row-main"
            aria-expanded={expanded}
            onclick={() => (expandedID = expanded ? "" : installation.id)}
          >
            <span class="ws-intg__app-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                {#each manifest.icon as path (path)}
                  <path d={path} />
                {/each}
              </svg>
            </span>
            <div class="ws-bots__row-text">
              <div class="ws-bots__row-name">{installation.display_name || manifest.name}</div>
              <div class="ws-bots__row-meta">
                <code class="ws-members__handle">{installation.app_slug}</code>
                {#if bot}
                  <span class="ws-members__dot" aria-hidden="true">·</span>
                  <span>{botLabel(bot)}</span>
                {/if}
                <span class="ws-members__dot" aria-hidden="true">·</span>
                <span>安装于 {formatDate(installation.created_at)}</span>
              </div>
            </div>
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
                  <h4 class="ws-bots__detail-title">
                    {manifest.name}
                  </h4>
                  <p class="ws-bots__detail-hint">
                    {#if !loaded.bots}
                      无法获取机器人详情。请刷新以加载当前绑定信息。
                    {:else if bot}
                      已作为 <a href={`/app/${workspaceID}/settings/bots`}>{botLabel(bot)}</a> 连接，令牌可在“机器人”页面管理。
                    {:else}
                      绑定的机器人已不在此工作区。
                    {/if}
                  </p>
                </div>
                {#if canManage}
                  <div class="ws-bots__detail-actions">
                    <button
                      type="button"
                      class="ws-btn ws-btn--danger"
                      onclick={() => startRevoke(installation)}
                      disabled={pendingHere || !canAssessRevoke}
                      title={
                        canAssessRevoke
                          ? "卸载应用"
                          : "卸载前请刷新，以准确了解受影响的内容。"
                      }
                    >
                      卸载
                    </button>
                  </div>
                {/if}
              </div>

              {#if pendingHere && revokePending}
                {@const impact = revokeImpact(installation)}
                <div class="ws-intg__confirm" role="alertdialog" aria-label="确认卸载">
                  <p class="ws-intg__confirm-text">
                    卸载将撤销关联到此应用的 {impact.commandCount} 个斜杠命令和 {impact.subscriptionCount} 个事件订阅。投递历史会保留。
                  </p>
                  {#if canRevokeInstallationTokens(installation) && impact.tokenCount > 0 && !revokePending.deleteBot}
                    <label class="ws-intg__toggle">
                      <input type="checkbox" bind:checked={revokePending.revokeTokens} />
                      <span>
                        <span class="ws-bots__choice-title">
                          同时撤销机器人的 {impact.tokenCount} 个有效令牌
                        </span>
                        <span class="ws-bots__choice-hint">
                          所有仍在使用这些令牌的连接将立即失效。如果机器人还被其他服务使用，请勿勾选。
                        </span>
                      </span>
                    </label>
                  {/if}
                  {#if canDeleteInstallationBot(installation) && bot}
                    <label class="ws-intg__toggle">
                      <input type="checkbox" bind:checked={revokePending.deleteBot} />
                      <span>
                        <span class="ws-bots__choice-title">
                          同时在所有工作区中删除 {botLabel(bot)}{bot.handle
                            ? "并释放用户名"
                            : ""}
                        </span>
                        <span class="ws-bots__choice-hint">
                          这会停用机器人身份，并撤销它在所有工作区中的全部令牌和集成。现有消息会保留，并标记为来自已删除的机器人。删除共享服务机器人需要拥有所有受影响工作区的管理权限。
                        </span>
                      </span>
                    </label>
                  {/if}
                  <div class="ws-bots__form-actions">
                    <button
                      type="button"
                      class="ws-btn"
                      onclick={() => (revokePending = null)}
                      disabled={revoking}
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      class="ws-btn ws-btn--danger"
                      onclick={confirmRevoke}
                      disabled={revoking}
                    >
                      {revoking ? "正在卸载…" : "卸载应用"}
                    </button>
                  </div>
                </div>
              {/if}

              {#if loaded.commands}
                <SlashCommandsPanel
                  {workspaceID}
                  commands={attachedTo(activeCommands, installation.id)}
                  installationID={installation.id}
                  botUserID={installation.bot_user_id}
                  {canManage}
                  onChanged={handleCommandChanged}
                />
              {/if}

              {#if loaded.subscriptions}
                <EventSubscriptionsPanel
                  {workspaceID}
                  subscriptions={attachedTo(activeSubscriptions, installation.id)}
                  {eventTypes}
                  installationID={installation.id}
                  {canManage}
                  onChanged={handleSubscriptionChanged}
                />
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  {#if (loaded.commands && unattachedCommands.length > 0) ||
  (loaded.subscriptions && unattachedSubscriptions.length > 0)}
    <section class="ws-intg__section">
      <h2 class="ws-intg__section-title">未关联应用</h2>
      <p class="ws-intg__section-hint">
        直接通过 API 创建，未关联应用安装。功能相同，只是未归入某个应用安装。
      </p>
      {#if loaded.commands && unattachedCommands.length > 0}
        <SlashCommandsPanel
          {workspaceID}
          commands={unattachedCommands}
          {canManage}
          onChanged={handleCommandChanged}
        />
      {/if}
      {#if loaded.subscriptions && unattachedSubscriptions.length > 0}
        <EventSubscriptionsPanel
          {workspaceID}
          subscriptions={unattachedSubscriptions}
          {eventTypes}
          {canManage}
          onChanged={handleSubscriptionChanged}
        />
      {/if}
    </section>
  {/if}

  <section class="ws-intg__section">
    <h2 class="ws-intg__section-title">已连接账户</h2>
    <p class="ws-intg__section-hint">
      应用为此工作区成员关联的外部账户身份。
    </p>
    {#if !loaded.connectedAccounts}
      <p class="ws-intg__panel-empty">无法获取已连接账户。请点击“刷新”重试。</p>
    {:else if connectedAccounts.length === 0}
      <p class="ws-intg__panel-empty">暂无已连接账户。</p>
    {:else}
      <ul class="ws-intg__item-list">
        {#each connectedAccounts as account (account.id)}
          <li class="ws-intg__item-row">
            <div class="ws-intg__item-main">
              <div class="ws-intg__item-name">
                {account.display_name || account.provider_account_id}
              </div>
              <div class="ws-intg__item-meta">
                <code class="ws-members__handle">{account.provider}</code>
                · 连接于 {formatDate(account.created_at)}
                {#if account.scopes?.length}
                  · {account.scopes.join(", ")}
                {/if}
              </div>
            </div>
            {#if canRevokeAccount(account)}
              <div class="ws-intg__item-actions">
                <button
                  type="button"
                  class="ws-btn ws-btn--danger"
                  onclick={() => revokeAccount(account)}
                  disabled={accountBusyIDs.has(account.id)}
                >
                  断开连接
                </button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
