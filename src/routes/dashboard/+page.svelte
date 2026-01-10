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
  import { page } from "$app/state";
  import { untrack } from "svelte";

  import { Card, CardContent } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import AsyncBoundary from "$lib/components/AsyncBoundary.svelte";
  import { AlertCircle, Clock, Plus, Copy } from "@lucide/svelte";

  import { WeekNavigator, DayHeader, EntryList, EntryItem, EntryForm } from "./components";
  import {
    parseTimeToDate,
    getDefaultWorktypeId,
    saveDefaultWorktypeId,
    // Store
    initializeFromUrl,
    syncUrlWithDate,
    getSelectedDate,
    getCurrentWeekStart,
    getEditingEntryId,
    getShowNewEntryForm,
    getError,
    selectDay,
    navigateWeek,
    startEditing,
    startCreating,
    resetForm,
    setError,
    clearError
  } from "$lib/dashboard";

  // Initialize store from URL
  initializeFromUrl(page.url.searchParams);

  // Reactive getters from store
  let selectedDate = $derived(getSelectedDate());
  let currentWeekStart = $derived(getCurrentWeekStart());
  let editingEntryId = $derived(getEditingEntryId());
  let showNewEntryForm = $derived(getShowNewEntryForm());
  let error = $derived(getError());

  // UI state (local to page)
  let confirmingDay = $state(false);
  let deletingEntryId = $state<number | null>(null);
  let isSubmitting = $state(false);

  // Sync URL with date changes
  $effect(() => {
    syncUrlWithDate(page.url);
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

  // Navigation handlers (delegate to store with view transitions)
  function handleNavigateWeek(direction: "prev" | "next") {
    withViewTransition(() => navigateWeek(direction));
  }

  function handleSelectDay(day: Date) {
    withViewTransition(() => selectDay(day));
  }

  // Entry handlers
  async function handleCreateEntry(data: {
    startTime: string;
    endTime: string;
    description: string;
    phaseId: number | null;
    worktypeId: number | null;
  }) {
    clearError();
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
        setError(result.error || "Failed to create entry");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entry");
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

    clearError();
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
        setError(result.error || "Failed to update entry");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
    } finally {
      isSubmitting = false;
    }
  }

  async function handleDeleteEntry(entryId: number) {
    clearError();
    deletingEntryId = entryId;

    try {
      const result = await deleteEntry({ entryId });
      if (!result.success) {
        setError(result.error || "Failed to delete entry");
      } else {
        refreshEntries();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    } finally {
      deletingEntryId = null;
    }
  }

  async function handleConfirmDay() {
    clearError();
    confirmingDay = true;

    try {
      const result = await confirmDayEntries({ date: selectedDate });
      if (!result.success) {
        setError(result.error || "Failed to confirm day");
      } else {
        refreshEntries();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to confirm day");
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
  <AsyncBoundary promise={weekStatusPromise}>
    {#snippet loading()}
      <div class="mb-6 h-24"></div>
    {/snippet}

    {#snippet children(weekStatus)}
      <WeekNavigator
        {currentWeekStart}
        {selectedDate}
        confirmedDays={weekStatus.confirmedDays}
        onnavigateweek={handleNavigateWeek}
        onselectday={handleSelectDay}
      />
    {/snippet}
  </AsyncBoundary>

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
    <AsyncBoundary promise={entriesPromise}>
      {#snippet loading()}
        <div class="flex h-48 items-center justify-center"></div>
      {/snippet}

      {#snippet children(dayData)}
        <DayHeader
          {selectedDate}
          totalFormatted={dayData.totalFormatted}
          hasUnconfirmed={dayData.hasUnconfirmed}
          allConfirmed={dayData.allConfirmed}
          {confirmingDay}
          onconfirmday={handleConfirmDay}
        />

        <CardContent>
          <!-- Entries List with snippet-based rendering -->
          <EntryList entries={dayData.entries}>
            {#snippet children(entry)}
              {#if editingEntryId === entry.id}
                <!-- Inline Edit Form -->
                <div class="py-3 first:pt-0">
                  <EntryForm
                    mode="edit"
                    {entry}
                    {phasesPromise}
                    {worktypesPromise}
                    {isSubmitting}
                    onsubmit={handleUpdateEntry}
                    oncancel={resetForm}
                  />
                </div>
              {:else}
                <EntryItem
                  {entry}
                  isDeleting={deletingEntryId === entry.id}
                  onedit={() => startEditing(entry.id)}
                  ondelete={() => handleDeleteEntry(entry.id)}
                />
              {/if}
            {/snippet}

            {#snippet empty()}
              {#if !showNewEntryForm && !editingEntryId}
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
            {/snippet}
          </EntryList>

          <!-- New Entry Form -->
          {#if showNewEntryForm}
            <div class="mt-4 border-t border-border pt-4">
              <EntryForm
                mode="create"
                {phasesPromise}
                {worktypesPromise}
                defaultWorktypeId={getDefaultWorktypeId()}
                {isSubmitting}
                onsubmit={handleCreateEntry}
                oncancel={resetForm}
              />
            </div>
          {:else if !dayData.allConfirmed}
            <!-- Add Entry Button -->
            <div class="mt-4 border-t border-border pt-4">
              <Button variant="outline" class="w-full" onclick={startCreating}>
                <Plus class="h-4 w-4" />
                Add Entry
              </Button>
            </div>
          {/if}
        </CardContent>
      {/snippet}

      {#snippet error()}
        <div class="flex flex-col items-center justify-center py-8">
          <AlertCircle class="mb-2 h-8 w-8 text-destructive" />
          <p class="text-sm text-destructive">Failed to load entries</p>
        </div>
      {/snippet}
    </AsyncBoundary>
  </Card>
</div>
