<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { listMyBots, botLoadErrorMessage, type OwnedBotEntry } from "../../lib/bots";
  import { workspaceSettingsPath } from "../../lib/settings";

  type Props = {
    onClose: () => void;
  };

  let { onClose }: Props = $props();

  let bots = $state<OwnedBotEntry[]>([]);
  let status = $state<"loading" | "ready" | "error">("loading");
  let error = $state("");

  onMount(() => {
    void refresh();
  });

  async function refresh() {
    status = "loading";
    try {
      bots = await listMyBots();
      status = "ready";
    } catch (err) {
      status = "error";
      error = botLoadErrorMessage(err);
    }
  }

  function openWorkspaceBots(entry: OwnedBotEntry) {
    onClose();
    void goto(workspaceSettingsPath(entry.workspace.route_id || entry.workspace.id, "bots"));
  }

  function formatHandle(handle: string): string {
    return handle.startsWith("@") ? handle : `@${handle}`;
  }

  function initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }

  type Group = { workspace: OwnedBotEntry["workspace"]; entries: OwnedBotEntry[] };

  const groups = $derived.by<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const entry of bots) {
      const key = entry.workspace.id;
      const existing = map.get(key);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(key, { workspace: entry.workspace, entries: [entry] });
      }
    }
    return [...map.values()].sort((a, b) => a.workspace.name.localeCompare(b.workspace.name));
  });
</script>

<header class="settings-page__header">
  <p class="settings-page__eyebrow">账户</p>
  <h2 class="settings-page__h1">我的机器人</h2>
  <p class="settings-page__lead">
    你在各工作区拥有的机器人。令牌归属于创建机器人的工作区。
  </p>
</header>

{#if status === "loading"}
  <p class="settings-status">正在加载…</p>
{:else if status === "error"}
  <p class="settings-status is-error">{error}</p>
{:else if bots.length === 0}
  <div class="ws-bots__empty">
    你还没有机器人。打开工作区的“机器人与智能体”页面即可创建。
  </div>
{:else}
  <div class="ws-bots__my-list">
    {#each groups as group (group.workspace.id)}
      <section class="ws-bots__my-group">
        <header class="ws-bots__my-group-header">
          <h3 class="ws-bots__my-group-title">{group.workspace.name}</h3>
          <button
            type="button"
            class="ws-btn"
            onclick={() => openWorkspaceBots(group.entries[0]!)}
          >
            在工作区中管理
          </button>
        </header>
        <ul class="ws-bots__my-rows">
          {#each group.entries as entry (entry.bot.id)}
            <li class="ws-bots__my-row">
              <span
                class="ws-members__avatar ws-members__avatar--bot"
                aria-hidden="true"
              >
                {#if entry.bot.avatar_url}
                  <img src={entry.bot.avatar_url} alt="" />
                {:else}
                  {initials(entry.bot.display_name || entry.bot.handle || "?")}
                {/if}
              </span>
              <div class="ws-bots__my-row-text">
                <div class="ws-bots__my-row-name">{entry.bot.display_name || entry.bot.handle}</div>
                <div class="ws-bots__my-row-meta">
                  <code class="ws-members__handle">{formatHandle(entry.bot.handle)}</code>
                  <span class="ws-members__dot" aria-hidden="true">·</span>
                  <span>
                    {entry.active_token_count}
                    个有效令牌
                  </span>
                </div>
              </div>
              <button
                type="button"
                class="ws-btn"
                onclick={() => openWorkspaceBots(entry)}
              >
                打开
              </button>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>
{/if}
