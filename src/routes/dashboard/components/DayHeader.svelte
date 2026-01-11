<script lang="ts">
  import { format } from "date-fns";
  import { Button } from "$lib/components/ui/button";
  import { CardHeader, CardTitle } from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Check, Clock, Loader2 } from "@lucide/svelte";

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

  let confirmDialogOpen = $state(false);

  function handleConfirm() {
    confirmDialogOpen = false;
    onconfirmday();
  }
</script>

<CardHeader class="pb-2">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <!-- Top row on mobile: Date + Total time -->
    <div class="flex items-center justify-between gap-2 sm:contents">
      <CardTitle class="flex flex-wrap items-center gap-2 text-lg sm:min-h-[35px] sm:gap-3">
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

      <!-- Total time - Mobile: inline with title, Desktop: grouped with button -->
      <div class="flex items-center gap-2 sm:order-last sm:gap-3">
        <div class="flex items-center gap-2">
          <Clock class="h-4 w-4 text-muted-foreground" />
          <span class="text-sm font-medium">{totalFormatted}</span>
        </div>

        {#if hasUnconfirmed}
          <Button
            size="sm"
            variant="outline"
            onclick={() => (confirmDialogOpen = true)}
            disabled={confirmingDay}
            class="hidden sm:inline-flex"
          >
            {#if confirmingDay}
              <Loader2 class="h-4 w-4 animate-spin" />
              Confirming...
            {:else}
              <Check class="h-4 w-4" />
              Confirm Day
            {/if}
          </Button>
        {/if}
      </div>
    </div>

    <!-- Mobile: Confirm button as full width -->
    {#if hasUnconfirmed}
      <Button
        size="sm"
        variant="outline"
        onclick={() => (confirmDialogOpen = true)}
        disabled={confirmingDay}
        class="w-full sm:hidden"
      >
        {#if confirmingDay}
          <Loader2 class="h-4 w-4 animate-spin" />
          Confirming...
        {:else}
          <Check class="h-4 w-4" />
          Confirm Day
        {/if}
      </Button>
    {/if}
  </div>
</CardHeader>

<Dialog.Root bind:open={confirmDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Confirm day</Dialog.Title>
      <Dialog.Description>
        Are you sure you want to confirm this day: {format(selectedDate, "EEEE dd.MM")}? You can't
        add more entries to this date after it has been confirmed.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (confirmDialogOpen = false)}>Cancel</Button>
      <Button onclick={handleConfirm}>OK</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
