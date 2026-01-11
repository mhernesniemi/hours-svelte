<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import { cn } from "$lib/utils";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import {
    format,
    startOfWeek,
    addDays,
    getISOWeek,
    getISOWeekYear,
    isToday,
    isSameDay,
    isFuture,
    startOfDay
  } from "date-fns";
  import { formatWeekday, formatDayNumber } from "$lib/dashboard";

  interface Props {
    currentWeekStart: Date;
    selectedDate: Date;
    confirmedDays: string[];
    onnavigateweek: (direction: "prev" | "next") => void;
    onselectday: (day: Date) => void;
  }

  let { currentWeekStart, selectedDate, confirmedDays, onnavigateweek, onselectday }: Props =
    $props();

  // Derived values
  let weekNumber = $derived(getISOWeek(currentWeekStart));
  let year = $derived(getISOWeekYear(currentWeekStart));
  let currentYear = $derived(getISOWeekYear(new Date()));
  let isCurrentOrFutureWeek = $derived(
    currentWeekStart >= startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  let weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)));

  function isDayConfirmed(day: Date): boolean {
    return confirmedDays.includes(format(day, "yyyy-MM-dd"));
  }
</script>

<div class="mb-6">
  <div class="mb-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <button class="rounded-md p-2 hover:bg-accent" onclick={() => onnavigateweek("prev")}>
        <ChevronLeft class="h-4 w-4" />
      </button>
      <div class="flex items-center gap-2 text-center">
        <h1 class="text-lg font-bold">Week {weekNumber}</h1>
        {#if year !== currentYear}
          <p class="text-muted-foreground">({year})</p>
        {/if}
      </div>
      <button
        class="rounded-md p-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
        onclick={() => onnavigateweek("next")}
        disabled={isCurrentOrFutureWeek}
      >
        <ChevronRight class="h-4 w-4" />
      </button>
    </div>
  </div>

  <!-- Weekday Tabs -->
  <Tabs.Root
    value={format(selectedDate, "yyyy-MM-dd")}
    onValueChange={(val) => {
      if (val) onselectday(new Date(val));
    }}
  >
    <Tabs.List class="grid h-auto w-full grid-cols-7 gap-1 bg-transparent p-0">
      {#each weekDays as day}
        {@const dayIsFuture = isFuture(startOfDay(day))}
        {@const isConfirmed = isDayConfirmed(day)}
        <Tabs.Trigger
          value={format(day, "yyyy-MM-dd")}
          disabled={dayIsFuture}
          class={cn(
            "flex h-auto flex-col items-center rounded-lg p-2 transition-colors",
            "data-[state=inactive]:hover:bg-secondary/40",
            isToday(day) &&
              !isSameDay(day, selectedDate) &&
              "border border-dashed border-primary/30"
          )}
        >
          <span class={cn("text-xs font-medium", isConfirmed && "text-green-500")}
            >{formatWeekday(day)}</span
          >
          <span class={cn("text-lg font-bold", isConfirmed && "text-green-500")}
            >{formatDayNumber(day)}</span
          >
        </Tabs.Trigger>
      {/each}
    </Tabs.List>
  </Tabs.Root>
</div>
