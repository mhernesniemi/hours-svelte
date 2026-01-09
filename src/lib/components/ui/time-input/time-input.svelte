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

    // Combine with colon after 2 digits (hours complete)
    if (hours.length === 2) {
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

  function onKeyDown(e: KeyboardEvent) {
    // Handle backspace to skip the colon
    if (e.key === "Backspace") {
      const target = e.target as HTMLInputElement;
      const cursorPos = target.selectionStart ?? 0;

      // If cursor is right after the colon (position 3) and nothing selected
      if (cursorPos === 3 && target.selectionStart === target.selectionEnd) {
        e.preventDefault();
        // Remove the last digit of hours (position 1) and the colon
        const digits = value.replace(/\D/g, "");
        value = digits.slice(0, 1);
      }
    }
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
  autocomplete="off"
  {value}
  maxlength="5"
  placeholder="HH:MM"
  oninput={onInput}
  onfocus={onFocus}
  onblur={onBlur}
  onkeydown={onKeyDown}
  class={cn(
    "flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-base tabular-nums shadow-xs ring-offset-background transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    className
  )}
  {...restProps}
/>
