<script lang="ts">
  import { format } from "date-fns";
  import { Button } from "$lib/components/ui/button";
  import { CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Check, Clock, Loader2, Send } from "@lucide/svelte";

  interface Props {
    selectedDate: Date;
    totalFormatted: string;
    hasUnconfirmed: boolean;
    allConfirmed: boolean;
    confirmingDay: boolean;
    onconfirmday: () => void;
  }

  let {
    selectedDate,
    totalFormatted,
    hasUnconfirmed,
    allConfirmed,
    confirmingDay,
    onconfirmday
  }: Props = $props();
</script>

<CardHeader class="pb-2">
  <div class="flex items-center justify-between">
    <CardTitle class="flex items-center gap-3 text-lg">
      {format(selectedDate, "EEEE, MMMM d")}

      {#if hasUnconfirmed}
        <span
          class="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground/70"
        >
          Draft
        </span>
      {/if}
      {#if allConfirmed}
        <span
          class="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400"
        >
          <Check class="h-3 w-3" />
          Confirmed
        </span>
      {/if}
    </CardTitle>
    <div class="flex items-center gap-3">
      <div class="flex items-center gap-2">
        <Clock class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">{totalFormatted}</span>
      </div>

      {#if hasUnconfirmed}
        <Button size="sm" variant="outline" onclick={onconfirmday} disabled={confirmingDay}>
          {#if confirmingDay}
            <Loader2 class="mr-1 h-4 w-4 animate-spin" />
            Confirming...
          {:else}
            <Send class="mr-1 h-4 w-4" />
            Confirm Day
          {/if}
        </Button>
      {/if}
    </div>
  </div>
</CardHeader>
