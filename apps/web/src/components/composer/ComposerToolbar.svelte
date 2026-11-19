<script lang="ts">
  type Props = {
    showGifPicker: boolean;
    disabled?: boolean;
    onWrap: (before: string, after?: string, placeholder?: string) => void;
    onToggleGif: () => void;
  };

  let { showGifPicker, disabled = false, onWrap, onToggleGif }: Props = $props();
</script>

<div class="composer-toolbar" aria-label="消息工具">
  <button type="button" title="加粗" aria-label="加粗" {disabled} onclick={() => onWrap("**")}>
    <strong>B</strong>
  </button>
  <button type="button" title="斜体" aria-label="斜体" {disabled} onclick={() => onWrap("_")}>
    <em>I</em>
  </button>
  <button type="button" title="代码" aria-label="代码" {disabled} onclick={() => onWrap("`")}>
    <span>{`<>`}</span>
  </button>
  <button type="button" title="代码块" aria-label="代码块" {disabled} onclick={() => onWrap("\n```\n", "\n```\n", "代码")}>
    <span>{`{}`}</span>
  </button>
  <button type="button" title="链接" aria-label="链接" {disabled} onclick={() => onWrap("[", "](https://)", "链接文字")}>
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 4.93M14 11a5 5 0 0 0-7.07 0L4.81 13.12a5 5 0 0 0 7.07 7.07L13 19.07"/>
    </svg>
  </button>
  <button
    type="button"
    title="GIF 选择器"
    aria-label="GIF 选择器"
    aria-expanded={showGifPicker}
    aria-haspopup="dialog"
    class:active={showGifPicker}
    {disabled}
    onclick={onToggleGif}
  >
    GIF
  </button>
</div>
