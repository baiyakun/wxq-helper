<script setup lang="ts" generic="T extends string">
/** Single-select segmented chips. */
defineProps<{ label: string; options: { value: T; label: string }[] }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="flex items-center gap-2" role="radiogroup" :aria-label="label">
    <span class="w-11 shrink-0 text-xs text-faint">{{ label }}</span>
    <div class="no-scrollbar flex min-w-0 gap-1 overflow-x-auto rounded-full bg-surface-2 p-0.5">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        role="radio"
        :aria-checked="model === o.value"
        class="h-7 shrink-0 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors"
        :class="model === o.value ? 'bg-surface-3 font-medium text-text shadow-sm' : 'text-muted hover:text-text'"
        @click="model = o.value"
      >{{ o.label }}</button>
    </div>
  </div>
</template>
