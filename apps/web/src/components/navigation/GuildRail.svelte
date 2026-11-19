<script lang="ts">
  import { workspaceInitial } from "../../lib/chat/people";
  import { apiResourceURL } from "../../lib/api";
  import { isDefaultHomeLabel } from "../../lib/home-link";
  import type { Workspace } from "../../lib/types";
  import KeystrokeMark from "../KeystrokeMark.svelte";

  type Props = {
    workspaces: Workspace[];
    homeHref?: string;
    homeLabel?: string;
    homeTitle?: string;
    selectedWorkspaceID: string;
    workspaceName: string;
    showWorkspaceCreate: boolean;
    createPending: boolean;
    createError: string;
    hrefForWorkspace: (workspaceID: string) => string;
    onSelectWorkspace: (workspaceID: string) => void;
    onToggleWorkspaceCreate: () => void;
    onWorkspaceName: (value: string) => void;
    onCreateWorkspace: () => void;
  };

  let {
    workspaces,
    homeHref = "/",
    homeLabel = "cc",
    homeTitle = "ClickClack 首页",
    selectedWorkspaceID,
    workspaceName,
    showWorkspaceCreate,
    createPending,
    createError,
    hrefForWorkspace,
    onSelectWorkspace,
    onToggleWorkspaceCreate,
    onWorkspaceName,
    onCreateWorkspace,
  }: Props = $props();

  function shouldHandleClientNavigation(event: MouseEvent): boolean {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }
</script>

<nav id="workspace-navigation" class="guild-rail" aria-label="工作区">
  <a
    class="guild home"
    class:home--mark={isDefaultHomeLabel(homeLabel)}
    title={homeTitle}
    aria-label={homeTitle}
    href={homeHref}
  >
    {#if isDefaultHomeLabel(homeLabel)}
      <KeystrokeMark size={48} />
    {:else}
      <span>{homeLabel}</span>
    {/if}
  </a>
  <div class="guild-divider" aria-hidden="true"></div>
  <div class="guild-list">
    {#each workspaces as workspace (workspace.id)}
      <div class="guild-wrap" class:active={workspace.id === selectedWorkspaceID}>
        <a
          class="guild"
          title={workspace.name}
          aria-label={workspace.name}
          href={hrefForWorkspace(workspace.id)}
          onclick={(event) => {
            if (!shouldHandleClientNavigation(event)) return;
            event.preventDefault();
            onSelectWorkspace(workspace.id);
          }}
        >
          {#if workspace.icon_url}
            <img class="guild__image" src={apiResourceURL(workspace.icon_url)} alt="" />
          {:else}
            <span>{workspaceInitial(workspace.name)}</span>
          {/if}
        </a>
      </div>
    {/each}
    <button
      class="guild add"
      title="创建工作区"
      aria-label="创建工作区"
      onclick={onToggleWorkspaceCreate}
    >+</button>
  </div>
  {#if showWorkspaceCreate}
    <form
      class="guild-create"
      onsubmit={(event) => {
        event.preventDefault();
        onCreateWorkspace();
      }}
    >
      <input
        value={workspaceName}
        disabled={createPending}
        placeholder="工作区名称"
        aria-label="工作区名称"
        oninput={(event) => onWorkspaceName(event.currentTarget.value)}
      />
      {#if createError}<p class="profile-status error" role="alert">{createError}</p>{/if}
      {#if createPending}<p class="profile-status" role="status">正在创建工作区…</p>{/if}
    </form>
  {/if}
</nav>
