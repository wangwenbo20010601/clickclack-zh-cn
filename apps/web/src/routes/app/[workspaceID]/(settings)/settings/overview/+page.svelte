<script lang="ts">
  import { goto, invalidateAll } from "$app/navigation";
  import { api, apiResourceURL, APIError } from "#lib/api";
  import { isWorkspaceManager } from "#lib/permissions";
  import type { Upload, Workspace } from "#lib/types";
  import {
    listAllWorkspaceMembers,
    type WorkspaceMember,
  } from "#lib/workspace-members";

  let { data } = $props();
  const workspace = $derived(data.workspace);
  const isOwner = $derived((workspace?.role ?? "") === "owner");
  const isManager = $derived(isWorkspaceManager(workspace?.role));
  const initial = $derived((workspace?.name ?? "?").slice(0, 1).toUpperCase());

  let name = $state("");
  let slug = $state("");
  let status = $state("");
  let error = $state("");
  let saving = $state(false);
  let iconInput: HTMLInputElement | undefined = $state();
  let transferMembers = $state<WorkspaceMember[]>([]);
  let transferLoadedFor = $state("");
  let transferUserID = $state("");
  let transferring = $state(false);
  let deleteConfirm = $state("");
  let deleting = $state(false);
  const hasProfileChanges = $derived(
    !!workspace && (name.trim() !== workspace.name || slug.trim() !== workspace.slug),
  );
  const canSaveProfile = $derived(isManager && hasProfileChanges && !saving);
  const canTransfer = $derived(isOwner && transferUserID !== "" && !transferring);
  const noTransferMembers = $derived(
    !!workspace && transferLoadedFor === workspace.id && transferMembers.length === 0,
  );
  const canDelete = $derived(isOwner && workspace && deleteConfirm === workspace.name && !deleting);

  $effect(() => {
    if (!workspace) return;
    name = workspace.name;
    slug = workspace.slug;
    deleteConfirm = "";
    status = "";
    error = "";
  });

  $effect(() => {
    if (!isOwner || !workspace || transferLoadedFor === workspace.id) return;
    const controller = new AbortController();
    transferMembers = [];
    transferUserID = "";
    void loadTransferMembers(workspace.id, controller.signal);
    return () => controller.abort();
  });

  function capitalize(value: string | undefined): string {
    if (!value) return "-";
    return ({ owner: "所有者", moderator: "管理员", member: "成员", guest: "访客", bot: "机器人" } as Record<string, string>)[value] ?? value;
  }

  function errorMessage(err: unknown): string {
    if (err instanceof APIError) {
      try {
        const parsed = JSON.parse(err.message) as { error?: string };
        if (parsed.error) return parsed.error;
      } catch {
        return err.message;
      }
    }
    return err instanceof Error ? err.message : "出现错误";
  }

  async function updateWorkspace(body: Partial<Pick<Workspace, "name" | "slug" | "icon_url">>) {
    if (!workspace) return;
    const result = await api<{ workspace: Workspace }>(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    await invalidateAll();
    return result.workspace;
  }

  async function saveProfile() {
    if (!workspace || !canSaveProfile) return;
    saving = true;
    status = "";
    error = "";
    try {
      await updateWorkspace({ name: name.trim(), slug: slug.trim() });
      status = "工作区已更新。";
    } catch (err) {
      error = errorMessage(err);
    } finally {
      saving = false;
    }
  }

  function chooseIcon() {
    iconInput?.click();
  }

  async function handleIconChange(event: Event) {
    if (!workspace) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      error = "工作区图标必须是图片。";
      return;
    }
    saving = true;
    status = "";
    error = "";
    try {
      const form = new FormData();
      form.set("workspace_id", workspace.id);
      form.set("file", file);
      const uploaded = await api<{ upload: Upload }>("/api/uploads", { method: "POST", body: form });
      const update: Partial<Pick<Workspace, "name" | "slug" | "icon_url">> = {
        icon_url: `/api/uploads/${uploaded.upload.id}`,
      };
      if (name.trim() !== workspace.name) update.name = name.trim();
      if (slug.trim() !== workspace.slug) update.slug = slug.trim();
      await updateWorkspace(update);
      status = "工作区图标已更新。";
    } catch (err) {
      error = errorMessage(err);
    } finally {
      saving = false;
    }
  }

  async function loadTransferMembers(workspaceID: string, signal: AbortSignal) {
    try {
      const members = await listAllWorkspaceMembers({ workspaceID, limit: 200, signal });
      if (signal.aborted || workspace?.id !== workspaceID) return;
      transferMembers = members.filter(
        (member) =>
          member.user.kind === "human" &&
          member.role !== "owner" &&
          member.role !== "guest" &&
          member.role !== "bot",
      );
      transferUserID = transferMembers[0]?.user.id ?? "";
      transferLoadedFor = workspaceID;
    } catch (err) {
      if (!signal.aborted && workspace?.id === workspaceID) error = errorMessage(err);
    }
  }

  async function transferOwnership() {
    if (!workspace || !canTransfer) return;
    transferring = true;
    status = "";
    error = "";
    try {
      await api<{ workspace: Workspace }>(`/api/workspaces/${workspace.id}/transfer-ownership`, {
        method: "POST",
        body: JSON.stringify({ user_id: transferUserID }),
      });
      await invalidateAll();
      status = "所有权已转移。";
    } catch (err) {
      error = errorMessage(err);
    } finally {
      transferring = false;
    }
  }

  async function deleteWorkspace() {
    if (!workspace || !canDelete) return;
    deleting = true;
    status = "";
    error = "";
    try {
      await api(`/api/workspaces/${workspace.id}`, { method: "DELETE" });
      await goto("/app", { invalidateAll: true, replaceState: true });
    } catch (err) {
      error = errorMessage(err);
      deleting = false;
    }
  }
