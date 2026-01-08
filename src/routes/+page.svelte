<script lang="ts">
  import { getMonthEntries, confirmDayEntries, deleteEntry, getCurrentUser } from "$lib/remote";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import {
    Plus,
    ChevronLeft,
    ChevronRight,
    Check,
    Clock,
    Trash2,
    Edit,
    AlertCircle
  } from "@lucide/svelte";
  import { format, addMonths, subMonths, startOfMonth, parseISO } from "date-fns";

  // Auth state
  let user = $state<Awaited<ReturnType<typeof getCurrentUser>> | undefined>(undefined);
  let authChecked = $state(false);

  // Check authentication on mount
  $effect(() => {
    getCurrentUser({}).then((u) => {
      user = u;
      authChecked = true;
      if (!u) {
        goto("/login");
      }
    });
  });

  // Current month state
  let currentDate = $state(startOfMonth(new Date()));

  // Derived month info
  let year = $derived(currentDate.getFullYear());
  let month = $derived(currentDate.getMonth() + 1);

  // Load entries for current month
  let entriesPromise = $derived(getMonthEntries({ year, month }));

  // Track confirmation loading state
  let confirmingDay = $state<string | null>(null);
  let deletingEntry = $state<number | null>(null);
  let error = $state("");

  function navigateMonth(direction: "prev" | "next") {
    currentDate = direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1);
  }

  async function handleConfirmDay(dateStr: string) {
    error = "";
    confirmingDay = dateStr;

    try {
      const result = await confirmDayEntries({ date: parseISO(dateStr) });
      if (!result.success) {
        error = result.error || "Failed to confirm day";
      } else {
        // Refresh data
        entriesPromise = getMonthEntries({ year, month });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to confirm day";
    } finally {
      confirmingDay = null;
    }
  }

  async function handleDeleteEntry(entryId: number) {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    error = "";
    deletingEntry = entryId;

    try {
      const result = await deleteEntry({ entryId });
      if (!result.success) {
        error = result.error || "Failed to delete entry";
      } else {
        entriesPromise = getMonthEntries({ year, month });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete entry";
    } finally {
      deletingEntry = null;
    }
  }

  function formatTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "HH:mm");
  }

  function formatDate(dateStr: string): string {
    return format(parseISO(dateStr), "EEEE, MMM d");
  }
</script>

<svelte:head>
  <title>Hours - Inside</title>
</svelte:head>

{#if !authChecked}
  <div class="flex min-h-[50vh] items-center justify-center">
    <div class="text-muted-foreground">Loading...</div>
  </div>
{:else if user}
  <div class="mx-auto max-w-5xl p-4">
    <!-- Month Navigation -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold">{format(currentDate, "MMMM yyyy")}</h1>
        <div class="flex gap-1">
          <Button variant="outline" size="icon" onclick={() => navigateMonth("prev")}>
            <ChevronLeft class="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onclick={() => navigateMonth("next")}>
            <ChevronRight class="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onclick={() => (currentDate = startOfMonth(new Date()))}
          >
            Today
          </Button>
        </div>
      </div>

      <Button onclick={() => goto("/entry/new")}>
        <Plus class="mr-2 h-4 w-4" />
        Add Entry
      </Button>
    </div>

    {#if error}
      <div
        class="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
      >
        <AlertCircle class="h-4 w-4" />
        {error}
      </div>
    {/if}

    {#await entriesPromise}
      <div class="flex min-h-[30vh] items-center justify-center">
        <div class="text-muted-foreground">Loading entries...</div>
      </div>
    {:then data}
      <!-- Monthly Summary -->
      <Card class="mb-6">
        <CardContent class="py-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Clock class="h-5 w-5 text-muted-foreground" />
              <span class="text-sm text-muted-foreground">Total this month:</span>
            </div>
            <span class="text-lg font-semibold">{data.totalFormatted}</span>
          </div>
        </CardContent>
      </Card>

      <!-- Days with entries -->
      {#if data.days.length === 0}
        <Card>
          <CardContent class="flex flex-col items-center justify-center py-12">
            <Clock class="mb-4 h-12 w-12 text-muted-foreground" />
            <p class="mb-4 text-muted-foreground">No entries for this month</p>
            <Button onclick={() => goto("/entry/new")}>
              <Plus class="mr-2 h-4 w-4" />
              Add your first entry
            </Button>
          </CardContent>
        </Card>
      {:else}
        <div class="space-y-4">
          {#each data.days as day}
            <Card>
              <CardHeader class="pb-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <CardTitle class="text-base">{formatDate(day.date)}</CardTitle>
                    {#if day.allConfirmed}
                      <span
                        class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                      >
                        <Check class="h-3 w-3" />
                        Confirmed
                      </span>
                    {/if}
                  </div>
                  <div class="flex items-center gap-3">
                    <span class="text-sm text-muted-foreground">{day.totalFormatted}</span>
                    {#if day.hasUnconfirmed}
                      <Button
                        size="sm"
                        variant="outline"
                        onclick={() => handleConfirmDay(day.date)}
                        disabled={confirmingDay === day.date}
                      >
                        {#if confirmingDay === day.date}
                          Confirming...
                        {:else}
                          <Check class="mr-1 h-4 w-4" />
                          Confirm Day
                        {/if}
                      </Button>
                    {/if}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div class="divide-y divide-border">
                  {#each day.entries as entry}
                    <div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div class="flex-1">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-sm">
                            {formatTime(entry.startTime)}
                            {#if entry.endTime}
                              - {formatTime(entry.endTime)}
                            {:else}
                              <span class="text-muted-foreground">ongoing</span>
                            {/if}
                          </span>
                          {#if entry.status === "draft"}
                            <span
                              class="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                            >
                              Draft
                            </span>
                          {/if}
                        </div>
                        <p class="mt-1 text-sm text-muted-foreground">
                          {entry.description || "No description"}
                        </p>
                        {#if entry.phase}
                          <p class="mt-0.5 text-xs text-muted-foreground">
                            {entry.phase.case.customer.name} / {entry.phase.case.name} / {entry
                              .phase.name}
                          </p>
                        {/if}
                      </div>
                      {#if entry.status === "draft"}
                        <div class="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onclick={() => goto(`/entry/${entry.id}`)}
                          >
                            <Edit class="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onclick={() => handleDeleteEntry(entry.id)}
                            disabled={deletingEntry === entry.id}
                          >
                            <Trash2 class="h-4 w-4" />
                          </Button>
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              </CardContent>
            </Card>
          {/each}
        </div>
      {/if}
    {:catch error}
      <Card>
        <CardContent class="flex flex-col items-center justify-center py-12">
          <AlertCircle class="mb-4 h-12 w-12 text-destructive" />
          <p class="mb-2 text-destructive">Failed to load entries</p>
          <p class="text-sm text-muted-foreground">{error.message}</p>
        </CardContent>
      </Card>
    {/await}
  </div>
{/if}
