<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Copy, Edit, Trash2 } from "@lucide/svelte";
  import { formatTime, formatDuration } from "$lib/dashboard";

  type Entry = {
    id: number;
    startTime: Date | string;
    endTime: Date | string | null;
    description: string | null;
    status: string;
    phase?: {
      name: string;
      case: {
        name: string;
        customer: {
          name: string;
        };
      };
    } | null;
  };

  interface Props {
    entry: Entry;
    isDeleting?: boolean;
    onedit: () => void;
    ondelete: () => void;
  }

  let { entry, isDeleting = false, onedit, ondelete }: Props = $props();
</script>

<div class="flex items-start justify-between gap-12 py-3 first:pt-0">
  <!-- Time Column -->
  <div class="w-28 shrink-0">
    <div class="font-mono text-sm font-medium">
      {formatTime(entry.startTime)}
      {#if entry.endTime}
        <span class="text-muted-foreground"> – </span>{formatTime(entry.endTime)}
      {:else}
        <span class="text-muted-foreground"> ongoing</span>
      {/if}
    </div>
    {#if entry.endTime}
      <div class="mt-0.5 font-mono text-xs text-muted-foreground">
        {formatDuration(entry.startTime, entry.endTime)}
      </div>
    {/if}
  </div>

  <!-- Content Column -->
  <div class="min-w-0 flex-1">
    <p class="text-sm font-medium text-primary">
      {entry.description || "No description"}
    </p>
    {#if entry.phase}
      <p class="mt-2 text-xs text-muted-foreground">
        {entry.phase.case.customer.name} / {entry.phase.case.name} / {entry.phase.name}
      </p>
    {/if}
  </div>

  <!-- Actions -->
  {#if entry.status === "draft"}
    <div class="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" class="opacity-80 hover:opacity-100">
        <Copy class="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onclick={onedit} class="opacity-80 hover:opacity-100">
        <Edit class="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onclick={ondelete}
        disabled={isDeleting}
        class="opacity-80 hover:opacity-100 "
      >
        <Trash2 class="h-4 w-4" />
      </Button>
    </div>
  {/if}
</div>
