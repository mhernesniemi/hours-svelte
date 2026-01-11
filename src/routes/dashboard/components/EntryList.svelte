<script lang="ts" generics="T extends { id: number }">
  import type { Snippet } from "svelte";

  interface Props {
    entries: T[];
    children: Snippet<[T]>;
    empty?: Snippet;
  }

  let { entries, children, empty }: Props = $props();
</script>

{#if entries.length > 0}
  <div class="divide-y divide-border">
    {#each entries as entry (entry.id)}
      {@render children(entry)}
    {/each}
  </div>
{:else if empty}
  {@render empty()}
{/if}
