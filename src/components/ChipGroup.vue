<script setup lang="ts" generic="T extends string | number">
/** Multi-select filter chips. Empty selection means "all". */
import type { ChipOption } from './ui'

defineProps<{ label: string; options: ChipOption<T>[] }>()
const model = defineModel<T[]>({ required: true })

function toggle(v: T) {
  model.value = model.value.includes(v) ? model.value.filter((x) => x !== v) : [...model.value, v]
}
</script>

<template>
  <div class="flex items-center gap-2" role="group" :aria-label="label">
    <span class="w-11 shrink-0 text-xs text-faint">{{ label }}</span>
    <div class="no-scrollbar -mr-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5 pr-4 lg:mr-0 lg:flex-wrap lg:pr-0">
      <button
        type="button"
        class="chip"
        :class="model.length === 0 ? 'chip-on' : 'chip-off'"
        :aria-pressed="model.length === 0"
        @click="model = []"
      >全部</button>
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        class="chip"
        :class="model.includes(o.value) ? 'chip-on' : 'chip-off'"
        :aria-pressed="model.includes(o.value)"
        @click="toggle(o.value)"
      >
        <span v-if="o.color" class="size-2 shrink-0 rounded-full" :style="{ background: o.color }" aria-hidden="true" />
        {{ o.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference '../style.css';

.chip {
  @apply inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] whitespace-nowrap transition-colors;
}
.chip-on {
  @apply border-transparent bg-accent font-medium text-accent-ink;
}
.chip-off {
  @apply border-line bg-surface-2 text-muted hover:text-text;
}
</style>
