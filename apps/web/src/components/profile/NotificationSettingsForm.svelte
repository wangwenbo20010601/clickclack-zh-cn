<script lang="ts">
  import AccountSettingsForm from "./AccountSettingsForm.svelte";
  import BrowserNotificationSetting from "./BrowserNotificationSetting.svelte";
  import PushNotificationSetting from "./PushNotificationSetting.svelte";
  import type { User } from "../../lib/types";

  type Props = {
    user: User;
    isDesktop?: boolean;
    onUserUpdated: (user: User) => void;
    onBrowserNotificationsChanged?: (enabled: boolean) => void;
  };

  let {
    user,
    isDesktop = false,
    onUserUpdated,
    onBrowserNotificationsChanged,
  }: Props = $props();

  let pushoverEnabled = $state(false);
  let pushoverUserKey = $state("");

  $effect(() => {
    pushoverEnabled = user.notification_settings?.pushover_enabled ?? false;
    pushoverUserKey = user.notification_settings?.pushover_user_key ?? "";
  });

</script>

<AccountSettingsForm
  section="notifications"
  {onUserUpdated}
  payload={() => ({
    notification_settings: {
      pushover_enabled: pushoverEnabled,
      pushover_user_key: pushoverUserKey,
    },
  })}
>
  <div class="settings-rows settings-rows--sectioned">
    <h3 class="settings-rows__head">桌面</h3>

    <BrowserNotificationSetting
      {user}
      {isDesktop}
      onChanged={onBrowserNotificationsChanged}
    />

    <h3 class="settings-rows__head">移动端推送</h3>

    <PushNotificationSetting {user} {isDesktop} />

    <div class="settings-row2 settings-row2--toggle">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="notifications-pushover">Pushover</label>
        <p class="settings-row2__hint">通过 Pushover 向手机发送推送通知。</p>
      </div>
      <div class="settings-row2__control settings-row2__control--end">
        <input
          id="notifications-pushover"
          type="checkbox"
          class="settings-switch"
          aria-label="Pushover 通知"
          bind:checked={pushoverEnabled}
        />
      </div>
    </div>

    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="notifications-pushover-key">Pushover 用户密钥</label>
        <p class="settings-row2__hint">在 Pushover 控制台的“Your User Key”下查找。</p>
      </div>
      <div class="settings-row2__control">
        <input
          id="notifications-pushover-key"
          class="settings-input"
          bind:value={pushoverUserKey}
          aria-label="Pushover 用户密钥"
          maxlength="30"
          placeholder="u..."
          autocomplete="off"
        />
      </div>
    </div>
  </div>

</AccountSettingsForm>
