<script setup lang="ts">
/** Small tappable chip that opens another card's detail. */
import { computed } from 'vue'
import { useDetail } from '@/composables/useDetail'
import { cardBrief, type CardKind } from '@/data/store'
import CardIcon from './CardIcon.vue'

const props = defineProps<{ kind: CardKind; id: number; sub?: string }>()
const brief = computed(() => cardBrief(props.kind, props.id))
const { open } = useDetail()
</script>

<template>
  <button
    v-if="brief"
    type="button"
    class="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pr-3 pl-1 text-left text-sm transition-colors hover:border-accent"
    @click="open(kind, id)"
  >
    <CardIcon :src="brief.icon" :name="brief.name" :size="26" round />
    <span class="truncate font-medium">{{ brief.name }}</span>
    <span v-if="sub" class="truncate text-xs text-muted">{{ sub }}</span>
  </button>
  <span v-else class="text-sm text-faint">未知卡牌 #{{ id }}</span>
</template>
