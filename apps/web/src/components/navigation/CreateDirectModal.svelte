<script lang="ts">
  import Avatar from "../avatar/Avatar.svelte";
  import { handleLabel } from "../../lib/chat/people";
  import type { User } from "../../lib/types";

  type Props = {
    people: User[];
    currentUserID?: string;
    memberID: string;
    pending: boolean;
    error: string;
    onMemberID: (value: string) => void;
    onClose: () => void;
    onStart: (memberID: string) => void;
  };

  let { people, currentUserID, memberID, pending, error, onMemberID, onClose, onStart }: Props = $props();

  let query = $derived(memberID.trim().toLowerCase().replace(/^@/, ""));
  let choices = $derived(people
    .filter((person) => person.id !== currentUserID)
    .filter((person) => {
      if (!query) return true;
      return (
        person.display_name.toLowerCase().includes(query) ||
        person.handle?.toLowerCase().includes(query) ||
        person.id.toLowerCase().includes(query)
      );
    }));
  let recipientID = $derived(memberID.trim().startsWith("usr_")
    ? memberID.trim()
    : query && choices.length === 1 ? choices[0].id : "");

  function startRecipient(id: string) {
    if (pending || !id) return;
    // Retry the selected identity, not the search text that found it.
    onMemberID(id);
    onStart(id);
  }
</script>

<div class="modal-scrim" role="presentation">
  <button class="modal-backdrop" type="button" aria-label="关闭私聊对话框" onclick={onClose}></button>
  <section class="profile-modal create-modal" aria-label="发起私聊">
    <header>
      <div>
        <p>私聊</p>
        <h2>发起私聊</h2>
      </div>
      <button type="button" aria-label="关闭私聊对话框" onclick={onClose}>×</button>
    </header>
    <form
      class="profile-form"
      onsubmit={(event) => {
        event.preventDefault();
        startRecipient(recipientID);
      }}
    >
      <label class="field">
        <span>查找成员</span>
        <input
          value={memberID}
          disabled={pending}
          aria-label="查找成员"
          placeholder="姓名、用户名或用户 ID"
          autocomplete="off"
          oninput={(event) => onMemberID(event.currentTarget.value)}
        />
      </label>

      <div class="person-picker" aria-label="成员">
        {#each choices as person (person.id)}
          <button type="button" class="person-choice" disabled={pending} onclick={() => startRecipient(person.id)}>
            <Avatar
              class="dm-avatar"
              id={person.id}
              name={person.display_name}
              src={person.avatar_url}
              size={32}
            />
            <span>
              <strong>{person.display_name}</strong>
              <small>{handleLabel(person.handle) || person.id}</small>
            </span>
          </button>
        {/each}
        {#if choices.length === 0}
          <div class="person-empty">未找到匹配的成员</div>
        {/if}
      </div>

      {#if query && !recipientID}
        <p class="profile-status">{choices.length > 1 ? "请从搜索结果中选择成员。" : "请选择成员或输入用户 ID。"}</p>
      {/if}
      {#if error}<p class="profile-status error" role="alert">{error}</p>{/if}
      <div class="profile-actions">
        <button type="button" class="ghost-action" onclick={onClose}>取消</button>
        <button type="submit" class="primary-action" disabled={pending || !recipientID}>{pending ? "正在发起…" : "发起私聊"}</button>
      </div>
    </form>
  </section>
</div>
