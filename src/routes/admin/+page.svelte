<script lang="ts">
  import {
    getUsers,
    getSyncLogs,
    importAll,
    importCustomers,
    importProjects,
    importPhases,
    importWorktypes,
    importUsers
  } from "$lib/remote";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from "$lib/components/ui/card";
  import {
    RefreshCw,
    Users,
    Building2,
    FolderKanban,
    Layers,
    Briefcase,
    Loader2,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle
  } from "@lucide/svelte";
  import { format } from "date-fns";

  // User comes from +page.server.ts load function
  let { data } = $props();
  const user = data.user;

  // UI state
  let isSyncing = $state<string | null>(null);
  let syncResult = $state<{ type: string; success: boolean; message: string } | null>(null);

  // Load data
  let usersPromise = $state(getUsers({}));
  let syncLogsPromise = $state(getSyncLogs({}));

  async function handleSync(
    type: "all" | "customers" | "projects" | "phases" | "worktypes" | "users"
  ) {
    isSyncing = type;
    syncResult = null;

    try {
      let result;
      switch (type) {
        case "all":
          result = await importAll({});
          break;
        case "customers":
          result = await importCustomers({});
          break;
        case "projects":
          result = await importProjects({});
          break;
        case "phases":
          result = await importPhases({});
          break;
        case "worktypes":
          result = await importWorktypes({});
          break;
        case "users":
          result = await importUsers({});
          break;
      }

      if (result.success) {
        syncResult = {
          type,
          success: true,
          message: `Successfully synced ${type === "all" ? "all data" : type}`
        };
        // Refresh data
        usersPromise = getUsers({});
        syncLogsPromise = getSyncLogs({});
      } else {
        syncResult = {
          type,
          success: false,
          message: (result as { error?: string }).error || "Sync failed"
        };
      }
    } catch (error) {
      syncResult = {
        type,
        success: false,
        message: error instanceof Error ? error.message : "Sync failed"
      };
    } finally {
      isSyncing = null;
    }
  }

  function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return format(d, "MMM d, yyyy HH:mm");
  }
</script>

<svelte:head>
  <title>Admin - Inside</title>
</svelte:head>

