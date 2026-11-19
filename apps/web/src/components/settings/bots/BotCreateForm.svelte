<script lang="ts" module>
  export type ConnectMethod = "code" | "token";

  export type BotCreateDetail = {
    connect: ConnectMethod;
    tokenName: string;
    scopes: string[];
  };
</script>

<script lang="ts">
  import { untrack } from "svelte";
  import {
    createWorkspaceBot,
    suggestHandleFrom,
    botLoadErrorMessage,
    BOT_SCOPE_BUNDLES,
    type BotScopeBundle,
    type CreateBotResponse,
  } from "../../../lib/bots";

  type Ownership = "service" | "user";

  type Props = {
    workspaceID: string;
    currentUserID: string;
    canCreateService: boolean;
    onCreated: (response: CreateBotResponse, detail: BotCreateDetail) => void;
    onCancel: () => void;
  };

  let {
    workspaceID,
    currentUserID,
    canCreateService,
    onCreated,
    onCancel,
  }: Props = $props();

  let displayName = $state("");
  let handle = $state("");
  let handleEdited = $state(false);
  let ownership = $state<Ownership>(untrack(() => (canCreateService ? "service" : "user")));
  let connect = $state<ConnectMethod>("code");
  let tokenName = $state("default");
  let selectedScope = $state<BotScopeBundle>("bot:write");
  let setupNonce = $state(crypto.randomUUID());
  let submitting = $state(false);
  let error = $state("");

  $effect(() => {
    if (!handleEdited) {
      handle = suggestHandleFrom(displayName);
    }
  });

  function onHandleInput(event: Event) {
    handleEdited = true;
    handle = (event.target as HTMLInputElement).value;
  }

  const canSubmit = $derived(
    !submitting && displayName.trim().length > 0 && handle.trim().length > 0,
  );

  async function submit(event: Event) {
    event.preventDefault();
    if (!canSubmit) return;
    submitting = true;
    error = "";
    try {
      const name = tokenName.trim() || "default";
      const response = await createWorkspaceBot(workspaceID, {
        display_name: displayName.trim(),
        handle: handle.trim(),
        owner_user_id: ownership === "user" ? currentUserID : undefined,
        setup_nonce: setupNonce,
        // Code mode creates the bot without a credential; the setup code
        // mints the token when OpenClaw claims it.
        ...(connect === "code"
          ? { initial_token: false }
          : { token_name: name, scopes: [selectedScope] }),
      });
      onCreated(response, { connect, tokenName: name, scopes: [selectedScope] });
    } catch (err) {
      error = botLoadErrorMessage(err);
    } finally {
      submitting = false;
    }
  }
</script>

<form class="ws-bots__form" onsubmit={submit}>
  <header class="ws-bots__form-header">
    <h3 class="ws-bots__form-title">新建机器人</h3>
    <p class="ws-bots__form-hint">
      机器人使用在此生成的令牌向频道和私聊发送消息。将令牌配置到 OpenClaw，即可让它接入此工作区。
    </p>
  </header>

  <div class="ws-bots__form-grid">
    <label class="ws-bots__form-field">
      <span class="ws-bots__form-label">显示名称</span>
      <input
        class="ws-bots__form-input"
        type="text"
        bind:value={displayName}
        placeholder="OpenClaw"
        maxlength="80"
        required
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
          placeholder="openclaw"
          required
        />
      </div>
    </label>
  </div>

  <fieldset class="ws-bots__form-field">
    <legend class="ws-bots__form-label">归属</legend>
    <div class="ws-bots__choices">
      {#if canCreateService}
        <label class="ws-bots__choice" class:is-active={ownership === "service"}>
          <input type="radio" name="ownership" value="service" bind:group={ownership} />
          <span class="ws-bots__choice-title">服务机器人</span>
          <span class="ws-bots__choice-hint">
            归工作区所有。所有者和管理员均可更换其令牌。
          </span>
        </label>
      {/if}
      <label class="ws-bots__choice" class:is-active={ownership === "user"}>
        <input type="radio" name="ownership" value="user" bind:group={ownership} />
        <span class="ws-bots__choice-title">个人机器人</span>
        <span class="ws-bots__choice-hint">
          归你所有。仅你可以更换或撤销其令牌。管理员可以将它从此工作区移除。
        </span>
      </label>
    </div>
  </fieldset>

  <fieldset class="ws-bots__form-field">
    <legend class="ws-bots__form-label">选择连接方式</legend>
    <div class="ws-bots__choices">
      <label class="ws-bots__choice" class:is-active={connect === "code"}>
        <input type="radio" name="connect" value="code" bind:group={connect} />
        <span class="ws-bots__choice-title">设置码（推荐）</span>
        <span class="ws-bots__choice-hint">
          在运行 OpenClaw 的机器上执行一条命令。一次性设置码会直接在那里生成令牌，无需手动复制。
        </span>
      </label>
      <label class="ws-bots__choice" class:is-active={connect === "token"}>
        <input type="radio" name="connect" value="token" bind:group={connect} />
        <span class="ws-bots__choice-title">手动配置令牌</span>
        <span class="ws-bots__choice-hint">
          立即生成原始令牌并自行配置，适用于手动编写配置或 OpenClaw 以外的客户端。
        </span>
      </label>
    </div>
  </fieldset>

  <fieldset class="ws-bots__form-field">
    <legend class="ws-bots__form-label">权限范围</legend>
    <div class="ws-bots__choices">
      {#each BOT_SCOPE_BUNDLES as bundle (bundle.id)}
        <label class="ws-bots__choice" class:is-active={selectedScope === bundle.id}>
          <input type="radio" name="scope" value={bundle.id} bind:group={selectedScope} />
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
      placeholder="default"
      maxlength="80"
    />
    {#if connect === "code"}
      <span class="ws-bots__form-hint">设置码被使用时生成的令牌将采用此名称。</span>
    {/if}
  </label>

  {#if error}
    <p class="ws-bots__form-error" role="alert">{error}</p>
  {/if}

  <div class="ws-bots__form-actions">
    <button type="button" class="ws-btn" onclick={onCancel} disabled={submitting}>取消</button>
    <button type="submit" class="ws-btn ws-btn--primary" disabled={!canSubmit}>
      {submitting ? "正在创建…" : "创建机器人"}
    </button>
  </div>
</form>
