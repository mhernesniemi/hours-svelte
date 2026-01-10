<script lang="ts" generics="T">
  import type { Snippet } from "svelte";

  interface Props {
    promise: Promise<T>;
    loading?: Snippet;
    children: Snippet<[T]>;
    error?: Snippet<[Error]>;
  }

  let { promise, loading, children, error }: Props = $props();
</script>

{#await promise}
  {#if loading}
    {@render loading()}
  {/if}
{:then data}
  {@render children(data)}
{:catch err}
  {#if error}
    {@render error(err)}
  {/if}
{/await}
