<script lang="ts">
	import {
		createEntry,
		getPhasesWithHierarchy,
		getWorktypes,
		getCurrentUser
	} from '$lib/remote';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { ArrowLeft, Save, Loader2, AlertCircle, Search } from '@lucide/svelte';
	import { format, set, startOfDay } from 'date-fns';

	// Auth state
	let user = $state<Awaited<ReturnType<typeof getCurrentUser>> | undefined>(undefined);
	let authChecked = $state(false);

	// Check authentication on mount
	$effect(() => {
		getCurrentUser({}).then((u) => {
			user = u;
			authChecked = true;
			if (!u) {
				goto('/login');
			}
		});
	});

	// Form state
	let date = $state(format(new Date(), 'yyyy-MM-dd'));
	let startTime = $state(format(new Date(), 'HH:mm'));
	let endTime = $state('');
	let description = $state('');
	let issueCode = $state('');
	let phaseId = $state<number | null>(null);
	let worktypeId = $state<number | null>(null);

	// Search/filter state
	let phaseSearch = $state('');
	let showPhaseDropdown = $state(false);

	// UI state
	let isSubmitting = $state(false);
	let error = $state('');

	// Load data
	const phasesPromise = getPhasesWithHierarchy({});
	const worktypesPromise = getWorktypes({});

	// Filter phases by search
	function getFilteredPhases(phases: Awaited<typeof phasesPromise>, search: string) {
		if (!search) return phases.slice(0, 20);
		const lower = search.toLowerCase();
		return phases
			.filter((p) => p.fullName.toLowerCase().includes(lower))
			.slice(0, 20);
	}

	function selectPhase(phase: { id: number; fullName: string }) {
		phaseId = phase.id;
		phaseSearch = phase.fullName;
		showPhaseDropdown = false;
	}

	function getSelectedPhaseName(
		phases: Awaited<typeof phasesPromise>,
		id: number | null
	): string {
		if (!id) return '';
		const phase = phases.find((p) => p.id === id);
		return phase?.fullName || '';
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		isSubmitting = true;

		try {
			// Parse date and times
			const dateObj = startOfDay(new Date(date));
			const [startHour, startMin] = startTime.split(':').map(Number);
			const startDateTime = set(dateObj, { hours: startHour, minutes: startMin });

			let endDateTime: Date | null = null;
			if (endTime) {
				const [endHour, endMin] = endTime.split(':').map(Number);
				endDateTime = set(dateObj, { hours: endHour, minutes: endMin });
			}

			const result = await createEntry({
				startTime: startDateTime,
				endTime: endDateTime,
				description: description || null,
				issueCode: issueCode || null,
				phaseId,
				worktypeId
			});

			if (result.success) {
				goto('/');
			} else {
				error = result.error || 'Failed to create entry';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create entry';
		} finally {
			isSubmitting = false;
		}
	}
</script>

<svelte:head>
	<title>New Entry - Inside</title>
</svelte:head>

{#if !authChecked}
	<div class="flex min-h-[50vh] items-center justify-center">
		<div class="text-muted-foreground">Loading...</div>
	</div>
{:else if user}
		<div class="mx-auto max-w-2xl p-4">
			<div class="mb-6">
				<Button variant="ghost" onclick={() => goto('/')}>
					<ArrowLeft class="mr-2 h-4 w-4" />
					Back
				</Button>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>New Hour Entry</CardTitle>
				</CardHeader>
				<CardContent>
					<form onsubmit={handleSubmit} class="space-y-6">
						{#if error}
							<div
								class="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm"
							>
								<AlertCircle class="h-4 w-4" />
								{error}
							</div>
						{/if}

						<!-- Date -->
						<div class="space-y-2">
							<label for="date" class="text-sm font-medium">Date</label>
							<input
								id="date"
								type="date"
								bind:value={date}
								class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								required
							/>
						</div>

						<!-- Time Range -->
						<div class="grid grid-cols-2 gap-4">
							<div class="space-y-2">
								<label for="startTime" class="text-sm font-medium">Start Time</label>
								<input
									id="startTime"
									type="time"
									bind:value={startTime}
									class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									required
								/>
							</div>
							<div class="space-y-2">
								<label for="endTime" class="text-sm font-medium">End Time (optional)</label>
								<input
									id="endTime"
									type="time"
									bind:value={endTime}
									class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								/>
							</div>
						</div>

						<!-- Description -->
						<div class="space-y-2">
							<label for="description" class="text-sm font-medium">Description</label>
							<textarea
								id="description"
								bind:value={description}
								rows={3}
								class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								placeholder="What did you work on?"
							></textarea>
						</div>

						<!-- Issue Code -->
						<div class="space-y-2">
							<label for="issueCode" class="text-sm font-medium">Issue Code (optional)</label>
							<input
								id="issueCode"
								type="text"
								bind:value={issueCode}
								class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								placeholder="e.g., PROJ-123"
							/>
						</div>

						<!-- Phase Selection -->
						<div class="space-y-2">
							<label for="phase" class="text-sm font-medium">Project / Phase</label>
							<div class="relative">
								{#await phasesPromise}
									<input
										type="text"
										class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
										placeholder="Loading phases..."
										disabled
									/>
								{:then phases}
									<div class="relative">
										<Search
											class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
										/>
										<input
											id="phase"
											type="text"
											bind:value={phaseSearch}
											onfocus={() => (showPhaseDropdown = true)}
											onblur={() => setTimeout(() => (showPhaseDropdown = false), 200)}
											class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border py-2 pr-3 pl-10 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
											placeholder="Search customer / project / phase..."
										/>
									</div>
									{#if showPhaseDropdown}
										<div
											class="border-border bg-popover absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border shadow-lg"
										>
											{#each getFilteredPhases(phases, phaseSearch) as phase}
												<button
													type="button"
													class="hover:bg-accent w-full px-3 py-2 text-left text-sm"
													onmousedown={() => selectPhase(phase)}
												>
													{phase.fullName}
												</button>
											{:else}
												<div class="text-muted-foreground px-3 py-2 text-sm">No phases found</div>
											{/each}
										</div>
									{/if}
									{#if phaseId && !showPhaseDropdown}
										<p class="text-muted-foreground mt-1 text-xs">
											Selected: {getSelectedPhaseName(phases, phaseId)}
										</p>
									{/if}
								{/await}
							</div>
						</div>

						<!-- Worktype Selection -->
						<div class="space-y-2">
							<label for="worktype" class="text-sm font-medium">Work Type</label>
							{#await worktypesPromise}
								<select
									class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
									disabled
								>
									<option>Loading...</option>
								</select>
							{:then worktypes}
								<select
									id="worktype"
									bind:value={worktypeId}
									class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
								>
									<option value={null}>Select work type...</option>
									{#each worktypes as wt}
										<option value={wt.id}>{wt.name}</option>
									{/each}
								</select>
							{/await}
						</div>

						<!-- Submit -->
						<div class="flex justify-end gap-3">
							<Button type="button" variant="outline" onclick={() => goto('/')}>Cancel</Button>
							<Button type="submit" disabled={isSubmitting}>
								{#if isSubmitting}
									<Loader2 class="mr-2 h-4 w-4 animate-spin" />
									Saving...
								{:else}
									<Save class="mr-2 h-4 w-4" />
									Save Entry
								{/if}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
{/if}
