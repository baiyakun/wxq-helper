<script setup lang="ts">
/** 7 × 4 board of a 钻石狂潮 lineup; units that are not hero cards show Huya's icon. */
import { computed } from 'vue'
import { useDetail } from '@/composables/useDetail'
import { useDb } from '@/data/store'
import type { RushHero } from '@/types/data'
import CardIcon from './CardIcon.vue'
import CoreBadge from './CoreBadge.vue'
import HeroAvatar from './HeroAvatar.vue'
import { CORE_META } from './ui'

const props = defineProps<{ heroes: RushHero[] }>()
const db = useDb()
const { open } = useDetail()

const COLS = 7
const ROWS = [3, 2, 1, 0] // z = 3 is the front row, drawn at the top

const board = computed(() => {
  const cells = new Map<string, RushHero>()
  for (const h of props.heroes) cells.set(`${h.x},${h.z}`, h)
  return ROWS.map((z) => Array.from({ length: COLS }, (_, x) => cells.get(`${x},${z}`) ?? null))
})

const nameOf = (h: RushHero) => (h.id ? (db.heroById.get(h.id)?.name ?? `#${h.id}`) : (h.name ?? '?'))
const usedRoles = computed(() => ([1, 2, 3] as const).filter((r) => props.heroes.some((h) => h.core === r)))
</script>

<template>
  <div class="mx-auto max-w-[480px] rounded-2xl border border-line bg-surface p-2">
    <div class="mb-1 text-center text-[11px] text-faint">▲ 前排（面向敌人）</div>
    <div class="space-y-1">
      <div v-for="(row, ri) in board" :key="ri" class="grid grid-cols-7 gap-1">
        <div v-for="(cell, ci) in row" :key="ci" class="flex aspect-[4/5] flex-col items-center justify-start rounded-lg bg-surface-2 pt-1">
          <component
            :is="cell.id ? 'button' : 'div'"
            v-if="cell"
            :type="cell.id ? 'button' : undefined"
            class="flex w-full flex-col items-center"
            :aria-label="nameOf(cell)"
            @click="cell.id && open('hero', cell.id)"
          >
            <HeroAvatar v-if="cell.id" :id="cell.id" :core="cell.core" :size="38" />
            <span v-else class="relative inline-flex">
              <CardIcon :src="cell.icon ?? ''" :name="nameOf(cell)" :size="38" />
              <CoreBadge v-if="cell.core" :role="cell.core" :size="15" class="absolute -top-1 -right-1" />
            </span>
            <span class="mt-0.5 w-full truncate px-0.5 text-center text-[10px] leading-tight">{{ nameOf(cell) }}</span>
            <span v-if="cell.equips.length" class="mt-0.5 flex gap-px">
              <CardIcon
                v-for="(eid, i) in cell.equips"
                :key="`${eid}-${i}`"
                :src="db.equipById.get(eid)?.icon ?? ''"
                :name="db.equipById.get(eid)?.name ?? '?'"
                :size="12"
                round
              />
            </span>
          </component>
        </div>
      </div>
    </div>
    <div v-if="usedRoles.length" class="mt-2 flex justify-center gap-4 text-[11px] text-muted">
      <span v-for="r in usedRoles" :key="r" class="flex items-center gap-1"><CoreBadge :role="r" :size="14" />{{ CORE_META[r].label }}</span>
    </div>
  </div>
</template>
