<script lang="ts">
  // Lightweight "the agent is working" status line. Distinct from
  // TypingIndicator (human typing) and AgentProgress (per-step tool/thinking
  // detail): this is the single high-level signal that an agent turn is live.
  type Props = {
    active: boolean;
    agentNames?: string[];
  };

  let { active, agentNames = [] }: Props = $props();

  let label = $derived.by(() => {
    if (agentNames.length === 1) return `${agentNames[0]} 正在回复…`;
    if (agentNames.length === 2)
      return `${agentNames[0]} 和 ${agentNames[1]} 正在回复…`;
    if (agentNames.length > 2) return "多个机器人正在回复…";
    return "机器人正在回复…";
  });
</script>

{#if active}
  <div class="typing-indicator agent-responding visible" aria-live="polite" aria-atomic="true">
    <span class="typing-indicator__dots" aria-hidden="true">
      <i></i><i></i><i></i>
    </span>
    <span class="typing-indicator__label">{label}</span>
  </div>
{/if}
