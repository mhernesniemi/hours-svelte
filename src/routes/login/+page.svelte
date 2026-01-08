<script lang="ts">
  import { loginWithLdap } from "$lib/remote";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from "$lib/components/ui/card";
  import { Clock, AlertCircle, Loader2 } from "@lucide/svelte";

  let username = $state("");
  let password = $state("");
  let error = $state("");
  let isLoading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    error = "";
    isLoading = true;

    try {
      const result = await loginWithLdap({ username, password });

      if (result.success) {
        goto("/");
      } else {
        error = "Invalid credentials";
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Login failed";
    } finally {
      isLoading = false;
    }
  }
</script>

<svelte:head>
  <title>Login - Inside</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
  <Card class="w-full max-w-md">
    <CardHeader class="space-y-1 text-center">
      <div class="mb-4 flex justify-center">
        <div class="rounded-full bg-primary/10 p-3">
          <Clock class="h-8 w-8 text-primary" />
        </div>
      </div>
      <CardTitle class="text-2xl font-bold">Inside</CardTitle>
      <CardDescription>Time Tracking System</CardDescription>
    </CardHeader>

    <CardContent>
      <form onsubmit={handleSubmit} class="space-y-4">
        {#if error}
          <div
            class="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle class="h-4 w-4" />
            {error}
          </div>
        {/if}

        <div class="space-y-2">
          <label for="username" class="text-sm font-medium">Username</label>
          <input
            id="username"
            type="text"
            bind:value={username}
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter your username"
            required
            disabled={isLoading}
          />
        </div>

        <div class="space-y-2">
          <label for="password" class="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            bind:value={password}
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Enter your password"
            required
            disabled={isLoading}
          />
        </div>

        <Button type="submit" class="w-full" disabled={isLoading}>
          {#if isLoading}
            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          {:else}
            Sign in
          {/if}
        </Button>
      </form>

      <p class="mt-4 text-center text-sm text-muted-foreground">
        Use your corporate LDAP credentials
      </p>
    </CardContent>
  </Card>
</div>
