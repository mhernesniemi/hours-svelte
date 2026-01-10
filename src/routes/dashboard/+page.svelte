<script lang="ts">
  import {
    getDayEntries,
    getWeekStatus,
    createEntry,
    confirmDayEntries,
    deleteEntry,
    getPhasesWithHierarchy,
    getWorktypes
  } from "$lib/remote";
  import { goto } from "$app/navigation";
  import { browser } from "$app/environment";

  const DEFAULT_WORKTYPE_KEY = "inside-default-worktype";
  import { tick, untrack } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import * as Select from "$lib/components/ui/select";
  import * as Tabs from "$lib/components/ui/tabs";
  import { TimeInput } from "$lib/components/ui/time-input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import { cn } from "$lib/utils";
  import {
    ChevronLeft,
    ChevronRight,
    Check,
    Clock,
    Trash2,
    Edit,
    AlertCircle,
    Plus,
    Save,
    Loader2,
    X,
    ChevronsUpDown
  } from "@lucide/svelte";
  import {
    format,
    startOfWeek,
    endOfWeek,
    addWeeks,
    subWeeks,
    addDays,
    getISOWeek,
    getISOWeekYear,
    isToday,
    isSameDay,
    isFuture,
    set,
    startOfDay
  } from "date-fns";

  // User comes from +page.server.ts load function
  let { data } = $props();

  // Current week state - start of week (Monday)
  let currentWeekStart = $state(startOfWeek(new Date(), { weekStartsOn: 1 }));
  let selectedDate = $state(new Date());

  // Derived week info
  let weekNumber = $derived(getISOWeek(currentWeekStart));
  let year = $derived(getISOWeekYear(currentWeekStart));
  let currentYear = $derived(getISOWeekYear(new Date()));

  // Check if viewing current or future week (disable next navigation)
  let isCurrentOrFutureWeek = $derived(
    currentWeekStart >= startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Generate weekdays for the current week
  let weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)));

  // Load entries for selected day
  let entriesPromise = $state(untrack(() => getDayEntries({ date: selectedDate })));

  // Re-fetch entries when selected date changes
  $effect(() => {
    entriesPromise = getDayEntries({ date: selectedDate });
  });

  // Load week status (which days are confirmed)
  let weekStatusPromise = $state(untrack(() => getWeekStatus({ weekStart: currentWeekStart })));

  // Re-fetch week status when week changes
  $effect(() => {
    weekStatusPromise = getWeekStatus({ weekStart: currentWeekStart });
  });

  // Helper to check if a day is confirmed
  function isDayConfirmed(day: Date, confirmedDays: string[]): boolean {
    return confirmedDays.includes(format(day, "yyyy-MM-dd"));
  }

  // Helper to refresh entries after mutations
  function refreshEntries() {
    entriesPromise.refresh();
    weekStatusPromise.refresh();
  }

  // Load phases and worktypes for the form
  const phasesPromise = getPhasesWithHierarchy({});
  const worktypesPromise = getWorktypes({});

  // UI state
  let confirmingDay = $state(false);
  let deletingEntry = $state<number | null>(null);
  let error = $state("");

  // New entry form state
  let showNewEntryForm = $state(false);
  let newStartTime = $state("");
  let newEndTime = $state("");
  let newDescription = $state("");
  let newPhaseId = $state<number | null>(null);
  let newWorktypeId = $state<number | null>(null);
  let phaseSearch = $state("");
  let phaseDropdownOpen = $state(false);
  let worktypeDropdownOpen = $state(false);
  let phaseTriggerRef = $state<HTMLButtonElement>(null!);
  let startTimeInputRef = $state<HTMLInputElement>(null!);
  let endTimeInputRef = $state<HTMLInputElement>(null!);
  let descriptionRef = $state<HTMLTextAreaElement>(null!);
  let isSubmitting = $state(false);

  // Helper to run state changes with view transition
  function withViewTransition(callback: () => void) {
    if (!document.startViewTransition) {
      callback();
      return;
    }
    document.startViewTransition(callback);
  }

  function navigateWeek(direction: "prev" | "next") {
    withViewTransition(() => {
      currentWeekStart =
        direction === "prev" ? subWeeks(currentWeekStart, 1) : addWeeks(currentWeekStart, 1);
      // Select the same weekday in the new week
      const dayOffset = weekDays.findIndex((d) => isSameDay(d, selectedDate));
      selectedDate = addDays(currentWeekStart, dayOffset >= 0 ? dayOffset : 0);
    });
  }

  function selectDay(day: Date) {
    withViewTransition(() => {
      selectedDate = day;
      // Reset form when changing days
      resetNewEntryForm();
    });
  }

  function getDefaultWorktypeId(): number | null {
    if (!browser) return null;
    const saved = localStorage.getItem(DEFAULT_WORKTYPE_KEY);
    return saved ? Number(saved) : null;
  }

  function saveDefaultWorktypeId(id: number | null) {
    if (!browser || !id) return;
    localStorage.setItem(DEFAULT_WORKTYPE_KEY, String(id));
  }

  function resetNewEntryForm() {
    showNewEntryForm = false;
    newStartTime = "";
    newEndTime = "";
    newDescription = "";
    newPhaseId = null;
    newWorktypeId = null;
    phaseSearch = "";
    phaseDropdownOpen = false;
    worktypeDropdownOpen = false;
    error = "";
  }

  async function handleAddEntry() {
    showNewEntryForm = true;
    newWorktypeId = getDefaultWorktypeId();
    await tick();
    phaseDropdownOpen = true;
  }

  function getFilteredPhases(phases: Awaited<typeof phasesPromise>, search: string) {
    if (!search) return phases.slice(0, 20);
    const lower = search.toLowerCase();
    return phases.filter((p) => p.fullName.toLowerCase().includes(lower)).slice(0, 20);
  }

  function selectPhase(phase: { id: number; fullName: string }) {
    newPhaseId = phase.id;
    phaseDropdownOpen = false;
    tick().then(() => {
      // Open work type dropdown if not filled, otherwise focus on start time
      if (!newWorktypeId) {
        worktypeDropdownOpen = true;
      } else {
        startTimeInputRef?.focus();
      }
    });
  }

  // Clear search when dropdown opens so all options are visible
  $effect(() => {
    if (phaseDropdownOpen) {
      phaseSearch = "";
    }
  });

  function getSelectedPhaseName(phases: Awaited<typeof phasesPromise>, id: number | null): string {
    if (!id) return "";
    const phase = phases.find((p) => p.id === id);
    return phase?.fullName || "";
  }

  async function handleConfirmDay() {
    error = "";
    confirmingDay = true;

    try {
      const result = await confirmDayEntries({ date: selectedDate });
      if (!result.success) {
        error = result.error || "Failed to confirm day";
      } else {
        // Refresh data
        refreshEntries();
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to confirm day";
    } finally {
      confirmingDay = false;
    }
  }

  async function handleDeleteEntry(entryId: number) {
    error = "";
    deletingEntry = entryId;

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
      deletingEntry = null;
    }
  }

  async function handleCreateEntry(e: Event) {
    e.preventDefault();
    error = "";
    isSubmitting = true;

    try {
      const dateObj = startOfDay(selectedDate);
      const [startHour, startMin] = newStartTime.split(":").map(Number);
      const startDateTime = set(dateObj, { hours: startHour, minutes: startMin });

      let endDateTime: Date | null = null;
      if (newEndTime) {
        const [endHour, endMin] = newEndTime.split(":").map(Number);
        endDateTime = set(dateObj, { hours: endHour, minutes: endMin });
      }

      const result = await createEntry({
        startTime: startDateTime,
        endTime: endDateTime,
        description: newDescription || null,
        issueCode: null,
        phaseId: newPhaseId,
        worktypeId: newWorktypeId
      });

      if (result.success) {
        // Save the selected worktype as default for next time
        saveDefaultWorktypeId(newWorktypeId);
        resetNewEntryForm();
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

  function handleKeyDown(e: KeyboardEvent) {
    // Cmd+S (Mac) or Ctrl+S (Windows/Linux) to save
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault(); // Prevent browser's "Save Page" dialog
      if (showNewEntryForm && !isSubmitting) {
        handleCreateEntry(e);
      }
    }
  }

  function formatTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "HH:mm");
  }

  function formatWeekday(date: Date): string {
    return format(date, "EEE");
  }

  function formatDayNumber(date: Date): string {
    return format(date, "d");
  }

  function formatDuration(startTime: Date | string, endTime: Date | string): string {
    const start = typeof startTime === "string" ? new Date(startTime) : startTime;
    const end = typeof endTime === "string" ? new Date(endTime) : endTime;
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${mins}m`;
    }
  }
</script>

<svelte:head>
  <title>Hours - Inside</title>
</svelte:head>

<svelte:document onkeydown={handleKeyDown} />

<div class="mx-auto max-w-5xl p-4">
  <!-- Week Navigation Header -->
  <div class="mb-6">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button class="rounded-md p-2 hover:bg-accent" onclick={() => navigateWeek("prev")}>
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
          onclick={() => navigateWeek("next")}
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
        if (val) selectDay(new Date(val));
      }}
    >
      {#await weekStatusPromise then weekStatus}
        <Tabs.List class="grid h-auto w-full grid-cols-7 gap-1 bg-transparent p-0">
          {#each weekDays as day}
            {@const dayIsFuture = isFuture(startOfDay(day))}
            {@const isConfirmed = isDayConfirmed(day, weekStatus.confirmedDays)}
            <Tabs.Trigger
              value={format(day, "yyyy-MM-dd")}
              disabled={dayIsFuture}
              class={cn(
                "flex h-auto flex-col items-center rounded-lg p-2 transition-colors",
                "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none",
                "data-[state=inactive]:hover:bg-accent",
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
      {/await}
    </Tabs.Root>
  </div>

  {#if error}
    <div
      class="mb-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle class="h-4 w-4" />
      {error}
    </div>
  {/if}

  <!-- Selected Day Content -->
  <Card>
    <CardHeader class="pb-2">
      {#await entriesPromise then dayData}
        <div class="flex items-center justify-between">
          <CardTitle class="flex items-center gap-1 text-lg">
            {format(selectedDate, "EEEE, MMMM d")}

            {#if dayData.hasUnconfirmed}
              <span
                class="ml-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs font-normal text-secondary-foreground/70"
              >
                Draft
              </span>
            {/if}
          </CardTitle>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm font-medium">{dayData.totalFormatted}</span>
            </div>
            {#if dayData.allConfirmed}
              <span
                class="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400"
              >
                <Check class="h-3 w-3" />
                Confirmed
              </span>
            {:else if dayData.hasUnconfirmed}
              <Button
                size="sm"
                variant="outline"
                onclick={handleConfirmDay}
                disabled={confirmingDay}
              >
                {#if confirmingDay}
                  <Loader2 class="mr-1 h-4 w-4 animate-spin" />
                  Confirming...
                {:else}
                  <Check class="mr-1 h-4 w-4" />
                  Confirm Day
                {/if}
              </Button>
            {/if}
          </div>
        </div>
      {/await}
    </CardHeader>
    <CardContent>
      {#await entriesPromise}
        <!-- Loading state, reduce layout shift -->
        <div class="flex h-48 items-center justify-center"></div>
      {:then dayData}
        <!-- Entries List -->
        {#if dayData.entries.length > 0}
          <div class="mb-4 divide-y divide-border">
            {#each dayData.entries as entry}
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
                      {entry.phase.case.customer.name} / {entry.phase.case.name} / {entry.phase
                        .name}
                    </p>
                  {/if}
                </div>

                <!-- Actions -->
                {#if entry.status === "draft"}
                  <div class="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onclick={() => goto(`/entry/${entry.id}`)}>
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
        {:else if !showNewEntryForm}
          <div class="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock class="mb-2 h-8 w-8" />
            <p class="text-sm">No entries for this day</p>
          </div>
        {/if}

        <!-- New Entry Form -->
        {#if showNewEntryForm}
          <div class="mt-4 border-t border-border pt-4">
            <form onsubmit={handleCreateEntry} class="space-y-4">
              <div class="mb-2 flex items-center justify-between">
                <h3 class="font-medium">New Entry</h3>
                <Button type="button" variant="ghost" size="icon" onclick={resetNewEntryForm}>
                  <X class="h-4 w-4" />
                </Button>
              </div>

              <!-- Row 1: Phase Selection (full width) -->
              <div class="space-y-1">
                <Label for="phase-combobox">Project</Label>
                {#await phasesPromise}
                  <Button variant="outline" class="w-full justify-between" disabled>
                    Loading phases...
                    <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                {:then phases}
                  <Popover.Root bind:open={phaseDropdownOpen}>
                    <Popover.Trigger bind:ref={phaseTriggerRef}>
                      {#snippet child({ props })}
                        <Button
                          {...props}
                          id="phase-combobox"
                          variant="outline"
                          class="w-full justify-between"
                          role="combobox"
                          aria-expanded={phaseDropdownOpen}
                        >
                          <span class="truncate">
                            {newPhaseId
                              ? getSelectedPhaseName(phases, newPhaseId)
                              : "Select project..."}
                          </span>
                          <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      {/snippet}
                    </Popover.Trigger>
                    <Popover.Content class="w-(--bits-popover-anchor-width) p-0">
                      <Command.Root shouldFilter={false}>
                        <Command.Input placeholder="Search" bind:value={phaseSearch} />
                        <Command.List>
                          <Command.Empty>No phases found.</Command.Empty>
                          <Command.Group>
                            {#each getFilteredPhases(phases, phaseSearch) as phase (phase.id)}
                              <Command.Item
                                value={phase.fullName}
                                onSelect={() => selectPhase(phase)}
                              >
                                <Check
                                  class={cn(
                                    "mr-2 h-4 w-4",
                                    newPhaseId !== phase.id && "text-transparent"
                                  )}
                                />
                                {phase.fullName}
                              </Command.Item>
                            {/each}
                          </Command.Group>
                        </Command.List>
                      </Command.Root>
                    </Popover.Content>
                  </Popover.Root>
                {/await}
              </div>

              <!-- Row 2: Worktype (50%) + Start (25%) + End (25%) -->
              <div class="grid grid-cols-4 gap-4">
                <!-- Worktype Selection -->
                <div class="col-span-2 space-y-1">
                  <Label for="worktype">Work Type</Label>
                  {#await worktypesPromise}
                    <Select.Root type="single" disabled>
                      <Select.Trigger id="worktype" class="w-full">
                        <span>Loading...</span>
                      </Select.Trigger>
                    </Select.Root>
                  {:then worktypes}
                    <Select.Root
                      type="single"
                      bind:open={worktypeDropdownOpen}
                      value={newWorktypeId ? String(newWorktypeId) : undefined}
                      onValueChange={(val) => {
                        newWorktypeId = val ? Number(val) : null;
                        if (val) {
                          tick().then(() => startTimeInputRef?.focus());
                        }
                      }}
                    >
                      <Select.Trigger id="worktype" class="w-full">
                        <span data-slot="select-value">
                          {#if newWorktypeId}
                            {worktypes.find((wt) => wt.id === newWorktypeId)?.name ||
                              "Select work type..."}
                          {:else}
                            Select work type...
                          {/if}
                        </span>
                      </Select.Trigger>
                      <Select.Content>
                        {#each worktypes as wt}
                          <Select.Item value={String(wt.id)} label={wt.name} />
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  {/await}
                </div>

                <!-- Start time -->
                <div class="space-y-1">
                  <Label for="startTime">Start</Label>
                  <TimeInput
                    id="startTime"
                    bind:value={newStartTime}
                    required
                    bind:ref={startTimeInputRef}
                    oncomplete={() => endTimeInputRef?.focus()}
                  />
                </div>

                <!-- End time -->
                <div class="space-y-1">
                  <Label for="endTime">End</Label>
                  <TimeInput
                    id="endTime"
                    bind:value={newEndTime}
                    bind:ref={endTimeInputRef}
                    oncomplete={() => descriptionRef?.focus()}
                  />
                </div>
              </div>

              <!-- Row 3: Description -->
              <div class="space-y-1">
                <Label for="description">Description</Label>
                <Textarea
                  id="description"
                  bind:value={newDescription}
                  bind:ref={descriptionRef}
                  rows={2}
                  placeholder="What did you work on?"
                />
              </div>

              <!-- Submit -->
              <div class="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onclick={resetNewEntryForm}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {#if isSubmitting}
                    <Loader2 class="h-4 w-4 animate-spin" />
                    Saving...
                  {:else}
                    <Save class="h-4 w-4" />
                    Save
                  {/if}
                </Button>
              </div>
            </form>
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
      {:catch err}
        <div class="flex flex-col items-center justify-center py-8">
          <AlertCircle class="mb-2 h-8 w-8 text-destructive" />
          <p class="text-sm text-destructive">Failed to load entries</p>
        </div>
      {/await}
    </CardContent>
  </Card>
</div>
