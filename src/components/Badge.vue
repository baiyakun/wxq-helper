<script setup lang="ts">
withDefaults(defineProps<{ color?: string }>(), { color: 'var(--muted)' })
</script>

<template>
  <span
    class="inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[11px] leading-none font-medium whitespace-nowrap"
    :style="{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }"
  >
    <slot />
  </span>
</template>
