<script setup lang="ts">
import { computed } from 'vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import CpCard from '@/components/CpCard.vue'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { cpStats, type CpStats } from '@/data/cp'
import { nameMatches } from '@/data/search'
import { useDb } from '@/data/store'

const db = useDb()
const q = usePersistentRef('codex:cp:q', '', 'session')

const usage = (s: CpStats) => s.both + [...s.byTalent.values()].reduce((a, b) => a + b, 0)

// Pairs used by more official lineups come first.
const rows = db.cpGroups
  .map((group) => ({
    group,
    stats: cpStats(db, group),
    names: [...group.heroes.map((id) => db.heroById.get(id)?.name ?? ''), ...group.talents.map((t) => t.name)],
  }))
  .sort((a, b) => usage(b.stats) - usage(a.stats) || a.group.key.localeCompare(b.group.key))

const list = computed(() => rows.filter((r) => !q.value || r.names.some((n) => nameMatches(n, q.value))))
</script>

<template>
  <div>
    <CodexToolbar
      v-model:query="q"
      :count="list.length"
      unit="组 CP"
      placeholder="搜英雄或天赋名（支持拼音首字母）"
      :filtered="!!q"
      @reset="q = ''"
    />
    <p class="-mt-1 mb-3 text-[13px] text-muted">CP 天赋需要两名英雄同时上场（共战）才生效。点头像或天赋查看详情。</p>
    <ul v-if="list.length" class="grid gap-3 lg:grid-cols-2">
      <li v-for="r in list" :key="r.group.key">
        <CpCard :group="r.group" :stats="r.stats" />
      </li>
    </ul>
    <p v-else class="py-16 text-center text-muted">没有找到“{{ q }}”相关的 CP</p>
  </div>
</template>
