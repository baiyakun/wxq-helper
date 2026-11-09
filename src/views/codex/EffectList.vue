<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/Badge.vue'
import CardRow from '@/components/CardRow.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import { useDetail } from '@/composables/useDetail'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { EFFECT_PACK_ORDER, byOrder, campColor, tierColor } from '@/data/display'
import { nameMatches } from '@/data/search'
import { useDb } from '@/data/store'
import { CAMPS } from '@/types/data'

const db = useDb()
const { open } = useDetail()

const CAMP_ORDER = ['通用', ...CAMPS]

const empty = () => ({ camps: [] as string[], tiers: [] as number[], packs: [] as string[] })
const f = usePersistentRef('codex:effects:filters', empty())
const q = usePersistentRef('codex:effects:q', '', 'session')

const campOptions = [...new Set(db.effects.map((e) => e.camp).filter(Boolean))]
  .sort(byOrder(CAMP_ORDER))
  .map((c) => ({ value: c, label: c, color: campColor(c) }))
const tierOptions = [...new Set(db.effects.map((e) => e.quality))].sort((a, b) => a - b).map((n) => ({ value: n, label: `${n}阶`, color: tierColor(n) }))
const packOptions = [...new Set(db.effects.map((e) => e.pack).filter(Boolean))]
  .sort(byOrder(EFFECT_PACK_ORDER))
  .map((p) => ({ value: p, label: p }))

const anyOf = <T,>(selected: T[], v: T) => !selected.length || selected.includes(v)

const list = computed(() =>
  db.effects
    .filter(
      (e) =>
        anyOf(f.value.camps, e.camp) && anyOf(f.value.tiers, e.quality) && anyOf(f.value.packs, e.pack) && nameMatches(e.name, q.value),
    )
    .sort((a, b) => a.quality - b.quality || CAMP_ORDER.indexOf(a.camp) - CAMP_ORDER.indexOf(b.camp) || a.id - b.id),
)

const filtered = computed(() => !!q.value || Object.values(f.value).some((v) => v.length > 0))
function reset() {
  f.value = empty()
  q.value = ''
}
</script>

<template>
  <div>
    <CodexToolbar v-model:query="q" :count="list.length" unit="张效果牌" placeholder="搜索效果牌（支持拼音首字母）" :filtered="filtered" @reset="reset">
      <ChipGroup v-model="f.camps" label="阵营" :options="campOptions" />
      <ChipGroup v-model="f.tiers" label="阶数" :options="tierOptions" />
      <ChipGroup v-model="f.packs" label="卡包" :options="packOptions" />
    </CodexToolbar>

    <ul v-if="list.length" class="-mx-2 grid gap-x-4 lg:grid-cols-2">
      <li v-for="e in list" :key="e.id">
        <CardRow :icon="e.icon" :name="e.name" :ring="tierColor(e.quality)" :desc="e.desc" @select="open('effect', e.id)">
          <template #badges>
            <Badge :color="tierColor(e.quality)">{{ e.quality }}阶</Badge>
            <Badge :color="campColor(e.camp)">{{ e.camp }}</Badge>
            <Badge v-if="e.cost > 0" color="var(--accent)">{{ e.cost }}能量</Badge>
          </template>
        </CardRow>
      </li>
    </ul>
    <p v-else class="py-16 text-center text-muted">没有符合条件的效果牌</p>
  </div>
</template>
