<script setup lang="ts">
/**
 * A 钻石狂潮 card with its text. Cards that exist in the official data open their detail on tap;
 * the others (auction picks, pack cards) are shown in full right here.
 */
import { computed } from 'vue'
import { useDetail } from '@/composables/useDetail'
import type { RushCard } from '@/types/data'
import Badge from './Badge.vue'
import CardIcon from './CardIcon.vue'
import HeroAvatar from './HeroAvatar.vue'
import RichText from './RichText.vue'

const props = defineProps<{
  card: RushCard
  /** small label before the name, e.g. 首选 / 备选 */
  label?: string
  /** secondary line, e.g. series or "×3" */
  sub?: string
  /** right-aligned note, e.g. the bid estimate */
  note?: string
  highlight?: boolean
  /** badge after the name, e.g. 关键 */
  badge?: string
}>()

const { open } = useDetail()
const linked = computed(() => props.card.id > 0)
const KIND_LABEL: Record<RushCard['kind'], string> = { hero: '英雄', talent: '天赋', effect: '效果牌', equip: '装备' }
</script>

<template>
  <component
    :is="linked ? 'button' : 'div'"
    :type="linked ? 'button' : undefined"
    class="flex w-full items-start gap-2.5 rounded-xl border p-2.5 text-left"
    :class="[highlight ? 'border-accent bg-surface-2' : 'border-line bg-surface', linked ? 'transition-colors hover:border-faint' : '']"
    @click="linked && open(card.kind, card.id)"
  >
    <HeroAvatar v-if="card.kind === 'hero' && card.id" :id="card.id" :size="40" />
    <CardIcon v-else :src="card.icon" :name="card.name" :size="40" />
    <span class="min-w-0 flex-1">
      <span class="flex items-baseline gap-1.5">
        <span v-if="label" class="shrink-0 text-[11px] font-medium" :class="highlight ? 'text-accent' : 'text-faint'">{{ label }}</span>
        <span class="min-w-0 truncate font-medium">{{ card.name }}</span>
        <Badge v-if="badge" color="var(--q6)" class="self-center">{{ badge }}</Badge>
        <span v-if="note" class="ml-auto shrink-0 pl-2 text-[12px] text-muted tabular-nums">{{ note }}</span>
      </span>
      <span class="block text-[11px] text-faint">{{ sub ?? KIND_LABEL[card.kind] }}</span>
      <span v-if="card.desc" class="mt-1 block text-[13px] leading-relaxed text-muted"><RichText :text="card.desc" :interactive="false" /></span>
    </span>
  </component>
</template>
