<script setup lang="ts">
import { computed } from 'vue'
import { isFavorite, toggleFavorite } from '@/composables/favorites'
import { showToast } from '@/composables/toast'
import { campColor } from '@/data/display'
import { formatWan } from '@/data/format'
import { useDb } from '@/data/store'
import type { Lineup } from '@/types/data'
import Badge from './Badge.vue'
import CardIcon from './CardIcon.vue'
import HeroAvatar from './HeroAvatar.vue'
import NavIcon from './NavIcon.vue'

const props = defineProps<{ lineup: Lineup; isNew?: boolean; removed?: boolean; rank?: number }>()
const db = useDb()

/** Core heroes (ACE, tank, utility) first, then the rest in board order. */
const CORE_ORDER = [9, 0, 1, 2]
const heroes = computed(() => [...props.lineup.heroes].sort((a, b) => (CORE_ORDER[a.core] ?? 9) - (CORE_ORDER[b.core] ?? 9)))
const lords = computed(() => props.lineup.lords.map((id) => db.lordById.get(id)).filter((l) => l !== undefined))
const fav = computed(() => isFavorite(props.lineup.key))

function onFavorite() {
  showToast(toggleFavorite(props.lineup) ? '已收藏，可在「我的」中查看' : '已取消收藏')
}
</script>

<template>
  <article class="group relative rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-faint">
    <RouterLink :to="`/lineups/${lineup.key}`" class="absolute inset-0 rounded-2xl" :aria-label="`查看阵容：${lineup.name}`" />

    <div class="pointer-events-none relative">
      <div class="flex items-start gap-2 pr-9">
        <span v-if="rank" class="mt-px min-w-7 shrink-0 text-sm font-semibold text-faint tabular-nums">#{{ rank }}</span>
        <div class="min-w-0">
          <h3 class="leading-snug font-semibold">{{ lineup.name }}</h3>
          <div v-if="isNew || removed || lineup.tags.length" class="mt-1 flex flex-wrap gap-1">
            <Badge v-if="removed" color="var(--q6)">已下架</Badge>
            <Badge v-if="isNew" color="var(--q2)">新上榜</Badge>
            <Badge v-for="t in lineup.tags" :key="t" color="var(--accent)">{{ t }}</Badge>
          </div>
        </div>
      </div>

      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <HeroAvatar v-for="h in heroes" :key="`${h.id}-${h.x}-${h.z}`" :id="h.id" :core="h.core" :size="36" />
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
