<script lang="ts">
  import type { PlayJsonObject, PlayNodeViewProps } from "@noodlr/play-api";
  import { Button, Knob, NodeSurface } from "@noodlr/ui/play-node";

  export let context: PlayNodeViewProps<PlayJsonObject>["context"];
  export let readOnly = false;

  let enabled = true;
  let level = 96;
  // The space's tempo, the same for everyone in the room.
  let bpm = 120;
  const unsubscribe = context.state.subscribe((state) => {
    enabled = state.enabled === true;
    level = typeof state.level === "number" ? state.level : 96;
  });
  context.lifecycle.onDispose(unsubscribe);
  context.lifecycle.onDispose(
    context.transport.subscribe((snapshot) => (bpm = snapshot.bpm)),
  );
</script>

<!--
  No theme code here. NodeSurface, Button and Knob follow the host's Light or
  Dark theme on their own; our own heading only needs a --noodlr-* token.
-->
<NodeSurface
  label="Starter node"
  description="A minimal shared-state Play node"
>
  <h2>Starter node</h2>
  <p class="tempo">Space tempo {bpm} BPM</p>
  <div class="controls">
    <Button
      label="Toggle enabled"
      active={enabled}
      disabled={readOnly}
      onPress={() =>
        context.state.set("enabled", !enabled, {
          historyLabel: "Toggle Starter Node",
        })}
    >
      {enabled ? "On" : "Off"}
    </Button>
    <Knob
      label="Level"
      value={level}
      minimum={0}
      maximum={127}
      disabled={readOnly}
      onPreview={(value) => context.state.preview("level", value)}
      onCommit={(value) =>
        context.state.commit("level", value, {
          historyLabel: "Change Level",
        })}
    />
  </div>
</NodeSurface>

<style>
  h2 {
    margin: 0;
    color: var(--noodlr-text-secondary);
    font-size: 0.8rem;
  }

  .tempo {
    margin: 0;
    color: var(--noodlr-text-secondary);
    font-size: 0.75rem;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
</style>
