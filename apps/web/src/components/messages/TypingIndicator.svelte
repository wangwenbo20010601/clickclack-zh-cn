<script lang="ts" module>
  import type { User } from "../../lib/types";

  // Typing entries decay after this long without a re-ping. Slightly larger
  // than the sender's IDLE_MS so we don't blink off mid-pause.
  export const TYPING_TTL_MS = 6500;

  export type TypingEntry = {
    userID: string;
    user?: User;
    expiresAt: number;
  };
</script>

<script lang="ts">
  import type { User } from "../../lib/types";

  type Props = {
    entries: TypingEntry[];
    currentUserID?: string;
  };

  let { entries, currentUserID }: Props = $props();

  let visible = $derived.by(() =>
    entries.filter((entry) => entry.userID !== currentUserID),
  );

  function nameOf(user?: User, fallback = "有人"): string {
    return user?.display_name?.trim() || (user?.handle ? `@${user.handle}` : fallback);
  }

  let label = $derived.by(() => {
    if (visible.length === 0) return "";
    if (visible.length === 1) return `${nameOf(visible[0].user)} 正在输入…`;
    if (visible.length === 2)
      return `${nameOf(visible[0].user)} 和 ${nameOf(visible[1].user)} 正在输入…`;
    if (visible.length === 3)
      return `${nameOf(visible[0].user)}、${nameOf(visible[1].user)} 和 ${nameOf(visible[2].user)} 正在输入…`;
    return "多人正在输入…";
  });
</script>

<div class="typing-indicator" class:visible={visible.length > 0} aria-live="polite" aria-atomic="true">
  <span class="typing-indicator__dots" aria-hidden="true">
    <i></i><i></i><i></i>
  </span>
  <span class="typing-indicator__label">{label}</span>
</div>
