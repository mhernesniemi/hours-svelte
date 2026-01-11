<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Copy, Edit, Trash2 } from "@lucide/svelte";
  import { formatTime, formatDuration } from "$lib/dashboard";
  import { cn } from "$lib/utils";

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
    errorField?: string | null;
    oncopy: () => void;
    onedit: () => void;
    ondelete: () => void;
  }

  let { entry, isDeleting = false, errorField = null, oncopy, onedit, ondelete }: Props = $props();
</script>

<div
  class="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
>
  <!-- Top Row on Mobile: Time + Actions -->
  <div class="flex items-center justify-between gap-2 sm:contents">
    <!-- Time Column -->
    <div
      class={cn(
        "shrink-0 rounded px-1 -mx-1 sm:w-28",
        errorField === "endTime" && "bg-destructive/10"
      )}
    >
      <div class="font-mono text-sm font-medium">
        {formatTime(entry.startTime)}
        {#if entry.endTime}
          <span class="text-muted-foreground"> – </span>{formatTime(entry.endTime)}
        {:else}
          <span class={cn("text-muted-foreground", errorField === "endTime" && "text-destructive")}> ongoing</span>
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
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                onclick={oncopy}
                class="opacity-80 hover:opacity-100"
              >
                <Copy class="h-4 w-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Copy entry</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                onclick={onedit}
                class="opacity-80 hover:opacity-100"
              >
                <Edit class="h-4 w-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Edit entry</Tooltip.Content>
        </Tooltip.Root>

        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                variant="ghost"
                size="icon"
                onclick={ondelete}
                disabled={isDeleting}
                class="opacity-80 hover:opacity-100"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Delete entry</Tooltip.Content>
        </Tooltip.Root>
      </div>
    {/if}
  </div>

  <!-- Content Column -->
  <div class="min-w-0 flex-1">
    <p
      class={cn(
        "text-sm font-medium text-primary rounded px-1 -mx-1",
        errorField === "description" && "bg-destructive/10 text-destructive"
      )}
    >
      {entry.description || "No description"}
    </p>
    {#if entry.phase}
      <p
        class={cn(
          "mt-1 text-xs text-muted-foreground sm:mt-2 rounded px-1 -mx-1",
          (errorField === "phase" || errorField === "worktype") && "bg-destructive/10 text-destructive"
        )}
      >
        {entry.phase.case.customer.name} / {entry.phase.case.name} / {entry.phase.name}
      </p>
    {/if}
  </div>
</div>
