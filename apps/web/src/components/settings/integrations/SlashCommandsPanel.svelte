<script lang="ts">
  import {
    createSlashCommand,
    integrationsLoadErrorMessage,
    revokeSlashCommand,
    rotateSlashCommandSecret,
    type SlashCommand,
  } from "../../../lib/integrations";

  type Props = {
    workspaceID: string;
    commands: SlashCommand[];
    // When set, new commands are attached to this installation and posted as
    // this bot. When unset the panel is read-only over unattached commands.
    installationID?: string;
    botUserID?: string;
    canManage: boolean;
    onChanged: (command: SlashCommand) => void;
  };

  let { workspaceID, commands, installationID, botUserID, canManage, onChanged }: Props =
    $props();

  let showCreate = $state(false);
  let commandName = $state("");
  let description = $state("");
  let callbackURL = $state("");
  let submitting = $state(false);
  let error = $state("");
  let busyIDs = $state<Set<string>>(new Set());
  // One-time signing secrets, keyed by command id. Populated from create and
  // rotate responses; never re-fetchable.
  let revealedSecrets = $state<Record<string, string>>({});
  let copiedID = $state("");

  const canCreate = $derived(canManage && !!installationID && !!botUserID);
  const createValid = $derived(
    !submitting && commandName.trim().length > 0 && callbackURL.trim().startsWith("https://"),
  );

  function normalizedCommand(): string {
    return commandName.trim().replace(/^\/+/, "");
  }

  function displayCommand(command: string): string {
    return `/${command.replace(/^\/+/, "")}`;
  }

  function setBusy(id: string, busy: boolean) {
    const next = new Set(busyIDs);
    if (busy) {
      next.add(id);
    } else {
      next.delete(id);
    }
    busyIDs = next;
  }

  async function submitCreate(event: Event) {
    event.preventDefault();
    if (!createValid || !installationID || !botUserID) return;
    submitting = true;
    error = "";
    try {
      const created = await createSlashCommand(workspaceID, {
        app_installation_id: installationID,
        command: normalizedCommand(),
        description: description.trim(),
        callback_url: callbackURL.trim(),
        bot_user_id: botUserID,
      });
      if (created.signing_secret) {
        revealedSecrets = { ...revealedSecrets, [created.id]: created.signing_secret };
      }
      commandName = "";
      description = "";
      callbackURL = "";
      showCreate = false;
      onChanged(created);
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      submitting = false;
    }
  }

  async function revoke(command: SlashCommand) {
    if (busyIDs.has(command.id)) return;
    if (
      !confirm(
        `撤销 ${displayCommand(command.command)}？它将从消息输入框中消失，其回调也将立即停止触发。`,
      )
    ) {
      return;
    }
    setBusy(command.id, true);
    error = "";
    try {
      const revoked = await revokeSlashCommand(command.id);
      onChanged(revoked);
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      setBusy(command.id, false);
    }
  }

  async function rotate(command: SlashCommand) {
    if (busyIDs.has(command.id)) return;
    if (
      !confirm(
        `更换 ${displayCommand(command.command)} 的签名密钥？旧密钥将立即失效，请及时更新接收端。`,
      )
    ) {
      return;
    }
    setBusy(command.id, true);
    error = "";
    try {
      const rotated = await rotateSlashCommandSecret(command.id);
      if (rotated.signing_secret) {
        revealedSecrets = { ...revealedSecrets, [command.id]: rotated.signing_secret };
      }
      onChanged(rotated);
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      setBusy(command.id, false);
    }
  }

  async function copySecret(id: string) {
    try {
      await navigator.clipboard.writeText(revealedSecrets[id] ?? "");
      copiedID = id;
      setTimeout(() => {
        if (copiedID === id) copiedID = "";
      }, 1800);
    } catch {
      // Clipboard may be blocked; the value is still visible.
    }
  }

  function dismissSecret(id: string) {
    const { [id]: _, ...rest } = revealedSecrets;
    revealedSecrets = rest;
  }

  function formatDate(value: string | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
  }
