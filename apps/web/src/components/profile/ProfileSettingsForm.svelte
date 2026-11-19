<script lang="ts">
  import Avatar from "../avatar/Avatar.svelte";
  import AccountSettingsForm from "./AccountSettingsForm.svelte";
  import BrowserNotificationSetting from "./BrowserNotificationSetting.svelte";
  import type { User } from "../../lib/types";

  type Props = {
    user: User;
    hideCommentary: boolean;
    hideToolCalls: boolean;
    userAlign: "left" | "right";
    otherAlign: "left" | "right";
    isDesktop?: boolean;
    onUserUpdated: (user: User) => void;
    onSaved?: () => void;
    onHideCommentary: (value: boolean) => void;
    onHideToolCalls: (value: boolean) => void;
    onUserAlign: (value: "left" | "right") => void;
    onOtherAlign: (value: "left" | "right") => void;
    onBrowserNotificationsChanged?: (enabled: boolean) => void;
  };

  let {
    user,
    hideCommentary,
    hideToolCalls,
    userAlign,
    otherAlign,
    isDesktop = false,
    onUserUpdated,
    onSaved,
    onHideCommentary,
    onHideToolCalls,
    onUserAlign,
    onOtherAlign,
    onBrowserNotificationsChanged,
  }: Props = $props();

  let displayName = $state("");
  let handle = $state("");
  let avatarURL = $state("");

  const previewName = $derived(displayName.trim() || user.display_name || "你的名字");
  const previewHandle = $derived(handle.trim().replace(/^@+/, "") || user.handle || "");

  $effect(() => {
    displayName = user.display_name;
    handle = user.handle ?? "";
    avatarURL = user.avatar_url;
  });

  function clearAvatar() {
    avatarURL = "";
  }
</script>

<AccountSettingsForm
  section="profile"
  {onUserUpdated}
  {onSaved}
  payload={() => ({
    display_name: displayName,
    handle: handle.trim().replace(/^@+/, ""),
    avatar_url: avatarURL,
  })}
>
  <section class="settings-identity" aria-label="个人资料预览">
    <Avatar
      id={user.id}
      name={previewName}
      src={avatarURL}
      size={52}
      loading="eager"
      fetchPriority="auto"
    />
    <div class="settings-identity__meta">
      <strong class="settings-identity__name">{previewName}</strong>
      <span class="settings-identity__handle">
        {previewHandle ? `@${previewHandle}` : "未设置用户名"}
      </span>
    </div>
    <span class="settings-identity__tag">预览</span>
  </section>

  <div class="settings-rows">
    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="profile-display-name">显示名称</label>
        <p class="settings-row2__hint">显示在消息、提及和个人资料卡中。</p>
      </div>
      <div class="settings-row2__control">
        <input
          id="profile-display-name"
          class="settings-input"
          bind:value={displayName}
          aria-label="显示名称"
          maxlength="80"
          autocomplete="name"
        />
      </div>
    </div>

    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="profile-handle">用户名</label>
        <p class="settings-row2__hint">用于提及和快速切换，必须唯一。</p>
      </div>
      <div class="settings-row2__control">
        <div class="settings-input-group">
          <span class="settings-input-group__prefix" aria-hidden="true">@</span>
          <input
            id="profile-handle"
            class="settings-input settings-input--in-group"
            bind:value={handle}
            aria-label="用户名"
            placeholder="your-handle"
            autocomplete="username"
          />
        </div>
      </div>
    </div>

    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="profile-avatar-url">头像</label>
        <p class="settings-row2__hint">粘贴公开可访问的图片 URL。留空时显示姓名首字母。</p>
      </div>
      <div class="settings-row2__control">
        <input
          id="profile-avatar-url"
          class="settings-input"
          bind:value={avatarURL}
          aria-label="头像 URL"
          placeholder="https://example.com/avatar.png"
          inputmode="url"
        />
        {#if avatarURL}
          <button
            type="button"
            class="settings-linklike"
            onclick={clearAvatar}
            aria-label="移除头像"
          >
            移除
          </button>
        {/if}
      </div>
    </div>

    <h3 class="settings-rows__head">对话显示</h3>

    <div class="settings-row2 settings-row2--toggle">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="profile-hide-commentary">隐藏智能体说明</label>
        <p class="settings-row2__hint">不在消息时间线中显示智能体的推理摘要。</p>
      </div>
      <div class="settings-row2__control settings-row2__control--end">
        <input
          id="profile-hide-commentary"
          type="checkbox"
          class="settings-switch"
          checked={hideCommentary}
          onchange={(event) => onHideCommentary(event.currentTarget.checked)}
        />
      </div>
    </div>

    <div class="settings-row2 settings-row2--toggle">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="profile-hide-tool-calls">隐藏工具调用</label>
        <p class="settings-row2__hint">隐藏工具执行详情，同时保留普通消息。</p>
      </div>
      <div class="settings-row2__control settings-row2__control--end">
        <input
          id="profile-hide-tool-calls"
          type="checkbox"
          class="settings-switch"
          checked={hideToolCalls}
          onchange={(event) => onHideToolCalls(event.currentTarget.checked)}
        />
      </div>
    </div>

    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="profile-user-align">你的消息对齐方式</label>
        <p class="settings-row2__hint">选择在时间线的哪一侧显示你的消息。</p>
      </div>
      <div class="settings-row2__control">
        <select
          id="profile-user-align"
          class="settings-input"
          value={userAlign}
          onchange={(event) => onUserAlign(event.currentTarget.value === "right" ? "right" : "left")}
        >
          <option value="left">左侧</option>
          <option value="right">右侧</option>
        </select>
      </div>
    </div>

    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="profile-other-align">其他消息对齐方式</label>
        <p class="settings-row2__hint">选择在时间线的哪一侧显示其他人和智能体的消息。</p>
      </div>
      <div class="settings-row2__control">
        <select
          id="profile-other-align"
          class="settings-input"
          value={otherAlign}
          onchange={(event) => onOtherAlign(event.currentTarget.value === "right" ? "right" : "left")}
        >
          <option value="left">左侧</option>
          <option value="right">右侧</option>
        </select>
      </div>
    </div>

    <h3 class="settings-rows__head">通知</h3>

    <BrowserNotificationSetting
      {user}
      {isDesktop}
      onChanged={onBrowserNotificationsChanged}
    />
  </div>

</AccountSettingsForm>
