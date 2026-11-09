<script setup lang="ts">
/** Hero avatar with tier ring and optional core badge; looks up the hero by id. */
import { computed } from 'vue'
import { tierColor } from '@/data/display'
import { useDb } from '@/data/store'
import type { CoreRole } from '@/types/data'
import CardIcon from './CardIcon.vue'
import CoreBadge from './CoreBadge.vue'

const props = withDefaults(defineProps<{ id: number; size?: number; core?: CoreRole }>(), { size: 36, core: 0 })
const hero = computed(() => useDb().heroById.get(props.id))
</script>

<template>
  <span class="relative inline-flex shrink-0">
    <CardIcon :src="hero?.avatar ?? ''" :name="hero?.name ?? '?'" :size="size" :ring="hero ? tierColor(hero.quality) : ''" />
    <CoreBadge v-if="core" :role="core" :size="Math.max(14, Math.round(size * 0.4))" class="absolute -top-1 -right-1" />
  </span>
</template>
