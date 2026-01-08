<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { getCurrentUser, logout } from '$lib/remote';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { Button } from '$lib/components/ui/button';
	import { Clock, Settings, LogOut, User } from '@lucide/svelte';

	let { children } = $props();

	// Get current user - this runs on the server via remote function
	const userPromise = getCurrentUser({});

	async function handleLogout() {
		await logout({});
		await invalidateAll();
		goto('/login');
	}

	// Check if current path matches
	function isActive(path: string): boolean {
		return page.url.pathname === path || page.url.pathname.startsWith(path + '/');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Inside - Time Tracking</title>
</svelte:head>

{#await userPromise}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-muted-foreground">Loading...</div>
	</div>
{:then user}
	{#if user && page.url.pathname !== '/login'}
		<div class="flex min-h-screen flex-col">
			<!-- Navigation Header -->
			<header class="border-border bg-card sticky top-0 z-50 border-b">
				<div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
					<div class="flex items-center gap-6">
						<a href="/" class="text-xl font-semibold">Inside</a>

						<nav class="flex items-center gap-1">
							<a
								href="/"
								class="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
								class:bg-accent={isActive('/')}
							>
								<Clock class="h-4 w-4" />
								Hours
							</a>

							{#if user.role === 'admin'}
								<a
									href="/admin"
									class="hover:bg-accent flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
									class:bg-accent={isActive('/admin')}
								>
									<Settings class="h-4 w-4" />
									Admin
								</a>
							{/if}
						</nav>
					</div>

					<div class="flex items-center gap-4">
						<div class="text-muted-foreground flex items-center gap-2 text-sm">
							<User class="h-4 w-4" />
							<span>{user.firstName} {user.lastName}</span>
						</div>

						<Button variant="ghost" size="sm" onclick={handleLogout}>
							<LogOut class="mr-2 h-4 w-4" />
							Logout
						</Button>
					</div>
				</div>
			</header>

			<!-- Main Content -->
			<main class="flex-1">
				{@render children()}
			</main>
		</div>
	{:else}
		{@render children()}
	{/if}
{/await}
