<script setup lang="ts">
import { computed } from 'vue'
import Badge from '@/components/Badge.vue'
import CardRow from '@/components/CardRow.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import { useDetail } from '@/composables/useDetail'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { EQUIP_SUB_COLOR, byOrder, equipColor } from '@/data/display'
import { nameMatches } from '@/data/search'
import { useDb } from '@/data/store'

const db = useDb()
const { open } = useDetail()

const SUB_ORDER = Object.keys(EQUIP_SUB_COLOR)
const KIND_ORDER = ['通用装备', '物理装备', '法术装备', '防御装备']

const empty = () => ({ subs: [] as string[], kinds: [] as string[] })
const f = usePersistentRef('codex:equips:filters', empty())
const q = usePersistentRef('codex:equips:q', '', 'session')

const subOptions = [...new Set(db.equips.map((e) => e.sub).filter(Boolean))]
  .sort(byOrder(SUB_ORDER))
  .map((s) => ({ value: s, label: s.replace('装备', ''), color: equipColor(s) }))
const kindOptions = [...new Set(db.equips.map((e) => e.kind).filter(Boolean))]
  .sort(byOrder(KIND_ORDER))
  .map((k) => ({ value: k, label: k.replace('装备', '') }))

const anyOf = <T,>(selected: T[], v: T) => !selected.length || selected.includes(v)
const subRank = (s: string) => SUB_ORDER.indexOf(s) + 1 || 99

const list = computed(() =>
  db.equips
    .filter((e) => anyOf(f.value.subs, e.sub) && anyOf(f.value.kinds, e.kind) && nameMatches(e.name, q.value))
    .sort((a, b) => subRank(a.sub) - subRank(b.sub) || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.id - b.id),
)

const filtered = computed(() => !!q.value || Object.values(f.value).some((v) => v.length > 0))
function reset() {
  f.value = empty()
  q.value = ''
}
</script>

<template>
  <div>
    <CodexToolbar v-model:query="q" :count="list.length" unit="件装备" placeholder="搜索装备（支持拼音首字母）" :filtered="filtered" @reset="reset">
      <ChipGroup v-model="f.subs" label="分类" :options="subOptions" />
      <ChipGroup v-model="f.kinds" label="类型" :options="kindOptions" />
    </CodexToolbar>

    <ul v-if="list.length" class="-mx-2 grid gap-x-4 lg:grid-cols-2">
      <li v-for="e in list" :key="e.id">
        <CardRow :icon="e.icon" :name="e.name" :ring="equipColor(e.sub)" :desc="e.desc" @select="open('equip', e.id)">
          <template #badges>
            <Badge :color="equipColor(e.sub)">{{ e.sub.replace('装备', '') }}</Badge>
            <Badge>{{ e.kind.replace('装备', '') }}</Badge>
          </template>
        </CardRow>
      </li>
    </ul>
    <p v-else class="py-16 text-center text-muted">没有符合条件的装备</p>
  </div>
</template>
