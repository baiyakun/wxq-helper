<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Badge from '@/components/Badge.vue'
import CardIcon from '@/components/CardIcon.vue'
import CardLink from '@/components/CardLink.vue'
import CoreBadge from '@/components/CoreBadge.vue'
import DetailSection from '@/components/details/DetailSection.vue'
import HeroAvatar from '@/components/HeroAvatar.vue'
import NavIcon from '@/components/NavIcon.vue'
import RichText from '@/components/RichText.vue'
import { CORE_META } from '@/components/ui'
import { copyText } from '@/composables/clipboard'
import { findLineup, isFavorite, toggleFavorite } from '@/composables/favorites'
import { showToast } from '@/composables/toast'
import { useDetail } from '@/composables/useDetail'
import { campColor } from '@/data/display'
import { formatMonthDay, formatWan } from '@/data/format'
import { useDb } from '@/data/store'
import type { LineupHero } from '@/types/data'

const route = useRoute()
const db = useDb()
const { open } = useDetail()

const key = computed(() => String(route.params.key ?? ''))
const found = computed(() => findLineup(db, key.value))
const lineup = computed(() => found.value?.lineup)
const fav = computed(() => (lineup.value ? isFavorite(lineup.value.key) : false))

const COLS = 7
const ROWS = [3, 2, 1, 0] // z = 3 is the front row, drawn at the top

const board = computed(() => {
  const cells = new Map<string, LineupHero>()
  for (const h of lineup.value?.heroes ?? []) cells.set(`${h.x},${h.z}`, h)
  return ROWS.map((z) => Array.from({ length: COLS }, (_, x) => cells.get(`${x},${z}`) ?? null))
})

const heroName = (id: number) => db.heroById.get(id)?.name ?? `#${id}`
const equipped = computed(() => (lineup.value?.heroes ?? []).filter((h) => h.equips.length > 0))
const usedRoles = computed(() => ([1, 2, 3] as const).filter((r) => lineup.value?.heroes.some((h) => h.core === r)))

async function copyCode() {
  const l = lineup.value
  if (!l) return
  const ok = await copyText(l.key)
  showToast(ok ? `已复制阵容码 ${l.key}，在游戏「阵容-收藏阵容-导入阵容」中粘贴` : `复制失败，请手动复制：${l.key}`, 4000)
}

function onFavorite() {
  if (lineup.value) showToast(toggleFavorite(lineup.value) ? '已收藏，可在「我的」中查看' : '已取消收藏')
}
</script>