</script>

<div class="ws-intg__panel">
  <div class="ws-intg__panel-header">
    <div>
      <h5 class="ws-intg__panel-title">斜杠命令</h5>
      <p class="ws-intg__panel-hint">
        消息输入框中的 <code>/command</code> 命令。每个命令都会调用 HTTPS 端点并使用独立密钥签名，回复以机器人身份发送。
      </p>
    </div>
    {#if canCreate}
      <button
        type="button"
        class="ws-btn"
        onclick={() => {
          showCreate = !showCreate;
          error = "";
        }}
      >
        {showCreate ? "取消" : "添加命令"}
      </button>
    {/if}
  </div>

  {#if showCreate && canCreate}
    <form class="ws-intg__inline-form" onsubmit={submitCreate}>
      <div class="ws-bots__form-grid">
        <label class="ws-bots__form-field">
          <span class="ws-bots__form-label">命令</span>
          <div class="ws-bots__form-handle">
            <span aria-hidden="true">/</span>
            <input
              class="ws-bots__form-input"
              type="text"
              bind:value={commandName}
              placeholder="deploy"
              maxlength="32"
              required
            />
          </div>
        </label>
        <label class="ws-bots__form-field">
          <span class="ws-bots__form-label">描述</span>
          <input
            class="ws-bots__form-input"
            type="text"
            bind:value={description}
            placeholder="部署当前分支"
            maxlength="120"
          />
        </label>
      </div>
      <label class="ws-bots__form-field">
        <span class="ws-bots__form-label">回调 URL</span>
        <input
          class="ws-bots__form-input"
          type="url"
          bind:value={callbackURL}
          placeholder="https://example.com/hooks/clickclack"
          required
        />
        <span class="ws-bots__form-hint">
          仅支持 HTTPS。每个命令使用独立密钥为调用签名，密钥仅在创建时显示一次。
        </span>
      </label>
      <div class="ws-bots__form-actions">
        <button type="submit" class="ws-btn ws-btn--primary" disabled={!createValid}>
          {submitting ? "正在创建…" : "创建命令"}
        </button>
      </div>
    </form>
  {/if}

  {#if error}
    <p class="ws-bots__form-error" role="alert">{error}</p>
  {/if}

  {#if commands.length === 0}
    <p class="ws-intg__panel-empty">暂无斜杠命令。</p>
  {:else}
    <ul class="ws-intg__item-list">
      {#each commands as command (command.id)}
        <li class="ws-intg__item-row">
          <div class="ws-intg__item-main">
            <div class="ws-intg__item-name"><code>{displayCommand(command.command)}</code></div>
            <div class="ws-intg__item-meta">
              {#if command.description}{command.description} · {/if}
              <span class="ws-intg__url" title={command.callback_url}>{command.callback_url}</span>
              · 创建于 {formatDate(command.created_at)}
            </div>
            {#if revealedSecrets[command.id]}
              <div class="ws-intg__secret" aria-live="polite">
                <span class="ws-intg__secret-label">签名密钥，仅显示一次</span>
                <div class="ws-intg__secret-row">
                  <input
                    class="ws-bots__reveal-input"
                    type="text"
                    readonly
                    value={revealedSecrets[command.id]}
                  />
                  <button
                    type="button"
                    class="ws-btn ws-btn--primary"
                    onclick={() => copySecret(command.id)}
                  >
                    {copiedID === command.id ? "已复制" : "复制"}
                  </button>
                  <button type="button" class="ws-btn" onclick={() => dismissSecret(command.id)}>
                    完成
                  </button>
                </div>
              </div>
            {/if}
          </div>
          {#if canManage}
            <div class="ws-intg__item-actions">
              <button
                type="button"
                class="ws-btn"
                onclick={() => rotate(command)}
                disabled={busyIDs.has(command.id)}
              >
                更换密钥
              </button>
              <button
                type="button"
                class="ws-btn ws-btn--danger"
                onclick={() => revoke(command)}
                disabled={busyIDs.has(command.id)}
              >
                撤销
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
