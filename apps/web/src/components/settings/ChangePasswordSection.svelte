<script lang="ts">
  import { api, readableAPIError } from "../../lib/api";
  import { validateNewPassword } from "../../lib/password";

  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let status = $state("");
  let statusError = $state(false);
  let saving = $state(false);

  async function save() {
    if (saving) return;
    const problem = validateNewPassword(currentPassword, newPassword, confirmPassword);
    if (problem) {
      status = problem;
      statusError = true;
      return;
    }
    saving = true;
    status = "";
    statusError = false;
    try {
      await api("/api/auth/password/change", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      // The fields hold a live secret; clear them the moment they are spent.
      currentPassword = "";
      newPassword = "";
      confirmPassword = "";
      status = "密码已更新。其他设备已退出登录。";
    } catch (error) {
      status = readableAPIError(error, "无法修改密码");
      statusError = true;
    } finally {
      saving = false;
    }
  }
</script>

<form
  class="settings-form settings-password"
  onsubmit={(event) => {
    event.preventDefault();
    void save();
  }}
>
  <div class="settings-password__intro">
    <strong>修改密码</strong>
    <p>设置新的登录密码。其他设备将退出登录。</p>
  </div>

  <div class="settings-rows">
    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="password-current">当前密码</label>
        <p class="settings-row2__hint">你当前使用的登录密码。</p>
      </div>
      <div class="settings-row2__control">
        <input
          id="password-current"
          class="settings-input"
          type="password"
          bind:value={currentPassword}
          aria-label="当前密码"
          autocomplete="current-password"
        />
      </div>
    </div>

    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="password-new">新密码</label>
        <p class="settings-row2__hint">至少 8 个字符。增加长度比使用复杂组合更有效。</p>
      </div>
      <div class="settings-row2__control">
        <input
          id="password-new"
          class="settings-input"
          type="password"
          bind:value={newPassword}
          aria-label="新密码"
          autocomplete="new-password"
        />
      </div>
    </div>

    <div class="settings-row2">
      <div class="settings-row2__desc">
        <label class="settings-row2__label" for="password-confirm">确认新密码</label>
        <p class="settings-row2__hint">再次输入新密码，以免输错后无法登录。</p>
      </div>
      <div class="settings-row2__control">
        <input
          id="password-confirm"
          class="settings-input"
          type="password"
          bind:value={confirmPassword}
          aria-label="确认新密码"
          autocomplete="new-password"
        />
      </div>
    </div>
  </div>

  <footer class="settings-footer">
    {#if status}
      <p class="settings-status" class:is-error={statusError} role="status">{status}</p>
    {:else}
      <span class="settings-footer__spacer" aria-hidden="true"></span>
    {/if}
    <button type="submit" class="settings-button settings-button--primary" disabled={saving}>
      {saving ? "正在更新…" : "更新密码"}
    </button>
  </footer>
</form>
