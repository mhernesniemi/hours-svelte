<script lang="ts">
  import { tick } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import * as Select from "$lib/components/ui/select";
  import { TimeInput } from "$lib/components/ui/time-input";
  import { Label } from "$lib/components/ui/label";
  import { Textarea } from "$lib/components/ui/textarea";
  import { cn } from "$lib/utils";
  import { Check, X, ChevronsUpDown, Save, Loader2 } from "@lucide/svelte";
  import { formatTime } from "$lib/dashboard";

  type Phase = {
    id: number;
    fullName: string;
  };

  type Worktype = {
    id: number;
    name: string;
  };

  type Entry = {
    id: number;
    startTime: Date | string;
    endTime: Date | string | null;
    description: string | null;
    phaseId: number | null;
    worktypeId: number | null;
  };

  type CopyFromEntry = {
    endTime: Date | string | null;
    description: string | null;
    phaseId: number | null;
    worktypeId: number | null;
  };

  interface Props {
    mode: "create" | "edit";
    entry?: Entry | null;
    copyFromEntry?: CopyFromEntry | null;
    phasesPromise: Promise<Phase[]>;
    worktypesPromise: Promise<Worktype[]>;
    defaultWorktypeId?: number | null;
    isSubmitting?: boolean;
    onsubmit: (data: {
      startTime: string;
      endTime: string;
      description: string;
      phaseId: number | null;
      worktypeId: number | null;
    }) => void;
    oncancel: () => void;
  }

  let {
    mode,
    entry = null,
    copyFromEntry = null,
    phasesPromise,
    worktypesPromise,
    defaultWorktypeId = null,
    isSubmitting = false,
    onsubmit,
    oncancel
  }: Props = $props();

  // Form state - initialized empty, populated by $effect
  let startTime = $state("");
  let endTime = $state("");
  let description = $state("");
  let phaseId = $state<number | null>(null);
  let worktypeId = $state<number | null>(null);

  // UI state
  let phaseSearch = $state("");
  let phaseDropdownOpen = $state(false);
  let worktypeDropdownOpen = $state(false);

  // Refs
  let phaseTriggerRef = $state<HTMLButtonElement>(null!);
  let startTimeInputRef = $state<HTMLInputElement>(null!);
  let endTimeInputRef = $state<HTMLInputElement>(null!);
  let descriptionRef = $state<HTMLTextAreaElement>(null!);

  // Sync form state with entry prop (handles both initial load and changes)
  $effect(() => {
    if (entry) {
      // Edit mode - populate from existing entry
      startTime = formatTime(entry.startTime);
      endTime = entry.endTime ? formatTime(entry.endTime) : "";
      description = entry.description || "";
      phaseId = entry.phaseId;
      worktypeId = entry.worktypeId;
    } else if (copyFromEntry) {
      // Copy mode - start time = copied entry's end time
      startTime = copyFromEntry.endTime ? formatTime(copyFromEntry.endTime) : "";
      endTime = "";
      description = copyFromEntry.description || "";
      phaseId = copyFromEntry.phaseId;
      worktypeId = copyFromEntry.worktypeId;
    } else {
      // Create mode - reset form and apply default worktype
      startTime = "";
      endTime = "";
      description = "";
      phaseId = null;
      worktypeId = defaultWorktypeId;
    }
  });

  // Focus handling - runs when refs become available
  $effect(() => {
    if (mode === "create" && copyFromEntry && startTimeInputRef) {
      // Copy mode - focus on start time when ref is available
      tick().then(() => startTimeInputRef.focus());
    }
  });

  // Open phase dropdown on mount for new entry (not copy)
  $effect(() => {
    if (mode === "create" && !entry && !copyFromEntry) {
      tick().then(() => {
        phaseDropdownOpen = true;
      });
    }
  });

  // Clear search when dropdown opens
  $effect(() => {
    if (phaseDropdownOpen) {
      phaseSearch = "";
    }
  });

  function getFilteredPhases(phases: Phase[], search: string): Phase[] {
    if (!search) return phases.slice(0, 20);
    const lower = search.toLowerCase();
    return phases.filter((p) => p.fullName.toLowerCase().includes(lower)).slice(0, 20);
  }

  function getSelectedPhaseName(phases: Phase[]): string {
    if (!phaseId) return "";
    const phase = phases.find((p) => p.id === phaseId);
    return phase?.fullName || "";
  }

  function selectPhase(phase: Phase) {
    phaseId = phase.id;
    phaseDropdownOpen = false;
    tick().then(() => {
      if (!worktypeId) {
        worktypeDropdownOpen = true;
      } else {
        startTimeInputRef?.focus();
      }
    });
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    onsubmit({
      startTime,
      endTime,
      description,
      phaseId,
      worktypeId
    });
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      if (!isSubmitting) {
        handleSubmit(e);
      }
    }
    if (e.key === "Escape") {
      oncancel();
    }
  }
