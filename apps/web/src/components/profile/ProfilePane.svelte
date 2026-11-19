<script lang="ts">
  import Avatar from "../avatar/Avatar.svelte";
  import { avatarHue, handleLabel } from "../../lib/chat/people";
  import type { MemberModeration, User, Workspace } from "../../lib/types";

  type Props = {
    profile: User;
    currentUser: User | null;
    workspaceName?: string;
    currentUserRole?: Workspace["role"] | "";
    moderation?: MemberModeration;
    onClose: () => void;
    onEdit?: () => void;
    onMessage?: (memberID: string) => void;
    messagePending?: boolean;
    messageError?: string;
    onApprove?: (memberID: string) => void;
    onTimeout?: (memberID: string) => void;
    onBlock?: (memberID: string) => void;
    onUnblock?: (memberID: string) => void;
  };

  let {
    profile,
    currentUser,
    workspaceName,
    currentUserRole,
    moderation,
    onClose,
    onEdit,
    onMessage,
    messagePending = false,
    messageError = "",
    onApprove,
    onTimeout,
    onBlock,
    onUnblock,
  }: Props = $props();

  const botLabel = $derived(
    profile.kind === "bot" ? (profile.owner_user_id ? `${profile.owner_user_id} 的机器人` : "服务机器人") : "",
  );
  const targetRole = $derived(moderation?.role || "member");
  const canModerateRole = $derived(
    Boolean(moderation) &&
      targetRole !== "owner" &&
      (currentUserRole === "owner" || (currentUserRole === "moderator" && (targetRole === "member" || targetRole === "guest"))),
  );
  const canModerate = $derived(
    currentUser?.id !== profile.id && canModerateRole,
  );
  const isBlocked = $derived(Boolean(moderation?.blocked_at));
  const roleLabel = $derived(({ owner: "所有者", moderator: "管理员", member: "成员", guest: "访客", bot: "机器人" })[targetRole]);
</script>

<header>
  <div>
    <p>个人资料</p>
    <strong>{profile.display_name}</strong>
  </div>
  <button class="close" aria-label="关闭个人资料" onclick={onClose}>×</button>
</header>
<div class="profile-pane">
  <div class="profile-hero" style="--hue: {avatarHue(profile.id)}deg">
    <Avatar
      class="profile-avatar"
      id={profile.id}
      name={profile.display_name}
      src={profile.avatar_url}
      size={240}
      loading="eager"
      fetchPriority="auto"
    />
  </div>
  <section class="profile-pane-body">
    <div class="profile-pane-title">
      <div>
        <h2>{profile.display_name}</h2>
        {#if botLabel}<span class="bot-badge">{botLabel}</span>{/if}
        {#if profile.handle}<span>{handleLabel(profile.handle)}</span>{/if}
      </div>
      {#if currentUser?.id === profile.id && onEdit}
        <button type="button" class="text-action" onclick={onEdit}>编辑</button>
      {/if}
    </div>
    <div class="profile-presence">
      <span class="presence-dot active" aria-hidden="true"></span>
      <span>在线</span>
    </div>
    {#if currentUser?.id !== profile.id && onMessage}
    <div class="profile-actions-row">
      <button type="button" class="primary-action" disabled={messagePending} onclick={() => onMessage?.(profile.id)}>
        {messagePending ? "正在发起…" : "发消息"}
      </button>
    </div>
    {/if}
    {#if messageError}<p class="profile-status error" role="alert">{messageError}</p>{/if}
    <section class="profile-info">
      <header>
        <strong>联系信息</strong>
        {#if currentUser?.id === profile.id && onEdit}
          <button type="button" class="text-action" onclick={onEdit}>编辑</button>
        {/if}
      </header>
      <div class="profile-info-row">
        <span class="info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4.1 8.1"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
            />
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </span>
        <div>
          <small>用户名</small>
          <span>{profile.handle ? handleLabel(profile.handle) : "未设置用户名"}</span>
        </div>
      </div>
      <div class="profile-info-row">
        <span class="info-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <rect x="4" y="5" width="16" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M8 10h8M8 14h5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
          </svg>
        </span>
        <div>
          <small>用户 ID</small>
          <span>{profile.id}</span>
        </div>
      </div>
      {#if profile.kind === "bot"}
        <div class="profile-info-row">
          <span class="info-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <rect x="5" y="7" width="14" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
              <path d="M12 3v4M9 12h.01M15 12h.01" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
            </svg>
          </span>
          <div>
            <small>用户类型</small>
            <span>{botLabel}</span>
          </div>
        </div>
      {/if}
    </section>
    <section class="profile-info">
      <header>
        <strong>关于</strong>
      </header>
      <p class="profile-note">{workspaceName || "此工作区"}的成员。</p>
    </section>
    {#if canModerate && moderation}
      <section class="profile-info moderation-box">
        <header>
          <strong>成员管理</strong>
          <span class="role-pill">{roleLabel}</span>
        </header>
        {#if moderation.role === "guest" && moderation.post_limit > 0}
          <p class="profile-note">今天在等候室还可发送 {moderation.posts_remaining} 条消息，共 {moderation.post_limit} 条。</p>
        {/if}
        {#if moderation.timeout_until}
          <p class="profile-note">禁言至 {new Date(moderation.timeout_until).toLocaleString("zh-CN")}。</p>
        {/if}
        {#if moderation.blocked_at}
          <p class="profile-note">已封禁。</p>
        {/if}
        <div class="moderation-actions">
          {#if moderation.role === "guest" && onApprove}
            <button type="button" class="primary-action" onclick={() => onApprove?.(profile.id)}>批准加入</button>
          {/if}
          {#if onTimeout}<button type="button" class="ghost-action" onclick={() => onTimeout?.(profile.id)}>禁言 1 小时</button>{/if}
          {#if isBlocked && onUnblock}
            <button type="button" class="ghost-action" onclick={() => onUnblock?.(profile.id)}>解除封禁</button>
          {:else if !isBlocked && onBlock}
            <button type="button" class="danger-action" onclick={() => onBlock?.(profile.id)}>封禁</button>
          {/if}
        </div>
      </section>
    {/if}
  </section>
</div>
