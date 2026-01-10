<script lang="ts">
  import {
    getDayEntries,
    getWeekStatus,
    createEntry,
    updateEntry,
    confirmDayEntries,
    deleteEntry,
    getPhasesWithHierarchy,
    getWorktypes
  } from "$lib/remote";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { untrack } from "svelte";
  import { format, startOfWeek, addWeeks, subWeeks, addDays, isSameDay } from "date-fns";

  import { Card, CardContent } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { AlertCircle, Clock, Plus, Copy } from "@lucide/svelte";

  import { WeekNavigator, DayHeader, EntryItem, EntryForm } from "./components";
  import {
    getInitialDate,
    parseTimeToDate,
    getDefaultWorktypeId,
    saveDefaultWorktypeId
  } from "$lib/dashboard";

  // Initialize dates from URL
  const initialDate = getInitialDate(page.url.searchParams);

  // Week and date state
  let currentWeekStart = $state(startOfWeek(initialDate, { weekStartsOn: 1 }));
  let selectedDate = $state(initialDate);

  // UI state
  let showNewEntryForm = $state(false);
  let editingEntryId = $state<number | null>(null);
  let confirmingDay = $state(false);
  let deletingEntryId = $state<number | null>(null);
  let isSubmitting = $state(false);
  let error = $state("");

  // Update URL when date changes
  $effect(() => {
    if (browser) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const url = new URL(page.url);
      url.searchParams.set("date", dateStr);
      replaceState(url, {});
    }
  });

  // Data fetching
  let entriesPromise = $state(untrack(() => getDayEntries({ date: selectedDate })));
  let weekStatusPromise = $state(untrack(() => getWeekStatus({ weekStart: currentWeekStart })));
  const phasesPromise = getPhasesWithHierarchy({});
  const worktypesPromise = getWorktypes({});

  // Re-fetch when date/week changes
  $effect(() => {
    entriesPromise = getDayEntries({ date: selectedDate });
  });

  $effect(() => {
    weekStatusPromise = getWeekStatus({ weekStart: currentWeekStart });
  });

  // View transition helper
  function withViewTransition(callback: () => void) {
    if (!document.startViewTransition) {
      callback();
      return;
    }
    document.startViewTransition(callback);
  }

  // Refresh data after mutations
  function refreshEntries() {
    withViewTransition(() => {
      entriesPromise.refresh();
      weekStatusPromise.refresh();
    });
  }

  // Reset all form state
  function resetForm() {
    showNewEntryForm = false;
    editingEntryId = null;
    error = "";
  }

  // Navigation handlers
  function handleNavigateWeek(direction: "prev" | "next") {
    withViewTransition(() => {
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
      currentWeekStart =
        direction === "prev" ? subWeeks(currentWeekStart, 1) : addWeeks(currentWeekStart, 1);
      const dayOffset = weekDays.findIndex((d) => isSameDay(d, selectedDate));
      selectedDate = addDays(currentWeekStart, dayOffset >= 0 ? dayOffset : 0);
    });
  }

  function handleSelectDay(day: Date) {
    withViewTransition(() => {
      selectedDate = day;
      resetForm();
    });
  }

  // Entry handlers
  function handleAddEntry() {
    showNewEntryForm = true;
    editingEntryId = null;
  }

  function handleStartEditing(entryId: number) {
    showNewEntryForm = false;
    editingEntryId = entryId;
    error = "";
  }

  async function handleCreateEntry(data: {
    startTime: string;
    endTime: string;
    description: string;
    phaseId: number | null;
    worktypeId: number | null;
  }) {
    error = "";
    isSubmitting = true;

    try {
      const startDateTime = parseTimeToDate(selectedDate, data.startTime);
      const endDateTime = data.endTime ? parseTimeToDate(selectedDate, data.endTime) : null;

      const result = await createEntry({
        startTime: startDateTime,
        endTime: endDateTime,
        description: data.description || null,
        issueCode: null,
        phaseId: data.phaseId,
        worktypeId: data.worktypeId
      });

      if (result.success) {
        saveDefaultWorktypeId(data.worktypeId);
        resetForm();
        refreshEntries();
      } else {
        error = result.error || "Failed to create entry";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create entry";
    } finally {
      isSubmitting = false;
    }
  }

  async function handleUpdateEntry(data: {
    startTime: string;
    endTime: string;
    description: string;
    phaseId: number | null;
    worktypeId: number | null;
  }) {
    if (!editingEntryId) return;

    error = "";
    isSubmitting = true;

    try {
      const startDateTime = parseTimeToDate(selectedDate, data.startTime);
      const endDateTime = data.endTime ? parseTimeToDate(selectedDate, data.endTime) : null;

      const result = await updateEntry({
        entryId: editingEntryId,
        startTime: startDateTime,
        endTime: endDateTime,
        description: data.description || null,
        phaseId: data.phaseId,
        worktypeId: data.worktypeId
      });

      if (result.success) {
        resetForm();
        refreshEntries();
      } else {
        error = result.error || "Failed to update entry";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to update entry";
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDeleteEntry(entryId: number) {
    error = "";
    deletingEntryId = entryId;

    try {
      const result = await deleteEntry({ entryId });
      if (!result.success) {
        error = result.error || "Failed to delete entry";
      } else {
        refreshEntries();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to delete entry";
    } finally {
      deletingEntryId = null;
    }
  }

  async function handleConfirmDay() {
    error = "";
    confirmingDay = true;

    try {
      const result = await confirmDayEntries({ date: selectedDate });
      if (!result.success) {
        error = result.error || "Failed to confirm day";
      } else {
        refreshEntries();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to confirm day";
    } finally {
      confirmingDay = false;
    }
  }
</script>

<svelte:head>
  <title>Hours - Inside</title>
</svelte:head>

<div class="mx-auto max-w-5xl p-4">
  <!-- Week Navigation -->
  {#await weekStatusPromise then weekStatus}
    <WeekNavigator
      {currentWeekStart}
      {selectedDate}
      confirmedDays={weekStatus.confirmedDays}
      onnavigateweek={handleNavigateWeek}
      onselectday={handleSelectDay}
    />
  {/await}

  <!-- Error Banner -->
  {#if error}
    <div
      class="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle class="h-4 w-4" />
      {error}
    </div>
  {/if}

  <!-- Day Content Card -->
  <Card>
    {#await entriesPromise}
      <div class="flex h-48 items-center justify-center"></div>
    {:then dayData}
      <DayHeader
        {selectedDate}
        totalFormatted={dayData.totalFormatted}
        hasUnconfirmed={dayData.hasUnconfirmed}
        allConfirmed={dayData.allConfirmed}
        {confirmingDay}
        onconfirmday={handleConfirmDay}
      />

      <CardContent>
        <!-- Entries List -->
        {#if dayData.entries.length > 0}
          <div class="mb-4 divide-y divide-border">
            {#each dayData.entries as entry (entry.id)}
              {#if editingEntryId === entry.id}
                <!-- Inline Edit Form -->
                <div class="py-3 first:pt-0">
                  {#await Promise.all([phasesPromise, worktypesPromise]) then [phases, worktypes]}
                    <EntryForm
                      mode="edit"
                      {entry}
                      {phases}
                      {worktypes}
                      {isSubmitting}
                      onsubmit={handleUpdateEntry}
                      oncancel={resetForm}
                    />
                  {/await}
                </div>
              {:else}
                <EntryItem
                  {entry}
                  isDeleting={deletingEntryId === entry.id}
                  onedit={() => handleStartEditing(entry.id)}
                  ondelete={() => handleDeleteEntry(entry.id)}
                />
              {/if}
            {/each}
          </div>
        {:else if !showNewEntryForm && !editingEntryId}
          <div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock class="mb-2 h-8 w-8" />
            <p class="text-sm">No entries for this day</p>
            <button
              class="mt-6 flex items-center gap-2 rounded-md border border-dashed border-primary/30 px-2 py-1 text-xs text-muted-foreground hover:text-primary"
            >
              <Copy class="h-3 w-3" />
              Copy Previous Day
            </button>
          </div>
        {/if}

        <!-- New Entry Form -->
        {#if showNewEntryForm}
          <div class="mt-4 border-t border-border pt-4">
            {#await Promise.all([phasesPromise, worktypesPromise]) then [phases, worktypes]}
              <EntryForm
                mode="create"
                {phases}
                {worktypes}
                defaultWorktypeId={getDefaultWorktypeId()}
                {isSubmitting}
                onsubmit={handleCreateEntry}
                oncancel={resetForm}
              />
            {/await}
          </div>
        {:else if !dayData.allConfirmed}
          <!-- Add Entry Button -->
          <div class="mt-4 border-t border-border pt-4">
            <Button variant="outline" class="w-full" onclick={handleAddEntry}>
              <Plus class="h-4 w-4" />
              Add Entry
            </Button>
          </div>
        {/if}
      </CardContent>
    {:catch}
      <div class="flex flex-col items-center justify-center py-8">
        <AlertCircle class="mb-2 h-8 w-8 text-destructive" />
        <p class="text-sm text-destructive">Failed to load entries</p>
      </div>
    {/await}
  </Card>
</div>
