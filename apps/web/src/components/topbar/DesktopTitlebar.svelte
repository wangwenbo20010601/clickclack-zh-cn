<script lang="ts">
  import { safeExternalChannelURL } from "../../lib/chat/channels";
  import type { ChannelNotificationPreference } from "../../lib/types";

  type Props = {
    channelNotifPreference?: ChannelNotificationPreference | null;
    channelNotifSaving?: boolean;
    channelSettingsAvailable?: boolean;
    channelTitle?: string;
    pinsAvailable?: boolean;
    pinnedOpen?: boolean;
    externalURL?: string;
    connected: boolean;
    mobileNavigation: boolean;
    mobileNavOpen: boolean;
    platform: string;
    searchQuery: string;
    sidebarCollapsed: boolean;
    workspaceName?: string;
    onOpenChannelSettings?: () => void;
    onOpenWorkspaceSettings: () => void;
    onResetSearch: () => void;
    onSearch: () => void;
    onSearchQuery: (value: string) => void;
    onToggleSidebar: () => void;
    onToggleChannelNotifications?: () => void;
    onPinnedItems: () => void;
  };

  function notifTitle(pref: ChannelNotificationPreference): string {
    if (pref === "muted") return "频道已静音，点击更改";
    if (pref === "mentions") return "仅在被 @提及时通知，点击更改";
    return "已开启所有通知，点击更改";
  }

  let {
    channelNotifPreference = undefined,
    channelNotifSaving = false,
    channelSettingsAvailable = false,
    channelTitle,
    pinsAvailable = false,
    pinnedOpen = false,
    externalURL,
    connected,
    mobileNavigation,
    mobileNavOpen,
    platform,
    searchQuery,
    sidebarCollapsed,
    workspaceName,
    onOpenChannelSettings = () => {},
    onOpenWorkspaceSettings,
    onResetSearch,
    onSearch,
    onSearchQuery,
    onToggleSidebar,
    onToggleChannelNotifications = () => {},
    onPinnedItems,
  }: Props = $props();

  const externalHref = $derived(safeExternalChannelURL(externalURL));
</script>

<header class="desktop-titlebar" data-platform={platform}>
  <div class="desktop-titlebar-safe-area">
    <div class="desktop-titlebar-leading">
      <button
        type="button"
        class="desktop-sidebar-toggle"
        aria-label={mobileNavigation
          ? mobileNavOpen
            ? "关闭导航"
            : "打开导航"
          : sidebarCollapsed
            ? "展开侧边栏"
            : "收起侧边栏"}
        title={mobileNavigation
          ? mobileNavOpen
            ? "关闭导航"
            : "打开导航"
          : sidebarCollapsed
            ? "展开侧边栏"
            : "收起侧边栏"}
        onclick={onToggleSidebar}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M9 4v16" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path
            d={mobileNavigation
              ? mobileNavOpen
                ? "m15 9-3 3 3 3"
                : "m9 9 3 3-3 3"
              : sidebarCollapsed
                ? "m13 9 3 3-3 3"
                : "m16 9-3 3 3 3"}
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.8"
          />
        </svg>
      </button>
      <button
        type="button"
        class="desktop-titlebar-workspace"
        aria-label="工作区设置"
        title="工作区设置"
        onclick={onOpenWorkspaceSettings}
      >
        {workspaceName || "ClickClack"}
      </button>
      {#if channelTitle}
        <span class="topbar-divider desktop-titlebar-divider" aria-hidden="true"></span>
        <h1 class="desktop-titlebar-channel with-glyph" title={channelTitle}>{channelTitle}</h1>
        {#if externalHref}
          <a class="desktop-external-link" href={externalHref} target="_blank" rel="noopener" title="打开外部频道" aria-label="打开外部频道">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6m0-6-9 9m7 0v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
            </svg>
          </a>
        {/if}
      {/if}
    </div>

    <form
      class="search desktop-titlebar-search"
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

    {#if channelNotifPreference || pinsAvailable || channelSettingsAvailable}
      <div class="desktop-titlebar-actions" aria-label="频道工具">
        {#if channelNotifPreference}
          <button
            type="button"
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
        {#if pinsAvailable}
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
        {#if channelSettingsAvailable}
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
    {/if}
    {#if !connected}
      <span class="desktop-titlebar-status" role="status">正在连接…</span>
    {/if}
  </div>
</header>
