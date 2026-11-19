<script lang="ts">
  import { quoteSnippet } from "../../lib/chat/messages";
  import { userDisplayLabel } from "../../lib/chat/people";
  import type { Message } from "../../lib/types";

  type Props = {
    target: Message;
    onClear: () => void;
  };

  let { target, onClear }: Props = $props();
</script>

<div class="quote-preview" aria-label="正在回复消息">
  <span class="quote-bar" aria-hidden="true"></span>
  <span class="quote-preview-body">
    <span class="quote-preview-label">正在回复 <strong>{userDisplayLabel(target.author)}</strong></span>
    <span class="quote-preview-snippet">{quoteSnippet(target.body)}</span>
  </span>
  <button type="button" class="quote-preview-clear" aria-label="取消回复" onclick={onClear}>×</button>
</div>
