<script setup lang="ts">
/** A recommended lineup: match score, why it matches, and which heroes are still missing. */
import { computed } from 'vue'
import { isFavorite, toggleFavorite } from '@/composables/favorites'
import { showToast } from '@/composables/toast'
import { useDetail } from '@/composables/useDetail'
import { campColor } from '@/data/display'
import { formatWan } from '@/data/format'
import type { CpHint, Recommendation } from '@/data/recommend'
import { useDb } from '@/data/store'
import type { CoreRole } from '@/types/data'
import Badge from './Badge.vue'
import CardIcon from './CardIcon.vue'
import HeroAvatar from './HeroAvatar.vue'
import NavIcon from './NavIcon.vue'
import { CORE_META } from './ui'

/** `ownership`: the user entered owned heroes, so missing ones are dimmed and listed. */
const props = defineProps<{ rec: Recommendation; ownership: boolean }>()
const db = useDb()
const { open } = useDetail()

const lineup = computed(() => props.rec.lineup)
const heroName = (id: number) => db.heroById.get(id)?.name ?? `#${id}`
const roleLabel = (core: CoreRole) => (core ? CORE_META[core].label : '')

const CORE_ORDER = [9, 0, 1, 2]
const heroes = computed(() => [...lineup.value.heroes].sort((a, b) => (CORE_ORDER[a.core] ?? 9) - (CORE_ORDER[b.core] ?? 9)))
const ownedIds = computed(() => new Set(props.rec.owned.map((h) => h.id)))
const ownedCarries = computed(() => props.rec.owned.filter((h) => h.core === 1).map((h) => heroName(h.id)))
const missingText = computed(() =>
  props.rec.missing.map((h) => (h.core ? `${heroName(h.id)}（${roleLabel(h.core)}）` : heroName(h.id))).join('、'),
)
const lords = computed(() => lineup.value.lords.map((id) => db.lordById.get(id)).filter((l) => l !== undefined))
const matchClass = computed(() => (props.rec.match >= 70 ? 'text-accent' : props.rec.match >= 40 ? 'text-text' : 'text-muted'))
const fav = computed(() => isFavorite(lineup.value.key))

function cpNote(c: CpHint) {
  const giver = c.group.talents.find((t) => t.cp?.grantsCards)
  if (c.missing.length && giver) {
    const which = c.group.talents.length > 1 ? `其中「${giver.name}」` : ''
    return `${which}可直接拿到 ${c.missing.map(heroName).join('、')}`
  }
  return `${c.group.heroes.map(heroName).join(' + ')} 共战生效`
}

function onFavorite() {
  showToast(toggleFavorite(lineup.value) ? '已收藏，可在「我的」中查看' : '已取消收藏')
}
</script>

<template>
  <article class="relative rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-faint">
    <RouterLink :to="`/lineups/${lineup.key}`" class="absolute inset-0 rounded-2xl" :aria-label="`查看阵容：${lineup.name}`" />

    <div class="pointer-events-none relative">
      <div class="flex items-start gap-3 pr-9">
        <div class="flex w-12 shrink-0 flex-col items-center rounded-xl bg-surface-2 py-1">
          <span class="text-lg leading-tight font-bold tabular-nums" :class="matchClass">{{ rec.match }}<span class="text-xs">%</span></span>
          <span class="text-[10px] text-faint">匹配</span>
        </div>
        <div class="min-w-0">
          <h3 class="leading-snug font-semibold">{{ lineup.name }}</h3>
          <div class="mt-1 flex flex-wrap gap-1">
            <Badge v-if="rec.lordMatch" color="var(--q2)">棋手一致</Badge>
            <Badge v-for="c in rec.campMatch" :key="c" :color="campColor(c)">{{ c }}</Badge>
            <Badge v-if="ownership" color="var(--accent)">已有 {{ rec.owned.length }}/{{ lineup.heroes.length }}</Badge>
            <Badge v-if="ownedCarries.length" :color="CORE_META[1].color">已有主C {{ ownedCarries.join('、') }}</Badge>
          </div>
        </div>
      </div>

      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <span
          v-for="h in heroes"
          :key="`${h.id}-${h.x}-${h.z}`"
          :class="ownership && !ownedIds.has(h.id) ? 'opacity-35 grayscale' : ''"
        >
          <HeroAvatar :id="h.id" :core="h.core" :size="36" />
        </span>
      </div>
      <p v-if="ownership && rec.missing.length" class="mt-1.5 text-[13px] leading-relaxed text-muted">
        还缺 {{ rec.missing.length }} 名：{{ missingText }}
      </p>
      <p v-else-if="ownership" class="mt-1.5 text-[13px] text-[var(--q2)]">阵容英雄已经齐了</p>

      <div v-for="c in rec.cps" :key="c.group.key" class="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px]">
        <Badge color="var(--t-exclusive)">CP</Badge>
        <button
          v-for="t in c.group.talents"
          :key="t.id"
          type="button"
          class="pointer-events-auto font-medium text-accent hover:underline"
          @click="open('talent', t.id)"
        >「{{ t.name }}」</button>
        <span class="text-muted">{{ cpNote(c) }}</span>
      </div>

      <div class="mt-2.5 flex items-center gap-2 text-xs text-muted">
        <span v-if="lords.length" class="flex shrink-0 -space-x-1.5">
          <CardIcon v-for="l in lords.slice(0, 3)" :key="l.id" :src="l.avatar" :name="l.name" :size="20" round class="ring-2 ring-[var(--surface)]" />
        </span>
        <span class="min-w-0 truncate">{{ lords.map((l) => l.name).join(' / ') || '任意棋手' }}</span>
        <span class="ml-auto flex shrink-0 items-center gap-2.5">
          <span v-for="c in lineup.camps.slice(0, 2)" :key="c" class="flex items-center gap-1">
            <span class="size-1.5 rounded-full" :style="{ background: campColor(c) }" aria-hidden="true" />{{ c }}
          </span>
          <span v-if="lineup.uses" class="tabular-nums">{{ formatWan(lineup.uses) }}人用</span>
        </span>
      </div>
    </div>

    <button
      type="button"
      class="absolute top-1.5 right-1.5 flex size-10 items-center justify-center rounded-full transition-colors hover:bg-surface-2"
      :class="fav ? 'text-accent' : 'text-faint'"
      :aria-label="fav ? '取消收藏' : '收藏'"
      :aria-pressed="fav"
      @click="onFavorite"
    >
      <NavIcon name="star" :size="20" :filled="fav" />
    </button>
  </article>
</template>
