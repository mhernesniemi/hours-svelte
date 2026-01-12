<script lang="ts">
  import { loginWithLdap } from "$lib/remote";
  import { Button } from "$lib/components/ui/button";
  import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
  } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
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
        // Use window.location for full page reload to ensure server-side session is recognized
        window.location.href = "/dashboard";
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
  <title>Inside</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
  <Card class="w-full max-w-md">
    <CardHeader class="space-y-1 text-center">
      <CardTitle class="text-2xl font-bold text-[#ff3c1b]">Inside</CardTitle>
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
          <Label for="username">Username</Label>
          <Input
            id="username"
            type="text"
            bind:value={username}
            placeholder="Enter your username"
            required
            disabled={isLoading}
          />
        </div>

        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            type="password"
            bind:value={password}
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

      <p class="mt-4 text-center text-sm text-muted-foreground">Use your LDAP credentials</p>
    </CardContent>
  </Card>
</div>
