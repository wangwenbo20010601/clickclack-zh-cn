<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import { Virtualizer, type VirtualizerHandle } from "virtua/svelte";
  import Avatar from "../../../../../../components/avatar/Avatar.svelte";
  import {
    listWorkspaceMembersPage,
    memberLoadErrorMessage,
    MEMBERS_PAGE_LIMIT,
    type WorkspaceMember,
    type WorkspaceMemberRole,
    type WorkspaceMemberRoleCounts,
  } from "#lib/workspace-members";

  let { data } = $props();

  const ROLE_OPTIONS: { value: "" | WorkspaceMemberRole; label: string }[] = [
    { value: "", label: "所有角色" },
    { value: "owner", label: "所有者" },
    { value: "moderator", label: "管理员" },
    { value: "member", label: "成员" },
    { value: "bot", label: "机器人" },
    { value: "guest", label: "访客" },
  ];

  const ROW_HEIGHT = 64;
  const LOAD_MORE_THRESHOLD_PX = 600;
  const SEARCH_DEBOUNCE_MS = 280;

  let members = $state<WorkspaceMember[]>(untrack(() => data.members));
  let nextCursor = $state(untrack(() => data.nextCursor));
  let hasMore = $state(untrack(() => data.hasMore));
  let totalCount = $state<number | undefined>(untrack(() => data.totalCount));
  let totalByRole = $state<WorkspaceMemberRoleCounts | undefined>(untrack(() => data.totalByRole));
  let loadError = $state(untrack(() => data.loadError));
  let loadedWorkspaceID = $state(untrack(() => data.workspaceID));
  let searchInput = $state("");
  let activeQuery = $state("");
  let activeRole = $state<"" | WorkspaceMemberRole>("");
  let isLoadingInitial = $state(false);
  let isLoadingMore = $state(false);
  let listRevision = $state(0);
  let virtualizer: VirtualizerHandle | undefined = $state();

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let activeFetchID = 0;

  function isFiltering() {
    return activeQuery.length > 0 || activeRole !== "";
  }

  function resetMemberListViewport() {
    listRevision++;
    virtualizer = undefined;
  }

  $effect(() => {
    if (data.workspaceID === loadedWorkspaceID) return;
    if (searchTimer) {
      clearTimeout(searchTimer);
      searchTimer = undefined;
    }
    activeFetchID++;
    resetMemberListViewport();
    loadedWorkspaceID = data.workspaceID;
    members = data.members;
    nextCursor = data.nextCursor;
    hasMore = data.hasMore;
    totalCount = data.totalCount;
    totalByRole = data.totalByRole;
    loadError = data.loadError;
    searchInput = "";
    activeQuery = "";
    activeRole = "";
    isLoadingInitial = false;
    isLoadingMore = false;
  });

  async function refetchFromStart() {
    const fetchID = ++activeFetchID;
    resetMemberListViewport();
    isLoadingInitial = true;
    isLoadingMore = false;
    loadError = "";
    totalCount = undefined;
    totalByRole = undefined;
    try {
      const page = await listWorkspaceMembersPage({
        workspaceID: data.workspaceID,
        limit: MEMBERS_PAGE_LIMIT,
        query: activeQuery,
        role: activeRole,
      });
      if (fetchID !== activeFetchID) return;
      members = page.members;
      nextCursor = page.next_cursor ?? "";
      hasMore = page.has_more;
      totalCount = page.total_count ?? totalCount;
      totalByRole = page.total_by_role;
    } catch (err) {
      if (fetchID !== activeFetchID) return;
      loadError = memberLoadErrorMessage(err);
      members = [];
      nextCursor = "";
      hasMore = false;
      totalByRole = undefined;
    } finally {
      if (fetchID === activeFetchID) isLoadingInitial = false;
    }
  }

  async function loadMore() {
    if (isLoadingMore || isLoadingInitial || !hasMore || !nextCursor) return;
    const fetchID = activeFetchID;
    isLoadingMore = true;
    try {
      const page = await listWorkspaceMembersPage({
        workspaceID: data.workspaceID,
        limit: MEMBERS_PAGE_LIMIT,
        cursor: nextCursor,
        query: activeQuery,
        role: activeRole,
      });
      if (fetchID !== activeFetchID) return;
      members = [...members, ...page.members];
      nextCursor = page.next_cursor ?? "";
      hasMore = page.has_more;
    } catch (err) {
      if (fetchID !== activeFetchID) return;
      loadError = memberLoadErrorMessage(err);
      hasMore = false;
    } finally {
      if (fetchID === activeFetchID) isLoadingMore = false;
    }
  }

  function onSearchInput(event: Event) {
    searchInput = (event.target as HTMLInputElement).value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === activeQuery) return;
      activeQuery = trimmed;
      void refetchFromStart();
    }, SEARCH_DEBOUNCE_MS);
  }

  function onRoleChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as "" | WorkspaceMemberRole;
    if (value === activeRole) return;
    activeRole = value;
    void refetchFromStart();
  }

  function handleScroll() {
    if (!virtualizer || !hasMore || isLoadingMore) return;
    const distanceFromBottom =
      virtualizer.getScrollSize() -
      virtualizer.getScrollOffset() -
      virtualizer.getViewportSize();
    if (distanceFromBottom <= LOAD_MORE_THRESHOLD_PX) {
      void loadMore();
    }
  }

  onDestroy(() => {
    if (searchTimer) clearTimeout(searchTimer);
    activeFetchID++;
  });

  function formatHandle(handle: string): string {
    if (!handle) return "";
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  function formatJoined(value: string): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
  }

  function roleLabel(role: WorkspaceMemberRole): string {
    return ({ owner: "所有者", moderator: "管理员", member: "成员", bot: "机器人", guest: "访客" })[role];
  }

  function formatCount(value: number, label: string): string {
    return `${value} ${label}`;
  }

  const countLabel = $derived.by(() => {
    if (isLoadingInitial) return "正在加载…";
    if (isFiltering()) {
      if (totalCount != null) {
        return formatCount(totalCount, "个匹配结果");
      }
      const noun = "个匹配结果";
      return hasMore ? `${members.length}+ ${noun}` : `${members.length} ${noun}`;
    }
    if (totalCount != null) {
      const parts = [formatCount(totalCount, "位成员")];
      if (totalByRole?.owner) parts.push(formatCount(totalByRole.owner, "位所有者"));
      if (totalByRole?.moderator) parts.push(formatCount(totalByRole.moderator, "位管理员"));
      return parts.join(" · ");
    }
    return `${members.length}${hasMore ? "+" : ""} 位成员`;
  });

  const showEmptyState = $derived(
    !isLoadingInitial && members.length === 0 && !loadError && !isFiltering(),
  );
  const showNoMatches = $derived(
    !isLoadingInitial && members.length === 0 && !loadError && isFiltering(),
  );
