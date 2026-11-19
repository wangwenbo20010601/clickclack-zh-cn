<script lang="ts">
  type Props = {
    channelName: string;
    pending: boolean;
    error: string;
    onChannelName: (value: string) => void;
    onClose: () => void;
    onCreate: () => void;
  };

  let { channelName, pending, error, onChannelName, onClose, onCreate }: Props = $props();
</script>

<div class="modal-scrim" role="presentation">
  <button class="modal-backdrop" type="button" aria-label="关闭频道对话框" onclick={onClose}></button>
  <section class="profile-modal create-modal" aria-label="创建频道">
    <header>
      <div>
        <p>频道</p>
        <h2>创建频道</h2>
      </div>
      <button type="button" aria-label="关闭频道对话框" onclick={onClose}>×</button>
    </header>
    <form
      class="profile-form"
      onsubmit={(event) => {
        event.preventDefault();
        onCreate();
      }}
    >
      <label class="field">
        <span>频道名称（英文、数字或连字符）</span>
        <input
          value={channelName}
          disabled={pending}
          aria-label="频道名称"
          placeholder="例如：product-launch"
          autocomplete="off"
          oninput={(event) => onChannelName(event.currentTarget.value)}
        />
      </label>
      {#if error}<p class="profile-status error" role="alert">{error}</p>{/if}
      <div class="profile-actions">
        <button type="button" class="ghost-action" onclick={onClose}>取消</button>
        <button type="submit" class="primary-action" disabled={pending || !channelName.trim()}>{pending ? "正在创建…" : "创建频道"}</button>
      </div>
    </form>
  </section>
</div>
