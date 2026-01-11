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
    oncopy: () => void;
    onedit: () => void;
    ondelete: () => void;
  }

  let { entry, isDeleting = false, oncopy, onedit, ondelete }: Props = $props();
</script>

<div
  class="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
>
  <!-- Top Row on Mobile: Time + Actions -->
  <div class="flex items-center justify-between gap-2 sm:contents">
    <!-- Time Column -->
    <div class="shrink-0 sm:w-28">
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

    <!-- Actions - Mobile: inline with time, Desktop: at the end -->
    {#if entry.status === "draft"}
      <div class="flex shrink-0 gap-1 sm:order-last">
        <Button variant="ghost" size="icon" onclick={oncopy} class="opacity-80 hover:opacity-100">
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
          class="opacity-80 hover:opacity-100"
        >
          <Trash2 class="h-4 w-4" />
        </Button>
      </div>
    {/if}
  </div>

  <!-- Content Column -->
  <div class="min-w-0 flex-1">
    <p class="text-sm font-medium text-primary">
      {entry.description || "No description"}
    </p>
    {#if entry.phase}
      <p class="mt-1 text-xs text-muted-foreground sm:mt-2">
        {entry.phase.case.customer.name} / {entry.phase.case.name} / {entry.phase.name}
      </p>
    {/if}
  </div>
</div>
