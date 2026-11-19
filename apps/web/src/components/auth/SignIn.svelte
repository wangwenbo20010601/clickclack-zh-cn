<script lang="ts">
  import { api, apiURL, authMethods, readableAPIError } from "../../lib/api";
  import { desktop } from "../../lib/desktop";
  import KeystrokeMark from "../KeystrokeMark.svelte";

  const integratedTitleBar = desktop?.integratedTitleBar === true;
  let desktopAuthStatus = $state("");
  const enabledAuthMethods = authMethods();
  const githubAuthEnabled = enabledAuthMethods.includes("github");
  const passwordAuthEnabled = enabledAuthMethods.includes("password");
  const openclawAuthEnabled = !desktop && enabledAuthMethods.includes("openclaw");
  let passwordIdentifier = $state("");
  let passwordSecret = $state("");
  let magicToken = $state("");
  let authSubmitting = $state(false);
  let authError = $state("");
  const authLead = passwordAuthEnabled
    ? githubAuthEnabled
      ? "使用 ClickClack 账户登录，或通过 GitHub 继续。"
      : "使用 ClickClack 账户登录。"
    : githubAuthEnabled
      ? "通过 GitHub 登录以加入访客聊天室。"
      : openclawAuthEnabled
        ? "通过 OpenClaw ID 登录以加入访客聊天室。"
        : "使用 ClickClack 管理员提供的令牌登录。";
  const authFoot = githubAuthEnabled && !passwordAuthEnabled ? "任何 GitHub 账户均可加入。" : "";

  async function signInWithGitHub(event: MouseEvent) {
    if (!desktop) return;
    event.preventDefault();
    desktopAuthStatus = "正在浏览器中打开 GitHub…";
    try {
      await desktop.signInWithGitHub();
      desktopAuthStatus = "请在浏览器中完成登录，ClickClack 将在此处自动继续。";
    } catch {
      desktopAuthStatus = "无法打开浏览器，请重试。";
    }
  }

  // A fresh document prevents account-scoped state from crossing sign-ins.
  async function completeSignIn(path: string, body: Record<string, string>) {
    if (authSubmitting) return;
    authSubmitting = true;
    authError = "";
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      window.location.reload();
    } catch (error) {
      authError = readableAPIError(error, "无法登录。");
      authSubmitting = false;
    }
  }

  function submitPasswordLogin(event: SubmitEvent) {
    event.preventDefault();
    void completeSignIn("/api/auth/password/login", {
      identifier: passwordIdentifier,
      password: passwordSecret,
    });
  }

  function submitMagicToken(event: SubmitEvent) {
    event.preventDefault();
    void completeSignIn("/api/auth/magic/consume", { token: magicToken });
  }

</script>

{#if integratedTitleBar && desktop}
  <div class="desktop-auth-titlebar" data-platform={desktop.platform} aria-hidden="true"></div>
{/if}
<main class="auth-shell">
  <section class="auth-panel" aria-label="登录">
    <div class="auth-brand">
      <KeystrokeMark class="mark" size={44} />
      <div class="brand-text">
        <strong>ClickClack</strong>
        <span>OpenClaw 工作区聊天</span>
      </div>
    </div>
    <div class="auth-copy">
      <h1>欢迎。</h1>
      <p>{authLead}</p>
    </div>
    {#if passwordAuthEnabled}
      <form class="auth-form" onsubmit={submitPasswordLogin}>
        <label class="field">
          <span>邮箱或用户名</span>
          <input
            bind:value={passwordIdentifier}
            autocomplete="username"
            name="identifier"
            required
            type="text"
          />
        </label>
        <label class="field">
          <span>密码</span>
          <input
            bind:value={passwordSecret}
            autocomplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
        <button class="auth-submit" type="submit" disabled={authSubmitting}>
          {authSubmitting ? "正在登录…" : "登录"}
        </button>
      </form>
    {/if}
    {#if githubAuthEnabled}
      {#if passwordAuthEnabled}
        <p class="auth-divider"><span>或</span></p>
      {/if}
      <a class="github-login" href={apiURL("/api/auth/github/start")} onclick={signInWithGitHub}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path fill="currentColor" d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.94 10.94 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56 4.56-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z"/>
        </svg>
        通过 GitHub 继续
      </a>
    {/if}
    {#if openclawAuthEnabled}
      <a class="openclaw-login" href={apiURL("/api/auth/openclaw/start")}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 3.5A6.5 6.5 0 1 1 5.5 12 6.51 6.51 0 0 1 12 5.5Zm0 3A3.5 3.5 0 1 0 15.5 12 3.5 3.5 0 0 0 12 8.5Z"
          />
        </svg>
        通过 OpenClaw ID 登录
      </a>
    {/if}
    {#if authError}
      <p class="auth-error" role="alert">{authError}</p>
    {/if}
    <details class="auth-magic" open={!githubAuthEnabled && !passwordAuthEnabled && !openclawAuthEnabled}>
      <summary>已有登录令牌？</summary>
      <form class="auth-form" onsubmit={submitMagicToken}>
        <label class="field">
          <span>登录令牌</span>
          <input
            bind:value={magicToken}
            autocomplete="one-time-code"
            name="token"
            required
            type="text"
          />
        </label>
        <button class="auth-submit auth-submit-quiet" type="submit" disabled={authSubmitting}>
          使用令牌
        </button>
      </form>
    </details>
    {#if desktopAuthStatus || authFoot}
      <p class="auth-foot">{desktopAuthStatus || authFoot}</p>
    {/if}
  </section>
</main>