<template>
  <div v-if="lineup" class="mx-auto max-w-3xl">
    <RouterLink to="/lineups" class="mb-3 hidden items-center gap-1 text-sm text-muted hover:text-text lg:inline-flex">
      <NavIcon name="back" :size="16" />阵容榜
    </RouterLink>

    <div v-if="found?.removed" class="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--q6)_40%,transparent)] bg-[color-mix(in_srgb,var(--q6)_10%,transparent)] px-3 py-2 text-[13px]">
      该阵容已不在官方榜单中（可能随赛季更新下架）。以下是你收藏时保存的内容，阵容码可能已失效。
    </div>

    <!-- Header -->
    <header>
      <h2 class="text-xl leading-snug font-semibold">{{ lineup.name }}</h2>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <Badge v-for="c in lineup.camps" :key="c" :color="campColor(c)">{{ c }}</Badge>
        <Badge v-for="t in lineup.tags" :key="t" color="var(--accent)">{{ t }}</Badge>
      </div>
      <p class="mt-2 text-[13px] text-muted">
        <span v-if="lineup.author">{{ lineup.author }}</span>
        <span v-if="lineup.uses"> · {{ formatWan(lineup.uses) }}人使用</span>
        <span v-if="lineup.scoreNum"> · 评分 {{ lineup.score.toFixed(1) }}（{{ lineup.scoreNum }}人）</span>
        <span v-if="lineup.likes"> · {{ lineup.likes }}赞</span>
        <span v-if="lineup.createdAt"> · {{ formatMonthDay(lineup.createdAt) }}发布</span>
      </p>
      <div class="mt-3 flex gap-2">
        <button type="button" class="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 font-medium text-accent-ink" @click="copyCode">
          <NavIcon name="copy" :size="18" />复制阵容码
          <span class="font-mono text-xs opacity-70">{{ lineup.key }}</span>
        </button>
        <button
          type="button"
          class="flex h-11 items-center justify-center gap-1.5 rounded-xl border px-4 text-sm"
          :class="fav ? 'border-accent text-accent' : 'border-line text-muted hover:text-text'"
          :aria-pressed="fav"
          @click="onFavorite"
        >
          <NavIcon name="star" :size="18" :filled="fav" />{{ fav ? '已收藏' : '收藏' }}
        </button>
      </div>
    </header>

    <!-- Board -->
    <DetailSection title="站位">
      <div class="mx-auto max-w-[480px] rounded-2xl border border-line bg-surface p-2">
        <div class="mb-1 text-center text-[11px] text-faint">▲ 前排（面向敌人）</div>
        <div class="space-y-1">
          <div v-for="(row, ri) in board" :key="ri" class="grid grid-cols-7 gap-1">
            <div v-for="(cell, ci) in row" :key="ci" class="flex aspect-[4/5] flex-col items-center justify-start rounded-lg bg-surface-2 pt-1">
              <button v-if="cell" type="button" class="flex w-full flex-col items-center" :aria-label="heroName(cell.id)" @click="open('hero', cell.id)">
                <HeroAvatar :id="cell.id" :core="cell.core" :size="38" />
                <span class="mt-0.5 w-full truncate px-0.5 text-center text-[10px] leading-tight">{{ heroName(cell.id) }}</span>
                <span v-if="cell.equips.length" class="mt-0.5 flex gap-px">
                  <CardIcon
                    v-for="eid in cell.equips"
                    :key="eid"
                    :src="db.equipById.get(eid)?.icon ?? ''"
                    :name="db.equipById.get(eid)?.name ?? '?'"
                    :size="12"
                    round
                  />
                </span>
              </button>
            </div>
          </div>
        </div>
        <div v-if="usedRoles.length" class="mt-2 flex justify-center gap-4 text-[11px] text-muted">
          <span v-for="r in usedRoles" :key="r" class="flex items-center gap-1"><CoreBadge :role="r" :size="14" />{{ CORE_META[r].label }}</span>
        </div>
      </div>
      <p v-if="lineup.positionDesc" class="mt-2 text-[14px] leading-relaxed text-muted"><RichText :text="lineup.positionDesc" /></p>
    </DetailSection>

    <DetailSection v-if="lineup.brief" title="阵容思路">
      <p class="text-[15px] leading-relaxed"><RichText :text="lineup.brief" /></p>
    </DetailSection>

    <DetailSection v-if="lineup.lords.length" title="推荐棋手">
      <ul class="space-y-2">
        <li v-for="id in lineup.lords" :key="id" class="rounded-xl bg-surface-2 p-3">
          <CardLink kind="lord" :id="id" />
          <p v-if="lineup.lordTips[id]" class="mt-2 text-[14px] leading-relaxed text-muted"><RichText :text="lineup.lordTips[id] ?? ''" /></p>
        </li>
      </ul>
    </DetailSection>

    <DetailSection v-if="lineup.stages.length" title="分阶段运营">
      <ol class="relative space-y-3 border-l-2 border-line pl-4">
        <li v-for="(s, i) in lineup.stages" :key="i" class="relative">
          <span class="absolute top-1.5 -left-[23px] size-3 rounded-full border-2 border-accent bg-bg" aria-hidden="true" />
          <div class="text-sm font-semibold">第 {{ s.from }}–{{ s.to }} 回合</div>
          <div v-if="s.main.length || s.sub.length" class="mt-2 flex flex-wrap items-center gap-1.5">
            <button v-for="id in s.main" :key="`m${id}`" type="button" :aria-label="heroName(id)" @click="open('hero', id)">
              <HeroAvatar :id="id" :size="34" />
            </button>
            <template v-if="s.sub.length">
              <span class="mx-1 text-xs text-faint">过渡</span>
              <button v-for="id in s.sub" :key="`s${id}`" type="button" class="opacity-70" :aria-label="heroName(id)" @click="open('hero', id)">
                <HeroAvatar :id="id" :size="28" />
              </button>
            </template>
          </div>
          <p v-if="s.desc" class="mt-2 text-[14px] leading-relaxed text-muted"><RichText :text="s.desc" /></p>
        </li>
      </ol>
    </DetailSection>

    <DetailSection v-if="equipped.length || lineup.equipDesc" title="装备">
      <ul v-if="equipped.length" class="space-y-2">
        <li v-for="h in equipped" :key="`${h.id}-${h.x}-${h.z}`" class="flex flex-wrap items-center gap-2">
          <CardLink kind="hero" :id="h.id" />
          <span class="text-faint">→</span>
          <CardLink v-for="eid in h.equips" :key="eid" kind="equip" :id="eid" />
        </li>
      </ul>
      <p v-if="lineup.equipDesc" class="mt-2 text-[14px] leading-relaxed text-muted"><RichText :text="lineup.equipDesc" /></p>
    </DetailSection>

    <DetailSection v-if="lineup.talents.length || lineup.talentDesc" title="天赋">
      <div class="flex flex-wrap gap-2">
        <CardLink v-for="id in lineup.talents" :key="id" kind="talent" :id="id" />
      </div>
      <p v-if="lineup.talentDesc" class="mt-2 text-[14px] leading-relaxed text-muted"><RichText :text="lineup.talentDesc" /></p>
    </DetailSection>

    <DetailSection v-if="lineup.effects.length || lineup.effectDesc" title="效果牌">
      <div class="flex flex-wrap gap-2">
        <CardLink v-for="id in lineup.effects" :key="id" kind="effect" :id="id" />
      </div>
      <p v-if="lineup.effectDesc" class="mt-2 text-[14px] leading-relaxed text-muted"><RichText :text="lineup.effectDesc" /></p>
    </DetailSection>
  </div>

  <div v-else class="mx-auto mt-16 max-w-sm text-center">
    <p class="font-medium">没有找到这套阵容</p>
    <p class="mt-1 text-sm text-muted">它可能已随赛季更新从官方榜单下架。</p>
    <RouterLink to="/lineups" class="mt-4 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">返回阵容榜</RouterLink>
  </div>
</template>
