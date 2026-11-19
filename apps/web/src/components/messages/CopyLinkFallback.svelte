<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { portal } from "../../lib/actions/portal";

  let {
    url,
    onClose,
    returnFocus,
  }: {
    url: string;
    onClose: () => void;
    returnFocus?: HTMLElement;
  } = $props();

  let scrimRef = $state<HTMLDivElement>();
  let inputRef = $state<HTMLInputElement>();
  const inertSiblings = new Set<HTMLElement>();

  function handleKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    onClose();
  }

  function selectURL() {
    inputRef?.focus({ preventScroll: true });
    inputRef?.select();
  }

  onMount(() => {
    const parent = scrimRef?.parentElement;
    if (parent) {
      for (const sibling of parent.children) {
        if (!(sibling instanceof HTMLElement) || sibling === scrimRef || sibling.inert) continue;
        sibling.inert = true;
        inertSiblings.add(sibling);
      }
    }
    selectURL();
  });

  onDestroy(() => {
    for (const sibling of inertSiblings) sibling.inert = false;
    inertSiblings.clear();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
</script>

<div
  bind:this={scrimRef}
  class="copy-link-scrim"
  role="presentation"
  use:portal
  onkeydown={handleKeydown}
>
  <button
    type="button"
    class="copy-link-backdrop"
    tabindex="-1"
    aria-label="关闭手动复制链接窗口"
    onclick={onClose}
  ></button>
  <div
    class="copy-link-dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="copy-link-title"
    tabindex="-1"
  >
    <h2 id="copy-link-title">复制消息链接</h2>
    <p>浏览器阻止了剪贴板访问，请复制下方选中的链接。</p>
    <input
      bind:this={inputRef}
      value={url}
      readonly
      aria-label="消息链接"
      onclick={selectURL}
    />
    <button type="button" onclick={onClose}>完成</button>
  </div>
</div>

<style>
  .copy-link-scrim {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: grid;
    place-items: center;
    padding: 20px;
  }
  .copy-link-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: rgba(4, 7, 12, 0.72);
  }
  .copy-link-dialog {
    position: relative;
    width: min(520px, 100%);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    background: var(--panel);
    box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
  }
  h2 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  p {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 13px;
  }
  input {
    box-sizing: border-box;
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    color: var(--text);
    background: var(--input);
    font: inherit;
  }
  .copy-link-dialog button {
    display: block;
    margin: 14px 0 0 auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 16px;
    color: var(--text);
    background: var(--surface);
    cursor: pointer;
  }
</style>
