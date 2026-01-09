<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn, type WithElementRef } from "$lib/utils.js";

  type Props = WithElementRef<Omit<HTMLInputAttributes, "type" | "value">> & {
    value?: string;
  };

  let {
    ref = $bindable(null),
    value = $bindable(""),
    class: className,
    ...restProps
  }: Props = $props();

  function onInput(e: Event) {
    const target = e.target as HTMLInputElement;
    // Remove non-digits
    let val = target.value.replace(/\D/g, "");

    // Limit to 4 digits
    if (val.length > 4) val = val.slice(0, 4);

    let hours = val.slice(0, 2);
    let minutes = val.slice(2, 4);

    // Enforce 24-hour max for hours
    if (hours) {
      let h = parseInt(hours);
      if (h > 23) h = 23;
      hours = h.toString().padStart(hours.length, "0");
    }

    // Enforce 59 max for minutes
    if (minutes) {
      let m = parseInt(minutes);
      if (m > 59) m = 59;
      minutes = m.toString().padStart(minutes.length, "0");
    }

    // Combine with colon if we have minutes
    if (minutes) {
      value = hours + ":" + minutes;
    } else if (hours) {
      value = hours;
    } else {
      value = "";
    }
  }

  function onFocus(e: FocusEvent) {
    const target = e.target as HTMLInputElement;
    // Select all on focus for easy replacement
    target.select();
  }

  function onBlur() {
    // If empty, keep empty
    if (!value) return;

    // If incomplete, try to complete it
    const digits = value.replace(/\D/g, "");
    if (digits.length === 0) {
      value = "";
      return;
    }

    let hours = digits.slice(0, 2).padStart(2, "0");
    let minutes = digits.slice(2, 4).padStart(2, "0");

    // Validate
    let h = parseInt(hours);
    let m = parseInt(minutes);
    if (h > 23) h = 23;
    if (m > 59) m = 59;

    value = h.toString().padStart(2, "0") + ":" + m.toString().padStart(2, "0");
  }
</script>

<input
  bind:this={ref}
  type="text"
  inputmode="numeric"
  {value}
  maxlength="5"
  placeholder="HH:MM"
  oninput={onInput}
  onfocus={onFocus}
  onblur={onBlur}
  class={cn(
    "border-input bg-background selection:bg-primary dark:bg-input/30 selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base tabular-nums shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    className
  )}
  {...restProps}
/>
