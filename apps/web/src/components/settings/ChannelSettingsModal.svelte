<script lang="ts">
  import { channelDisplayTitle } from "../../lib/chat/channels";
  import type { Channel } from "../../lib/types";

  type Props = {
    channel: Channel;
    saving?: boolean;
    error?: string;
    onClose: () => void;
    onArchivedChange: (archived: boolean) => void;
  };

  let {
    channel,
    saving = false,
    error = "",
    onClose,
    onArchivedChange,
  }: Props = $props();

  let confirmingArchive = $state(false);
  const archived = $derived(Boolean(channel.archived_at));
  const channelTitle = $derived(`#${channelDisplayTitle(channel)}`);

  function close() {
    if (!saving) onClose();
  }
</script>

<div class="modal-scrim channel-settings-scrim" role="presentation">
  <button
    class="modal-backdrop"
    type="button"
    aria-label="关闭频道设置"
    disabled={saving}
    onclick={close}
  ></button>
  <div
    class="profile-modal channel-settings-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="channel-settings-title"
    aria-describedby="channel-settings-description"
  >
    <header>
      <div>
        <p>频道</p>
        <h2 id="channel-settings-title">频道设置</h2>
      </div>
      <button type="button" aria-label="关闭频道设置" disabled={saving} onclick={close}>
        &times;
      </button>
    </header>

    <div class="channel-settings-content">
      <div>
        <strong class="channel-settings-name">{channelTitle}</strong>
        <p id="channel-settings-description">
          归档频道会移至“已归档”，并保留完整消息历史。
        </p>
      </div>

      {#if error}
        <p class="profile-status error" role="alert">{error}</p>
      {/if}

      {#if archived}
        <div class="profile-actions channel-settings-actions">
          <button type="button" class="ghost-action" disabled={saving} onclick={close}>
            取消
          </button>
          <button
            type="button"
            class="primary-action"
            disabled={saving}
            onclick={() => onArchivedChange(false)}
          >
            {saving ? "正在恢复…" : "恢复频道"}
          </button>
        </div>
      {:else if confirmingArchive}
        <p class="channel-settings-warning">
          归档 {channelTitle}？工作区成员仍可在“已归档”中访问此频道。
        </p>
        <div class="profile-actions channel-settings-actions">
          <button
            type="button"
            class="ghost-action"
            disabled={saving}
            onclick={() => (confirmingArchive = false)}
          >
            取消
          </button>
          <button
            type="button"
            class="danger-action"
            disabled={saving}
            onclick={() => onArchivedChange(true)}
          >
            {saving ? "正在归档…" : "归档频道"}
          </button>
        </div>
      {:else}
        <div class="profile-actions channel-settings-actions">
          <button type="button" class="ghost-action" disabled={saving} onclick={close}>
            取消
          </button>
          <button
            type="button"
            class="danger-action"
            disabled={saving}
            onclick={() => (confirmingArchive = true)}
          >
            归档频道
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
