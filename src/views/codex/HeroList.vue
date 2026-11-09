<script setup lang="ts">
import { computed } from 'vue'
import CardIcon from '@/components/CardIcon.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import { useDetail } from '@/composables/useDetail'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { campColor, tierColor } from '@/data/display'
import { nameMatches } from '@/data/search'
import { useDb } from '@/data/store'
import { CAMPS } from '@/types/data'

const db = useDb()
const { open } = useDetail()

const empty = () => ({ camps: [] as string[], tiers: [] as number[], labels: [] as string[], keywords: [] as string[] })
const f = usePersistentRef('codex:heroes:filters', empty())
const q = usePersistentRef('codex:heroes:q', '', 'session')

const campOptions = CAMPS.map((c) => ({ value: c as string, label: c, color: campColor(c) }))
const tierOptions = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}阶`, color: tierColor(n) }))
const labelOptions = [...new Set(db.heroes.flatMap((h) => h.labels))].sort().map((l) => ({ value: l, label: l }))
const keywordOptions = (() => {
  const count = new Map<string, number>()
  for (const h of db.heroes) for (const k of h.keywords) count.set(k, (count.get(k) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => ({ value: k, label: k }))
})()

const anyOf = <T,>(selected: T[], values: T[]) => !selected.length || values.some((v) => selected.includes(v))

const list = computed(() =>
  db.heroes
    .filter(
      (h) =>
        anyOf(f.value.camps, [h.camp]) &&
        anyOf(f.value.tiers, [h.quality]) &&
        anyOf(f.value.labels, h.labels) &&
        anyOf(f.value.keywords, h.keywords) &&
        nameMatches(h.name, q.value),
    )
    .sort((a, b) => a.quality - b.quality || CAMPS.indexOf(a.camp) - CAMPS.indexOf(b.camp) || a.id - b.id),
)

const filtered = computed(() => !!q.value || Object.values(f.value).some((v) => v.length > 0))
function reset() {
  f.value = empty()
  q.value = ''
}
</script>

<template>
  <div>
    <CodexToolbar v-model:query="q" :count="list.length" unit="名英雄" placeholder="搜索英雄（支持拼音首字母）" :filtered="filtered" @reset="reset">
      <ChipGroup v-model="f.camps" label="阵营" :options="campOptions" />
      <ChipGroup v-model="f.tiers" label="阶数" :options="tierOptions" />
      <ChipGroup v-model="f.labels" label="定位" :options="labelOptions" />
      <ChipGroup v-model="f.keywords" label="关键词" :options="keywordOptions" />
    </CodexToolbar>

    <ul v-if="list.length" class="grid grid-cols-4 gap-x-1 gap-y-2 sm:grid-cols-6 lg:grid-cols-8">
      <li v-for="h in list" :key="h.id">
        <button
          type="button"
          class="flex w-full flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors hover:bg-surface-2 active:bg-surface-3"
          @click="open('hero', h.id)"
        >
          <CardIcon :src="h.avatar" :name="h.name" :size="56" :ring="tierColor(h.quality)" />
          <span class="w-full truncate text-center text-[13px] font-medium">{{ h.name }}</span>
          <span class="flex items-center gap-1 text-[11px] text-faint">
            <span class="size-1.5 rounded-full" :style="{ background: campColor(h.camp) }" aria-hidden="true" />{{ h.camp }}
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="py-16 text-center text-muted">没有符合条件的英雄</p>
  </div>
</template>