</script>

<div class="ws-members-page">
  <header class="ws-page__header ws-members-page__header">
    <h1 class="ws-page__h1">成员</h1>
    <p class="ws-page__lead">所有有权访问此工作区的人。</p>
  </header>

  <div class="ws-members__toolbar">
    <div class="ws-members__count">{countLabel}</div>

    <div class="ws-members__controls">
      <div class="ws-members__search">
        <span class="ws-members__search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
        </span>
        <input
          class="ws-members__search-input"
          type="search"
          placeholder="搜索姓名或用户名"
          value={searchInput}
          oninput={onSearchInput}
          aria-label="搜索成员"
        />
      </div>

      <select
        class="ws-members__role-select"
        value={activeRole}
        onchange={onRoleChange}
        aria-label="按角色筛选"
      >
        {#each ROLE_OPTIONS as option (option.value)}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>

      <button class="ws-btn ws-btn--primary" type="button" disabled title="暂不支持邀请">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        邀请成员
      </button>
    </div>
  </div>

  {#if loadError}
    <div class="ws-settings__error">{loadError}</div>
  {:else if showEmptyState}
    <div class="ws-members__empty">
      这里还没有成员。邀请队友加入，开始使用此工作区。
    </div>
  {:else if showNoMatches}
    <div class="ws-members__empty">
      没有符合搜索条件的成员。请尝试其他关键词或筛选条件。
    </div>
  {:else}
    <div class="ws-members__list" aria-busy={isLoadingInitial}>
    {#if isLoadingInitial && members.length === 0}
      {#each Array(8) as _, i (i)}
        <div class="ws-members__row ws-members__row--skeleton">
          <div class="ws-members__avatar ws-members__skeleton"></div>
          <div class="ws-members__main">
            <div class="ws-members__skeleton ws-members__skeleton--line" style="width: 38%"></div>
            <div class="ws-members__skeleton ws-members__skeleton--line" style="width: 62%"></div>
          </div>
          <div class="ws-members__skeleton ws-members__skeleton--pill"></div>
        </div>
      {/each}
    {:else}
      {#key listRevision}
        <Virtualizer
          bind:this={virtualizer}
          data={members}
          getKey={(m: WorkspaceMember) => m.user.id}
          itemSize={ROW_HEIGHT}
          onscroll={handleScroll}
        >
          {#snippet children(member: WorkspaceMember, _index: number)}
            <div class="ws-members__row" style="height: {ROW_HEIGHT}px">
              <span aria-hidden="true">
                <Avatar
                  id={member.user.id}
                  name={member.user.display_name?.trim() || member.user.handle?.trim() || member.user.id}
                  src={member.user.avatar_url}
                  size={36}
                  class="ws-members__avatar ws-members__avatar--{member.user.kind === 'bot' ? 'bot' : 'human'}"
                />
              </span>
              <div class="ws-members__main">
                <div class="ws-members__name">{member.user.display_name || "未知"}</div>
                <div class="ws-members__meta">
                  <span class="ws-members__handle">{formatHandle(member.user.handle)}</span>
                  {#if member.joined_at}
                    <span class="ws-members__dot" aria-hidden="true">·</span>
                    <span>加入于 {formatJoined(member.joined_at)}</span>
                  {/if}
                </div>
              </div>
              <span class="ws-members__pill ws-members__pill--{member.role}">{roleLabel(member.role)}</span>
              <button
                class="ws-members__actions"
                type="button"
                disabled
                aria-label="成员操作"
                title="即将推出"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                </svg>
              </button>
            </div>
          {/snippet}
        </Virtualizer>
      {/key}
    {/if}

    {#if isLoadingMore}
      <div class="ws-members__loading">正在加载更多…</div>
    {/if}
  </div>
  {/if}
</div>
