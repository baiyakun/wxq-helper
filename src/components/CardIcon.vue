<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src: string
    name: string
    size?: number
    /** CSS color for the inner ring (tier / grade) */
    ring?: string
    round?: boolean
  }>(),
  { size: 44, ring: '', round: false },
)

const failed = ref(false)
watch(
  () => props.src,
  () => (failed.value = false),
)
</script>

<template>
  <span
    class="relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-surface-3"
    :class="round ? 'rounded-full' : 'rounded-[10px]'"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      outline: ring ? `2px solid ${ring}` : undefined,
      outlineOffset: ring ? '-2px' : undefined,
    }"
  >
    <img
      v-if="src && !failed"
      :src="src"
      :alt="name"
      loading="lazy"
      decoding="async"
      referrerpolicy="no-referrer"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <span v-else class="text-sm font-medium text-muted" aria-hidden="true">{{ name.slice(0, 1) }}</span>
  </span>
</template>
