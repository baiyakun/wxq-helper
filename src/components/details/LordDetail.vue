<script setup lang="ts">
import { computed } from 'vue'
import { useDetail } from '@/composables/useDetail'
import { useDb } from '@/data/store'
import type { LordSlot } from '@/types/data'
import Badge from '../Badge.vue'
import CardIcon from '../CardIcon.vue'
import RichText from '../RichText.vue'
import DetailHeader from './DetailHeader.vue'
import DetailSection from './DetailSection.vue'

const props = defineProps<{ id: number }>()
const db = useDb()
const { open } = useDetail()
const lord = computed(() => db.lordById.get(props.id))

const slots = computed(() => {
  const l = lord.value
  if (!l) return []
  const list: { title: string; slot: LordSlot }[] = []
  if (l.skill) list.push({ title: '技能', slot: l.skill })
  if (l.secret) list.push({ title: '秘技', slot: l.secret })
  if (l.exclusive) list.push({ title: `专属天赋 · ${l.exclusive.level} 级领取`, slot: l.exclusive })
  return list
})

/** Exclusive talents that exist in the talent table can be opened as a talent card. */
const isTalent = (id: number) => db.talentById.has(id)
</script>

<template>
  <div v-if="lord">
    <DetailHeader :icon="lord.avatar" :name="lord.name" round>
      <Badge color="var(--accent)">棋手</Badge>
    </DetailHeader>

    <DetailSection v-for="s in slots" :key="s.title" :title="s.title">
      <component
        :is="isTalent(s.slot.id) ? 'button' : 'div'"
        :type="isTalent(s.slot.id) ? 'button' : undefined"
        class="flex w-full items-start gap-3 rounded-xl bg-surface-2 p-3 text-left"
        :class="isTalent(s.slot.id) ? 'transition-colors hover:bg-surface-3' : ''"
        @click="isTalent(s.slot.id) && open('talent', s.slot.id)"
      >
        <CardIcon :src="s.slot.icon" :name="s.slot.name" :size="40" round />
        <span class="min-w-0">
          <span class="block font-medium">{{ s.slot.name }}</span>
          <span class="block text-[14px] leading-relaxed"><RichText :text="s.slot.desc" :interactive="!isTalent(s.slot.id)" /></span>
        </span>
      </component>
      <ul v-if="s.slot.cards.length" class="mt-2 space-y-2 border-l-2 border-line pl-3">
        <li v-for="c in s.slot.cards" :key="c.id" class="flex items-start gap-3">
          <CardIcon :src="c.icon" :name="c.name" :size="32" />
          <span class="min-w-0">
            <span class="block text-sm font-medium">{{ c.name }}</span>
            <span class="block text-[13px] leading-relaxed text-muted"><RichText :text="c.desc" /></span>
          </span>
        </li>
      </ul>
    </DetailSection>
  </div>
  <p v-else class="py-10 text-center text-muted">没有找到这名棋手</p>
</template>