</script>

<header class="ws-page__header">
  <h1 class="ws-page__h1">概览</h1>
  <p class="ws-page__lead">
    设置 {workspace?.name ?? "此工作区"} 向成员和接入的机器人展示的信息。
  </p>
</header>

<div class="ws-strip" aria-label="当前工作区">
  <span class="ws-strip__avatar">
    {#if workspace?.icon_url}
      <img src={apiResourceURL(workspace.icon_url)} alt="" />
    {:else}
      {initial}
    {/if}
  </span>
  <span class="ws-strip__name">{workspace?.name ?? "-"}</span>
  <span class="ws-strip__pill ws-strip__pill--{workspace?.role ?? 'member'}">{capitalize(workspace?.role)}</span>
</div>

<div class="ws-section">
  <div class="ws-row">
    <div class="ws-row__main">
      <div class="ws-row__label">工作区名称</div>
      <div class="ws-row__hint">成员和机器人看到的名称。</div>
    </div>
    <input aria-label="工作区名称" class="ws-input" type="text" bind:value={name} disabled={!isManager || saving} />
  </div>

  <div class="ws-row">
    <div class="ws-row__main">
      <div class="ws-row__label">URL 标识</div>
      <div class="ws-row__hint">
        clickclack.app/<b>{workspace?.slug ?? "-"}</b>
      </div>
    </div>
    <input aria-label="工作区 URL 标识" class="ws-input" type="text" bind:value={slug} disabled={!isManager || saving} />
  </div>

  <div class="ws-row">
    <div class="ws-row__main">
      <div class="ws-row__label">工作区图标</div>
      <div class="ws-row__hint">显示在工作区切换器和提及中。</div>
    </div>
    <div class="ws-row__control">
      <input
        bind:this={iconInput}
        class="ws-file"
        type="file"
        aria-label="工作区图标文件"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onchange={handleIconChange}
      />
      <button class="ws-btn" type="button" disabled={!isManager || saving} onclick={chooseIcon}>
        上传图标
      </button>
    </div>
  </div>

  {#if isManager}
    <div class="ws-actions">
      <p class="ws-status" class:is-error={!!error}>{error || status}</p>
      <button class="ws-btn ws-btn--primary" type="button" disabled={!canSaveProfile} onclick={saveProfile}>
        {saving ? "正在保存…" : "保存更改"}
      </button>
    </div>
  {/if}
</div>

{#if isManager}
  <div class="ws-section">
    <h3 class="ws-section__h">危险操作</h3>

    {#if isOwner}
      <div class="ws-row">
        <div class="ws-row__main">
          <div class="ws-row__label">转移所有权</div>
          <div class="ws-row__hint">
            将 {workspace?.name ?? "此工作区"} 的所有权转移给其他成员。
            {#if noTransferMembers}
              请先添加一位非访客的真人成员。
            {/if}
          </div>
        </div>
        <div class="ws-row__control">
          <select
            class="ws-select"
            aria-label="工作区新所有者"
            bind:value={transferUserID}
            disabled={transferring || transferMembers.length === 0}
          >
            {#if noTransferMembers}
              <option value="">没有符合条件的成员</option>
            {/if}
            {#each transferMembers as member (member.user.id)}
              <option value={member.user.id}>{member.user.display_name || member.user.handle || member.user.id}</option>
            {/each}
          </select>
          <button class="ws-btn" type="button" disabled={!canTransfer} onclick={transferOwnership}>
            {transferring ? "正在转移…" : "转移"}
          </button>
        </div>
      </div>

      <div class="ws-row">
        <div class="ws-row__main">
          <div class="ws-row__label">删除工作区</div>
          <div class="ws-row__hint">
            永久删除 {workspace?.name ?? "此工作区"} 及其所有消息、频道和机器人令牌。此操作无法撤销。请输入工作区名称以确认。
          </div>
        </div>
        <div class="ws-row__control">
          <input
            aria-label="输入名称以确认删除"
            class="ws-input"
            type="text"
            placeholder={workspace?.name ?? "工作区名称"}
            bind:value={deleteConfirm}
            disabled={deleting}
          />
          <button class="ws-btn ws-btn--danger" type="button" disabled={!canDelete} onclick={deleteWorkspace}>
            {deleting ? "正在删除…" : "删除工作区"}
          </button>
        </div>
      </div>
    {:else}
      <div class="ws-row">
        <div class="ws-row__main">
          <div class="ws-row__label">仅所有者可执行的操作</div>
          <div class="ws-row__hint">
            仅工作区所有者可以转移所有权或删除工作区。
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}