</script>

<svelte:document onkeydown={handleKeyDown} />

{#await Promise.all([phasesPromise, worktypesPromise])}
  <div class="flex h-32 items-center justify-center">
    <Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
{:then [phases, worktypes]}
  <form onsubmit={handleSubmit} class="space-y-4">
    <div class="mb-2 flex items-center justify-between">
      <h3 class="font-medium">{mode === "create" ? "New Entry" : "Edit Entry"}</h3>
      <Button type="button" variant="ghost" size="icon" onclick={oncancel}>
        <X class="h-4 w-4" />
      </Button>
    </div>

    <!-- Phase Selection -->
    <div class="space-y-1">
      <Label for="phase-combobox">Project</Label>
      <Popover.Root bind:open={phaseDropdownOpen}>
        <Popover.Trigger bind:ref={phaseTriggerRef}>
          {#snippet child({ props })}
            <Button
              {...props}
              id="phase-combobox"
              variant="outline"
              class="w-full justify-between font-normal"
              role="combobox"
              aria-expanded={phaseDropdownOpen}
            >
              <span class="truncate">
                {phaseId ? getSelectedPhaseName(phases) : "Select project..."}
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
                  <Command.Item value={phase.fullName} onSelect={() => selectPhase(phase)}>
                    <Check class={cn("mr-2 h-4 w-4", phaseId !== phase.id && "text-transparent")} />
                    {phase.fullName}
                  </Command.Item>
                {/each}
              </Command.Group>
            </Command.List>
          </Command.Root>
        </Popover.Content>
      </Popover.Root>
    </div>

    <!-- Worktype + Times -->
    <div class="grid grid-cols-4 gap-4">
      <div class="col-span-2 space-y-1">
        <Label for="worktype">Work Type</Label>
        <Select.Root
          type="single"
          bind:open={worktypeDropdownOpen}
          value={worktypeId ? String(worktypeId) : undefined}
          onValueChange={(val) => {
            worktypeId = val ? Number(val) : null;
            if (val) {
              tick().then(() => startTimeInputRef?.focus());
            }
          }}
        >
          <Select.Trigger id="worktype" class="w-full">
            <span data-slot="select-value">
              {#if worktypeId}
                {worktypes.find((wt) => wt.id === worktypeId)?.name || "Select work type..."}
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
      </div>

      <div class="space-y-1">
        <Label for="startTime">Start</Label>
        <TimeInput
          id="startTime"
          bind:value={startTime}
          required
          bind:ref={startTimeInputRef}
          oncomplete={() => endTimeInputRef?.focus()}
        />
      </div>

      <div class="space-y-1">
        <Label for="endTime">End</Label>
        <TimeInput
          id="endTime"
          bind:value={endTime}
          bind:ref={endTimeInputRef}
          oncomplete={() => descriptionRef?.focus()}
        />
      </div>
    </div>

    <!-- Description -->
    <div class="space-y-1">
      <Label for="description">Description</Label>
      <Textarea
        id="description"
        bind:value={description}
        bind:ref={descriptionRef}
        rows={2}
        placeholder="ABC-123 Descripe your task"
      />
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2">
      <Button type="button" variant="outline" size="sm" onclick={oncancel}>Cancel</Button>
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
{/await}