{#if user.role !== "admin"}
  <div class="flex min-h-[50vh] items-center justify-center">
    <Card class="max-w-md">
      <CardContent class="flex flex-col items-center py-8">
        <AlertCircle class="mb-4 h-12 w-12 text-destructive" />
        <p class="text-lg font-medium">Access Denied</p>
        <p class="mt-2 text-sm text-muted-foreground">
          You need admin privileges to access this page.
        </p>
        <Button class="mt-4" onclick={() => goto("/dashboard")}>Go to Hours</Button>
      </CardContent>
    </Card>
  </div>
{:else}
  <div class="mx-auto max-w-5xl p-4">
    <h1 class="mb-6 text-2xl font-bold">Admin</h1>

    {#if syncResult}
      <div
        class={`mb-4 flex items-center gap-2 rounded-md p-3 text-sm ${syncResult.success ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}`}
      >
        {#if syncResult.success}
          <CheckCircle class="h-4 w-4" />
        {:else}
          <XCircle class="h-4 w-4" />
        {/if}
        {syncResult.message}
      </div>
    {/if}

    <!-- Sync Controls -->
    <Card class="mb-6">
      <CardHeader>
        <CardTitle>Data Sync</CardTitle>
        <CardDescription>Import data from Visma Severa</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            class="h-auto justify-start p-4"
            onclick={() => handleSync("all")}
            disabled={isSyncing !== null}
          >
            {#if isSyncing === "all"}
              <Loader2 class="mr-3 h-5 w-5 animate-spin" />
            {:else}
              <RefreshCw class="mr-3 h-5 w-5" />
            {/if}
            <div class="text-left">
              <div class="font-medium">Sync All</div>
              <div class="text-xs text-muted-foreground">Import all data</div>
            </div>
          </Button>

          <Button
            variant="outline"
            class="h-auto justify-start p-4"
            onclick={() => handleSync("customers")}
            disabled={isSyncing !== null}
          >
            {#if isSyncing === "customers"}
              <Loader2 class="mr-3 h-5 w-5 animate-spin" />
            {:else}
              <Building2 class="mr-3 h-5 w-5" />
            {/if}
            <div class="text-left">
              <div class="font-medium">Customers</div>
              <div class="text-xs text-muted-foreground">Import customers</div>
            </div>
          </Button>

          <Button
            variant="outline"
            class="h-auto justify-start p-4"
            onclick={() => handleSync("projects")}
            disabled={isSyncing !== null}
          >
            {#if isSyncing === "projects"}
              <Loader2 class="mr-3 h-5 w-5 animate-spin" />
            {:else}
              <FolderKanban class="mr-3 h-5 w-5" />
            {/if}
            <div class="text-left">
              <div class="font-medium">Projects</div>
              <div class="text-xs text-muted-foreground">Import projects/cases</div>
            </div>
          </Button>

          <Button
            variant="outline"
            class="h-auto justify-start p-4"
            onclick={() => handleSync("phases")}
            disabled={isSyncing !== null}
          >
            {#if isSyncing === "phases"}
              <Loader2 class="mr-3 h-5 w-5 animate-spin" />
            {:else}
              <Layers class="mr-3 h-5 w-5" />
            {/if}
            <div class="text-left">
              <div class="font-medium">Phases</div>
              <div class="text-xs text-muted-foreground">Import project phases</div>
            </div>
          </Button>

          <Button
            variant="outline"
            class="h-auto justify-start p-4"
            onclick={() => handleSync("worktypes")}
            disabled={isSyncing !== null}
          >
            {#if isSyncing === "worktypes"}
              <Loader2 class="mr-3 h-5 w-5 animate-spin" />
            {:else}
              <Briefcase class="mr-3 h-5 w-5" />
            {/if}
            <div class="text-left">
              <div class="font-medium">Work Types</div>
              <div class="text-xs text-muted-foreground">Import work types</div>
            </div>
          </Button>

          <Button
            variant="outline"
            class="h-auto justify-start p-4"
            onclick={() => handleSync("users")}
            disabled={isSyncing !== null}
          >
            {#if isSyncing === "users"}
              <Loader2 class="mr-3 h-5 w-5 animate-spin" />
            {:else}
              <Users class="mr-3 h-5 w-5" />
            {/if}
            <div class="text-left">
              <div class="font-medium">Users</div>
              <div class="text-xs text-muted-foreground">Import users</div>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Users List -->
    <Card class="mb-6">
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>Registered users in the system</CardDescription>
      </CardHeader>
      <CardContent>
        {#await usersPromise}
          <div class="py-8 text-center text-muted-foreground">Loading users...</div>
        {:then users}
          {#if users.length === 0}
            <div class="py-8 text-center text-muted-foreground">
              No users found. Run a sync to import users.
            </div>
          {:else}
            <div class="divide-y divide-border">
              {#each users as u}
                <div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div>
                    <div class="font-medium">{u.firstName} {u.lastName}</div>
                    <div class="text-sm text-muted-foreground">{u.email}</div>
                  </div>
                  <div class="flex items-center gap-3">
                    <span
                      class={`rounded-full px-2 py-0.5 text-xs ${u.role === "admin" ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                    >
                      {u.role}
                    </span>
                    <span
                      class={`rounded-full px-2 py-0.5 text-xs ${u.active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}
                    >
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:catch error}
          <div class="py-8 text-center text-destructive">Failed to load users</div>
        {/await}
      </CardContent>
    </Card>

    <!-- Sync Logs -->
    <Card>
      <CardHeader>
        <CardTitle>Sync History</CardTitle>
        <CardDescription>Recent data synchronization logs</CardDescription>
      </CardHeader>
      <CardContent>
        {#await syncLogsPromise}
          <div class="py-8 text-center text-muted-foreground">Loading logs...</div>
        {:then logs}
          {#if logs.length === 0}
            <div class="py-8 text-center text-muted-foreground">No sync logs found.</div>
          {:else}
            <div class="divide-y divide-border">
              {#each logs.slice(0, 10) as log}
                <div class="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div class="flex items-center gap-3">
                    {#if log.status === "completed"}
                      <CheckCircle class="h-4 w-4 text-green-600" />
                    {:else if log.status === "failed"}
                      <XCircle class="h-4 w-4 text-red-600" />
                    {:else}
                      <Clock class="h-4 w-4 text-muted-foreground" />
                    {/if}
                    <div>
                      <div class="text-sm font-medium">
                        {log.type} - {log.entityType}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {formatDate(log.startedAt)}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    {#if log.recordsProcessed}
                      <div class="text-sm">{log.recordsProcessed} records</div>
                    {/if}
                    {#if log.error}
                      <div class="max-w-xs truncate text-xs text-destructive">{log.error}</div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:catch error}
          <div class="py-8 text-center text-destructive">Failed to load logs</div>
        {/await}
      </CardContent>
    </Card>
  </div>
{/if}
