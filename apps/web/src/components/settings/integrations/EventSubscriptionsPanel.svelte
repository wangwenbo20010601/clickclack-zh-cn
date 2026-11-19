<script lang="ts">
  import {
    createEventSubscription,
    integrationsLoadErrorMessage,
    revokeEventSubscription,
    rotateEventSubscriptionSecret,
    type EventSubscription,
  } from "../../../lib/integrations";
  import DeliveriesPanel from "./DeliveriesPanel.svelte";

  type Props = {
    workspaceID: string;
    subscriptions: EventSubscription[];
    eventTypes: string[];
    // When set, new subscriptions are attached to this installation. When
    // unset the panel is read-only over unattached subscriptions.
    installationID?: string;
    canManage: boolean;
    onChanged: (subscription: EventSubscription) => void;
  };

  let { workspaceID, subscriptions, eventTypes, installationID, canManage, onChanged }: Props =
    $props();

  let showCreate = $state(false);
  let callbackURL = $state("");
  let allEvents = $state(false);
  let selectedTypes = $state<string[]>([]);
  let submitting = $state(false);
  let error = $state("");
  let busyIDs = $state<Set<string>>(new Set());
  let revealedSecrets = $state<Record<string, string>>({});
  let copiedID = $state("");
  let openDeliveriesID = $state("");

  const canCreate = $derived(canManage && !!installationID);
  const createValid = $derived(
    !submitting &&
      (allEvents || selectedTypes.length > 0) &&
      callbackURL.trim().startsWith("https://"),
  );

  function toggleType(type: string) {
    selectedTypes = selectedTypes.includes(type)
      ? selectedTypes.filter((t) => t !== type)
      : [...selectedTypes, type];
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
    if (!createValid || !installationID) return;
    submitting = true;
    error = "";
    try {
      const created = await createEventSubscription(workspaceID, {
        app_installation_id: installationID,
        event_types: allEvents ? ["*"] : selectedTypes,
        callback_url: callbackURL.trim(),
      });
      if (created.signing_secret) {
        revealedSecrets = { ...revealedSecrets, [created.id]: created.signing_secret };
      }
      callbackURL = "";
      allEvents = false;
      selectedTypes = [];
      showCreate = false;
      onChanged(created);
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      submitting = false;
    }
  }

  async function revoke(subscription: EventSubscription) {
    if (busyIDs.has(subscription.id)) return;
    if (
      !confirm(
        "撤销此事件订阅？向其回调地址的投递将立即停止，投递历史会保留。",
      )
    ) {
      return;
    }
    setBusy(subscription.id, true);
    error = "";
    try {
      const revoked = await revokeEventSubscription(subscription.id);
      onChanged(revoked);
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      setBusy(subscription.id, false);
    }
  }

  async function rotate(subscription: EventSubscription) {
    if (busyIDs.has(subscription.id)) return;
    if (
      !confirm(
        "更换此订阅的签名密钥？旧密钥将立即失效，请及时更新接收端。",
      )
    ) {
      return;
    }
    setBusy(subscription.id, true);
    error = "";
    try {
      const rotated = await rotateEventSubscriptionSecret(subscription.id);
      if (rotated.signing_secret) {
        revealedSecrets = { ...revealedSecrets, [subscription.id]: rotated.signing_secret };
      }
      onChanged(rotated);
    } catch (err) {
      error = integrationsLoadErrorMessage(err);
    } finally {
      setBusy(subscription.id, false);
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
      <h5 class="ws-intg__panel-title">事件订阅</h5>
      <p class="ws-intg__panel-hint">
        将工作区事件推送到 HTTPS 端点，并使用各订阅独立的密钥签名。每次投递尝试都会记录在日志中。
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
        {showCreate ? "取消" : "添加订阅"}
      </button>
    {/if}
  </div>

  {#if showCreate && canCreate}
    <form class="ws-intg__inline-form" onsubmit={submitCreate}>
      <label class="ws-bots__form-field">
        <span class="ws-bots__form-label">回调 URL</span>
        <input
          class="ws-bots__form-input"
          type="url"
          bind:value={callbackURL}
          placeholder="https://example.com/hooks/events"
          required
        />
      </label>
      <fieldset class="ws-bots__form-field">
        <legend class="ws-bots__form-label">事件类型</legend>
        <label class="ws-intg__toggle">
          <input type="checkbox" bind:checked={allEvents} />
          <span>
            <span class="ws-bots__choice-title">所有事件（<code>*</code>）</span>
            <span class="ws-bots__choice-hint">
              包括未来版本中新增的事件类型。
            </span>
          </span>
        </label>
        {#if !allEvents}
          <div class="ws-intg__event-grid">
            {#each eventTypes as type (type)}
              <label class="ws-intg__event-option" class:is-active={selectedTypes.includes(type)}>
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onchange={() => toggleType(type)}
                />
                <code>{type}</code>
              </label>
            {/each}
          </div>
        {/if}
      </fieldset>
      <div class="ws-bots__form-actions">
        <button type="submit" class="ws-btn ws-btn--primary" disabled={!createValid}>
          {submitting ? "正在创建…" : "创建订阅"}
        </button>
      </div>
    </form>
  {/if}

  {#if error}
    <p class="ws-bots__form-error" role="alert">{error}</p>
  {/if}

  {#if subscriptions.length === 0}
    <p class="ws-intg__panel-empty">暂无事件订阅。</p>
  {:else}
    <ul class="ws-intg__item-list">
      {#each subscriptions as subscription (subscription.id)}
        <li class="ws-intg__item-row ws-intg__item-row--stacked">
          <div class="ws-intg__item-top">
            <div class="ws-intg__item-main">
              <div class="ws-intg__item-name">
                <span class="ws-intg__url" title={subscription.callback_url}>
                  {subscription.callback_url}
                </span>
              </div>
              <div class="ws-intg__item-meta">
                创建于 {formatDate(subscription.created_at)}
              </div>
              <div class="ws-intg__type-chips">
                {#each subscription.event_types as type (type)}
                  <span class="ws-bots__scope-chip">{type}</span>
                {/each}
              </div>
              {#if revealedSecrets[subscription.id]}
                <div class="ws-intg__secret" aria-live="polite">
                  <span class="ws-intg__secret-label">签名密钥，仅显示一次</span>
                  <div class="ws-intg__secret-row">
                    <input
                      class="ws-bots__reveal-input"
                      type="text"
                      readonly
                      value={revealedSecrets[subscription.id]}
                    />
                    <button
                      type="button"
                      class="ws-btn ws-btn--primary"
                      onclick={() => copySecret(subscription.id)}
                    >
                      {copiedID === subscription.id ? "已复制" : "复制"}
                    </button>
                    <button
                      type="button"
                      class="ws-btn"
                      onclick={() => dismissSecret(subscription.id)}
                    >
                      完成
                    </button>
                  </div>
                </div>
              {/if}
            </div>
            <div class="ws-intg__item-actions">
              <button
                type="button"
                class="ws-btn"
                onclick={() =>
                  (openDeliveriesID = openDeliveriesID === subscription.id ? "" : subscription.id)}
              >
                {openDeliveriesID === subscription.id ? "隐藏投递记录" : "投递记录"}
              </button>
              {#if canManage}
                <button
                  type="button"
                  class="ws-btn"
                  onclick={() => rotate(subscription)}
                  disabled={busyIDs.has(subscription.id)}
                >
                  更换密钥
                </button>
                <button
                  type="button"
                  class="ws-btn ws-btn--danger"
                  onclick={() => revoke(subscription)}
                  disabled={busyIDs.has(subscription.id)}
                >
                  撤销
                </button>
              {/if}
            </div>
          </div>
          {#if openDeliveriesID === subscription.id}
            <DeliveriesPanel subscriptionID={subscription.id} />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
