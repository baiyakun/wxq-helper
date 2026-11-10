<script setup lang="ts">
/** List card of a 钻石狂潮 lineup: its opening pack, rating in the current room and heroes. */
import { computed } from 'vue'
import { isRushFavorite, toggleRushFavorite } from '@/composables/rushFavorites'
import { showToast } from '@/composables/toast'
import { campColor } from '@/data/display'
import { categoryLabel, gradeColor, sortHeroes } from '@/data/rush'
import type { RushLineup, RushRoom } from '@/types/data'
import Badge from './Badge.vue'
import CardIcon from './CardIcon.vue'
import HeroAvatar from './HeroAvatar.vue'
import NavIcon from './NavIcon.vue'

const props = defineProps<{ lineup: RushLineup; room: RushRoom; rank?: number; removed?: boolean }>()

const rating = computed(() => props.lineup.ratings[props.room])
const heroes = computed(() => sortHeroes(props.lineup.groups[0]?.heroes ?? []))
const fav = computed(() => isRushFavorite(props.lineup.id))

function onFavorite() {
  showToast(toggleRushFavorite(props.lineup) ? '已收藏，可在「我的」中查看' : '已取消收藏')
}
</script>

<template>
  <article class="relative rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-faint">
    <RouterLink :to="`/rush/${lineup.id}`" class="absolute inset-0 rounded-2xl" :aria-label="`查看狂潮阵容：${lineup.name}`" />

    <div class="pointer-events-none relative">
      <div class="flex items-start gap-2.5 pr-9">
        <span v-if="rank" class="mt-px min-w-7 shrink-0 text-sm font-semibold text-faint tabular-nums">#{{ rank }}</span>
        <div class="min-w-0 flex-1">
          <h3 class="leading-snug font-semibold">{{ lineup.pack?.name ?? lineup.name }}</h3>
          <div class="mt-1 flex flex-wrap gap-1">
            <Badge v-if="removed" color="var(--q6)">已下架</Badge>
            <Badge color="var(--accent)">{{ categoryLabel(lineup.category) }}</Badge>
            <Badge v-for="c in lineup.camps.slice(0, 2)" :key="c" :color="campColor(c)">{{ c }}</Badge>
          </div>
        </div>
        <span
          v-if="rating"
          class="flex shrink-0 flex-col items-center leading-none"
          :style="{ color: gradeColor(rating.grade) }"
          :aria-label="`评级 ${rating.grade}，${rating.score} 分`"
        >
          <span class="text-[22px] font-bold">{{ rating.grade }}</span>
          <span class="mt-0.5 text-[11px] text-muted tabular-nums">{{ rating.score }}分</span>
        </span>
        <span v-else class="shrink-0 text-xs text-faint">暂无评级</span>
      </div>

      <div class="mt-2.5 flex flex-wrap gap-1.5">
        <template v-for="h in heroes" :key="`${h.id}-${h.x}-${h.z}`">
          <HeroAvatar v-if="h.id" :id="h.id" :core="h.core" :size="34" />
          <CardIcon v-else :src="h.icon ?? ''" :name="h.name ?? '?'" :size="34" />
        </template>
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
