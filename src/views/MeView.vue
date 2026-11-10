<script setup lang="ts">
import { computed } from 'vue'
import LineupCard from '@/components/LineupCard.vue'
import RushLineupCard from '@/components/RushLineupCard.vue'
import { listFavorites } from '@/composables/favorites'
import { listRushFavorites } from '@/composables/rushFavorites'
import { rushRoom } from '@/composables/rushRoom'
import { useDb } from '@/data/store'

const db = useDb()
const favorites = computed(() => listFavorites(db))
const rushFavorites = computed(() => listRushFavorites(db))
const fmt = (iso: string) => new Date(iso).toLocaleString('zh-CN', { hour12: false })

const counts = computed(() => [
  { k: '英雄', v: db.meta.counts.heroes },
  { k: '棋手', v: db.meta.counts.lords },
  { k: '天赋', v: db.meta.counts.talents },
  { k: 'CP天赋', v: db.meta.counts.cpTalents },
  { k: '装备', v: db.meta.counts.equips },
  { k: '效果牌', v: db.meta.counts.effects },
  { k: '官方阵容', v: db.meta.counts.lineups },
  { k: '虎牙阵容', v: db.meta.counts.huyaLineups ?? 0 },
  { k: '狂潮阵容', v: db.meta.counts.rushLineups ?? 0 },
])
</script>

<template>
  <div class="space-y-4">
    <!-- With only 钻石狂潮 favorites, the empty state below would be misleading -->
    <section v-if="favorites.length || !rushFavorites.length">
      <h2 class="mb-2 font-semibold">
        收藏的阵容 <span class="text-sm font-normal text-faint tabular-nums">{{ favorites.length }}</span>
      </h2>
      <ul v-if="favorites.length" class="grid gap-3 lg:grid-cols-2">
        <li v-for="f in favorites" :key="f.lineup.key">
          <LineupCard :lineup="f.lineup" :removed="f.removed" />
        </li>
      </ul>
      <div v-else class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        还没有收藏。在阵容卡片或详情页点 ☆ 即可收藏。
        <RouterLink to="/lineups" class="mt-3 block text-accent">去阵容榜看看</RouterLink>
      </div>
    </section>

    <section v-if="rushFavorites.length">
      <h2 class="mb-2 font-semibold">
        收藏的狂潮阵容 <span class="text-sm font-normal text-faint tabular-nums">{{ rushFavorites.length }}</span>
      </h2>
      <ul class="grid gap-3 lg:grid-cols-2">
        <li v-for="f in rushFavorites" :key="f.lineup.id">
          <RushLineupCard :lineup="f.lineup" :room="rushRoom" :removed="f.removed" />
        </li>
      </ul>
    </section>

    <section class="rounded-2xl border border-line bg-surface p-4">
      <h2 class="font-semibold">数据版本</h2>
      <dl class="mt-3 space-y-1.5 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-muted">同步时间</dt><dd class="tabular-nums">{{ fmt(db.meta.updatedAt) }}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-muted">官方数据更新</dt><dd class="tabular-nums">{{ fmt(db.meta.sourceModifiedAt) }}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-muted">版本号</dt><dd class="font-mono text-xs">{{ db.meta.hash }}</dd></div>
      </dl>
      <ul class="mt-4 grid grid-cols-4 gap-2 text-center">
        <li v-for="c in counts" :key="c.k" class="rounded-xl bg-surface-2 py-2">
          <div class="font-semibold tabular-nums">{{ c.v }}</div>
          <div class="text-[11px] text-faint">{{ c.k }}</div>
        </li>
      </ul>
    </section>

    <section class="rounded-2xl border border-line bg-surface p-4 text-sm leading-relaxed text-muted">
      <h2 class="font-semibold text-text">关于</h2>
      <p class="mt-1">
        非官方的个人研究工具。数据来自王者万象棋官网公开的卡牌与阵容数据，以及虎牙万象棋助手收录的阵容、实战统计和钻石狂潮的卡包评级与拍卖推荐，定时自动同步。卡牌名称、文案与图片版权归腾讯所有。
      </p>
    </section>
  </div>
</template>
