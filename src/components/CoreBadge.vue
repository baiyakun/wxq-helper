<script setup lang="ts">
/** Core-hero marker used by official lineups: 1 = ACE carry, 2 = tank, 3 = utility. */
import type { CoreRole } from '@/types/data'
import NavIcon from './NavIcon.vue'
import { CORE_META } from './ui'

defineProps<{ role: CoreRole; size?: number }>()
</script>

<template>
  <span
    v-if="role"
    class="inline-flex items-center justify-center rounded-full text-white ring-2 ring-[var(--bg)]"
    :style="{ width: `${size ?? 16}px`, height: `${size ?? 16}px`, background: CORE_META[role].color }"
    :title="CORE_META[role].label"
    role="img"
    :aria-label="CORE_META[role].label"
  >
    <NavIcon :name="CORE_META[role].icon" :size="Math.round((size ?? 16) * 0.66)" filled />
  </span>
</template>
