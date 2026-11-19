<script lang="ts">
  import { dmTitle } from "../../lib/chat/people";
  import { channelDisplayTitle, safeExternalChannelURL } from "../../lib/chat/channels";
  import type { Channel, ChannelNotificationPreference, DirectConversation } from "../../lib/types";

  type Props = {
    selectedDirect?: DirectConversation;
    selectedChannel?: Channel;
    workspaceName?: string;
    currentUserID?: string;
    searchQuery: string;
    threadOpen: boolean;
    pinnedOpen?: boolean;
    channelNotifPreference?: ChannelNotificationPreference | null;
    channelNotifSaving?: boolean;
    channelSettingsAvailable?: boolean;
    onSearchQuery: (value: string) => void;
    onSearch: () => void;
    onResetSearch: () => void;
    onToggleThread: () => void;
    onPinnedItems: () => void;
    onOpenChannelSettings?: () => void;
    onToggleChannelNotifications?: () => void;
  };

  function notifTitle(pref: ChannelNotificationPreference): string {
    if (pref === "muted") return "频道已静音，点击更改";
    if (pref === "mentions") return "仅在被 @提及时通知，点击更改";
    return "已开启所有通知，点击更改";
  }

  let {
    selectedDirect,
    selectedChannel,
    workspaceName,
    currentUserID,
    searchQuery,
    threadOpen,
    pinnedOpen = false,
    channelNotifPreference = undefined,
    channelNotifSaving = false,
    channelSettingsAvailable = false,
    onSearchQuery,
    onSearch,
    onResetSearch,
    onToggleThread,
    onPinnedItems,
    onOpenChannelSettings = () => {},
    onToggleChannelNotifications = () => {},
  }: Props = $props();

  const externalHref = $derived(selectedDirect ? undefined : safeExternalChannelURL(selectedChannel?.external_url));
</script>

<header class="topbar">
  <div class="topbar-title">
    {#if selectedDirect}
      <h1 class="with-glyph dm">{`@${dmTitle(selectedDirect, currentUserID)}`}</h1>
    {:else if selectedChannel}
      <h1 class="with-glyph channel">{`#${channelDisplayTitle(selectedChannel)}`}</h1>
      {#if channelNotifPreference}
        <button
          type="button"
          class="notif-toggle"
          title={notifTitle(channelNotifPreference)}
          aria-label={notifTitle(channelNotifPreference)}
          aria-busy={channelNotifSaving}
          disabled={channelNotifSaving}
          onclick={onToggleChannelNotifications}
        >
          {#if channelNotifPreference === "muted"}
            <span aria-hidden="true">🔕</span>
          {:else if channelNotifPreference === "mentions"}
            <span aria-hidden="true">@</span>
          {:else}
            <span aria-hidden="true">🔔</span>
          {/if}
        </button>
      {/if}
    {:else}
      <h1 class="with-glyph">ClickClack</h1>
    {/if}
    <span class="topbar-divider" aria-hidden="true"></span>
    <p class="topbar-meta">{workspaceName || "未选择工作区"}</p>
  </div>
  <form
    class="search"
    onsubmit={(event) => {
      event.preventDefault();
      onSearch();
    }}
  >
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="m20 20-3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <input
      value={searchQuery}
      placeholder="搜索消息"
      aria-label="搜索消息"
      oninput={(event) => onSearchQuery(event.currentTarget.value)}
    />
    {#if searchQuery}
      <button type="button" class="search-clear" aria-label="清除搜索" onclick={onResetSearch}>×</button>
    {/if}
    <button type="submit" class="search-submit">搜索</button>
  </form>
  <div class="topbar-actions" aria-label="频道工具">
    {#if externalHref}
      <a href={externalHref} target="_blank" rel="noopener" title="打开外部频道" aria-label="打开外部频道">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6m0-6-9 9m7 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
        </svg>
      </a>
    {/if}
    <button
      type="button"
      title={threadOpen ? "关闭话题" : "打开消息话题"}
      aria-label={threadOpen ? "关闭话题" : "打开消息话题"}
      class:active={threadOpen}
      onclick={onToggleThread}
    >
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
        <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M21 12a8 8 0 0 1-11.6 7.16L3 21l1.84-6.4A8 8 0 1 1 21 12Z" />
      </svg>
    </button>
    {#if selectedChannel}
      <button
        type="button"
        title={pinnedOpen ? "关闭置顶消息" : "置顶消息"}
        aria-label={pinnedOpen ? "关闭置顶消息" : "置顶消息"}
        class:active={pinnedOpen}
        onclick={onPinnedItems}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m14 4 6 6-4 4v5l-2 2-5-5-4 4-1-1 4-4-5-5 2-2h5l4-4Z" />
        </svg>
      </button>
    {/if}
    {#if selectedChannel && channelSettingsAvailable}
      <button
        type="button"
        title="频道设置"
        aria-label="频道设置"
        onclick={onOpenChannelSettings}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2" />
          <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.14.38.35.73.6 1 .3.3.68.48 1.1.5h.1v4h-.1A1.7 1.7 0 0 0 19.4 15Z" />
        </svg>
      </button>
    {/if}
  </div>
</header>
