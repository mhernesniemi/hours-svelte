<script lang="ts">
  import {
    getDayEntries,
    createEntry,
    confirmDayEntries,
    deleteEntry,
    getPhasesWithHierarchy,
    getWorktypes
  } from "$lib/remote";
  import { goto } from "$app/navigation";
  import { tick } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import * as Select from "$lib/components/ui/select";
  import { Input } from "$lib/components/ui/input";
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
    isToday,
    isSameDay,
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
  let year = $derived(currentWeekStart.getFullYear());

  // Generate weekdays for the current week
  let weekDays = $derived(Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)));

  // Load entries for selected day
  let entriesPromise = $derived(getDayEntries({ date: selectedDate }));

  // Load phases and worktypes for the form
  const phasesPromise = getPhasesWithHierarchy({});
  const worktypesPromise = getWorktypes({});

  // UI state
  let confirmingDay = $state(false);
  let deletingEntry = $state<number | null>(null);
  let error = $state("");

  // New entry form state
  let showNewEntryForm = $state(false);
  let newStartTime = $state(format(new Date(), "HH:mm"));
  let newEndTime = $state("");
  let newDescription = $state("");
  let newPhaseId = $state<number | null>(null);
  let newWorktypeId = $state<number | null>(null);
  let phaseSearch = $state("");
  let phaseDropdownOpen = $state(false);
  let phaseTriggerRef = $state<HTMLButtonElement>(null!);
  let isSubmitting = $state(false);

  function navigateWeek(direction: "prev" | "next") {
    currentWeekStart =
      direction === "prev" ? subWeeks(currentWeekStart, 1) : addWeeks(currentWeekStart, 1);
    // Select the same weekday in the new week
    const dayOffset = weekDays.findIndex((d) => isSameDay(d, selectedDate));
    selectedDate = addDays(currentWeekStart, dayOffset >= 0 ? dayOffset : 0);
  }

  function goToToday() {
    currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    selectedDate = new Date();
  }

  function selectDay(day: Date) {
    selectedDate = day;
    // Reset form when changing days
    resetNewEntryForm();
  }

  function resetNewEntryForm() {
    showNewEntryForm = false;
    newStartTime = format(new Date(), "HH:mm");
    newEndTime = "";
    newDescription = "";
    newPhaseId = null;
    newWorktypeId = null;
    phaseSearch = "";
    phaseDropdownOpen = false;
    error = "";
  }

  async function handleAddEntry() {
    showNewEntryForm = true;
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
      phaseTriggerRef?.focus();
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
        entriesPromise = getDayEntries({ date: selectedDate });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to confirm day";
    } finally {
      confirmingDay = false;
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
        entriesPromise = getDayEntries({ date: selectedDate });
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
        resetNewEntryForm();
        entriesPromise = getDayEntries({ date: selectedDate });
      } else {
        error = result.error || "Failed to create entry";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create entry";
    } finally {
      isSubmitting = false;
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
</script>

<svelte:head>
  <title>Hours - Inside</title>
</svelte:head>

<div class="mx-auto max-w-5xl p-4">
  <!-- Week Navigation Header -->
  <div class="mb-6">
    <div class="mb-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button variant="outline" size="icon" onclick={() => navigateWeek("prev")}>
          <ChevronLeft class="h-4 w-4" />
        </Button>
        <div class="text-center">
          <h1 class="text-xl font-bold">Week {weekNumber}</h1>
          <p class="text-sm text-muted-foreground">{year}</p>
        </div>
        <Button variant="outline" size="icon" onclick={() => navigateWeek("next")}>
          <ChevronRight class="h-4 w-4" />
        </Button>
      </div>
      <Button variant="outline" size="sm" onclick={goToToday}>Today</Button>
    </div>

    <!-- Weekday Tabs -->
    <div class="grid grid-cols-7 gap-1">
      {#each weekDays as day}
        <button
          type="button"
          onclick={() => selectDay(day)}
          class="flex flex-col items-center rounded-lg p-2 transition-colors
            {isSameDay(day, selectedDate)
            ? 'bg-primary text-primary-foreground'
            : isToday(day)
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent'}"
        >
          <span class="text-xs font-medium">{formatWeekday(day)}</span>
          <span class="text-lg font-bold">{formatDayNumber(day)}</span>
        </button>
      {/each}
    </div>
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
      <div class="flex items-center justify-between">
        <CardTitle class="text-lg">
          {format(selectedDate, "EEEE, MMMM d")}
        </CardTitle>
        {#await entriesPromise then dayData}
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <Clock class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm font-medium">{dayData.totalFormatted}</span>
            </div>
            {#if dayData.allConfirmed}
              <span
                class="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
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
        {/await}
      </div>
    </CardHeader>
    <CardContent>
      {#await entriesPromise}
        <div class="flex items-center justify-center py-8">
          <div class="text-muted-foreground">Loading entries...</div>
        </div>
      {:then dayData}
        <!-- Entries List -->
        {#if dayData.entries.length > 0}
          <div class="mb-4 divide-y divide-border">
            {#each dayData.entries as entry}
              <div class="flex items-center justify-between py-3 first:pt-0">
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
                      {entry.phase.case.customer.name} / {entry.phase.case.name} / {entry.phase
                        .name}
                    </p>
                  {/if}
                </div>
                {#if entry.status === "draft"}
                  <div class="flex gap-1">
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
                <Label for="phase-combobox">Project / Phase</Label>
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
                              : "Select project / phase..."}
                          </span>
                          <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      {/snippet}
                    </Popover.Trigger>
                    <Popover.Content class="w-(--bits-popover-anchor-width) p-0">
                      <Command.Root shouldFilter={false}>
                        <Command.Input
                          placeholder="Search project / phase..."
                          bind:value={phaseSearch}
                        />
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
                      onValueChange={(val) => (newWorktypeId = val ? Number(val) : null)}
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
                  <Input id="startTime" type="time" bind:value={newStartTime} required />
                </div>

                <!-- End time -->
                <div class="space-y-1">
                  <Label for="endTime">End</Label>
                  <Input id="endTime" type="time" bind:value={newEndTime} />
                </div>
              </div>

              <!-- Row 3: Description -->
              <div class="space-y-1">
                <Label for="description">Description</Label>
                <Textarea
                  id="description"
                  bind:value={newDescription}
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
        {:else}
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
