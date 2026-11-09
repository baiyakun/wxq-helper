<script setup lang="ts" generic="T extends string">
/** Single-select segmented chips. */
defineProps<{ label: string; options: { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="flex items-center gap-2" role="radiogroup" :aria-label="label">
    <span class="w-11 shrink-0 text-xs text-faint">{{ label }}</span>
    <!-- Phones: fill the row and share the width so all options fit without scrolling (down to 360px wide) -->
    <div class="no-scrollbar flex min-w-0 flex-1 overflow-x-auto rounded-full bg-surface-2 p-0.5 sm:flex-none sm:gap-1">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="radio"
        :aria-checked="model === o.value"
        class="h-7 flex-1 shrink-0 rounded-full px-1.5 text-[13px] whitespace-nowrap transition-colors sm:flex-none sm:px-3"
        :class="model === o.value ? 'bg-surface-3 font-medium text-text shadow-sm' : 'text-muted hover:text-text'"
        @click="model = o.value"
      >{{ o.label }}</button>
    </div>
  </div>
</template>
