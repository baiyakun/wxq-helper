<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/Badge.vue'
import CardRow from '@/components/CardRow.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import { useDetail } from '@/composables/useDetail'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { PACK_ORDER, STAGE_ORDER, TALENT_GRADE, byOrder, stageShort, talentGrade } from '@/data/display'
import { nameMatches } from '@/data/search'
import { useDb } from '@/data/store'
import type { Talent } from '@/types/data'

const db = useDb()
const { open } = useDetail()

type Special = 'cp' | 'exclusive'
const empty = () => ({ grades: [] as number[], stages: [] as string[], packs: [] as string[], special: [] as string[] })
const f = usePersistentRef('codex:talents:filters', empty())
const q = usePersistentRef('codex:talents:q', '', 'session')

const gradeOptions = Object.entries(TALENT_GRADE).map(([q, g]) => ({ value: Number(q), label: g.label, color: g.color }))
const specialOptions: { value: Special; label: string; color: string }[] = [
  { value: 'cp', label: 'CP天赋', color: 'var(--t-exclusive)' },
  { value: 'exclusive', label: '棋手专属', color: 'var(--accent)' },
]
const stageOptions = [...new Set(db.talents.map((t) => t.stage).filter(Boolean))]
  .sort(byOrder(STAGE_ORDER))
  .map((s) => ({ value: s, label: stageShort(s) }))
const packOptions = [...new Set(db.talents.map((t) => t.pack).filter(Boolean))]
  .sort(byOrder(PACK_ORDER))
  .map((p) => ({ value: p, label: p }))

const matchesSpecial = (t: Talent, special: string[]) =>
  !special.length || (special.includes('cp') && !!t.cp) || (special.includes('exclusive') && t.lordId !== undefined)

const anyOf = <T,>(selected: T[], v: T) => !selected.length || selected.includes(v)

const list = computed(() =>
  db.talents
    .filter(
      (t) =>
        anyOf(f.value.grades, t.quality) &&
        anyOf(f.value.stages, t.stage) &&
        anyOf(f.value.packs, t.pack) &&
        matchesSpecial(t, f.value.special) &&
        nameMatches(t.name, q.value),
    )
    .sort((a, b) => a.stageNo - b.stageNo || a.quality - b.quality || a.id - b.id),
)

const filtered = computed(() => !!q.value || Object.values(f.value).some((v) => v.length > 0))
function reset() {
  f.value = empty()
  q.value = ''
}
</script>

<template>
  <div>
    <CodexToolbar v-model:query="q" :count="list.length" unit="个天赋" placeholder="搜索天赋（支持拼音首字母）" :filtered="filtered" @reset="reset">
      <ChipGroup v-model="f.special" label="类型" :options="specialOptions" />
      <ChipGroup v-model="f.grades" label="品阶" :options="gradeOptions" />
      <ChipGroup v-model="f.stages" label="时机" :options="stageOptions" />
      <ChipGroup v-model="f.packs" label="卡包" :options="packOptions" />
    </CodexToolbar>

    <ul v-if="list.length" class="-mx-2 grid gap-x-4 lg:grid-cols-2">
      <li v-for="t in list" :key="t.id">
        <CardRow :icon="t.icon" :name="t.name" :ring="talentGrade(t.quality).color" :desc="t.desc" @select="open('talent', t.id)">
          <template #badges>
            <Badge :color="talentGrade(t.quality).color">{{ talentGrade(t.quality).label }}</Badge>
            <Badge v-if="t.cp" color="var(--t-exclusive)">CP</Badge>
            <Badge v-if="t.stage">{{ stageShort(t.stage) }}</Badge>
          </template>
        </CardRow>
      </li>
    </ul>
    <p v-else class="py-16 text-center text-muted">没有符合条件的天赋</p>
  </div>
</template>
