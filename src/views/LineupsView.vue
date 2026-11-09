<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CardIcon from '@/components/CardIcon.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import HeroAvatar from '@/components/HeroAvatar.vue'
import HeroPicker from '@/components/HeroPicker.vue'
import LineupCard from '@/components/LineupCard.vue'
import NavIcon from '@/components/NavIcon.vue'
import SortChips from '@/components/SortChips.vue'
import { useLineupNews } from '@/composables/lineupNews'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { campColor } from '@/data/display'
import { formatDateTime } from '@/data/format'
import { bestSource, hasAllHeroes, hasAllTalents, parseIdList } from '@/data/lineupQuery'
import { nameMatches } from '@/data/search'
import { useDb } from '@/data/store'
import { CAMPS, type Lineup, type LineupSource } from '@/types/data'

defineOptions({ name: 'LineupsView' })

const db = useDb()
const route = useRoute()
const router = useRouter()
const news = useLineupNews(db)

const SOURCES: { key: LineupSource; label: string }[] = [
  { key: 'recommend', label: '推荐' },
  { key: 'hot', label: '热门' },
  { key: 'beginner', label: '新手' },
]
type SortKey = 'official' | 'uses' | 'score' | 'new'
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'official', label: '官方排序' },
  { value: 'uses', label: '使用最多' },
  { value: 'score', label: '评分最高' },
  { value: 'new', label: '最新发布' },
]
const NEW_TAG = '__new'

const storedSource = usePersistentRef<string>('lineups:source', 'recommend')
const source = computed<LineupSource>({
  get: () => (SOURCES.some((s) => s.key === storedSource.value) ? (storedSource.value as LineupSource) : 'recommend'),
  set: (v) => (storedSource.value = v),
})
const storedSort = usePersistentRef<string>('lineups:sort', 'official')
const sort = computed<SortKey>({
  get: () => (SORTS.some((s) => s.value === storedSort.value) ? (storedSort.value as SortKey) : 'official'),
  set: (v) => (storedSort.value = v),
})
const empty = () => ({
  lords: [] as number[],
  camps: [] as string[],
  tags: [] as string[],
  heroes: [] as number[],
  /** only set via deep links (CP talent area) */
  talents: [] as number[],
})
const f = usePersistentRef('lineups:filters', empty())
const q = usePersistentRef('lineups:q', '', 'session')
const pickerOpen = ref(false)
/** Mobile only: filter rows are collapsed behind a button (always shown on lg screens). */
const filtersOpen = ref(false)
const activeFilters = computed(() => Object.values(f.value).reduce((n, v) => n + v.length, 0))

const base = computed(() => db.lineups.filter((l) => l.sources.includes(source.value)))

// Filter options reflect what exists in the current list
const lordOptions = computed(() => {
  const count = new Map<number, number>()
  for (const l of base.value) for (const id of l.lords) count.set(id, (count.get(id) ?? 0) + 1)
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => ({ value: id, label: db.lordById.get(id)?.name ?? `#${id}` }))
})
const campOptions = CAMPS.map((c) => ({ value: c as string, label: c, color: campColor(c) }))
const tagOptions = computed(() => {
  const tags = [...new Set(db.lineups.flatMap((l) => l.tags))].map((t) => ({ value: t, label: t }))
  return news.added.size ? [{ value: NEW_TAG, label: `新上榜 ${news.added.size}` }, ...tags] : tags
})

const anyOf = <T,>(selected: T[], values: T[]) => !selected.length || values.some((v) => selected.includes(v))

function matchesTags(l: Lineup, tags: string[]) {
  if (!tags.length) return true
  return tags.some((t) => (t === NEW_TAG ? news.added.has(l.key) : l.tags.includes(t)))
}

const matches = (l: Lineup) =>
  anyOf(f.value.lords, l.lords) &&
  anyOf(f.value.camps, l.camps) &&
  matchesTags(l, f.value.tags) &&
  hasAllHeroes(l, f.value.heroes) &&
  hasAllTalents(l, f.value.talents) &&
  nameMatches(l.name, q.value)

// Tab counts follow the current filters, so matches in the other lists stay discoverable.
const sourceCounts = computed(() => {
  const counts: Record<LineupSource, number> = { recommend: 0, hot: 0, beginner: 0 }
  for (const l of db.lineups) if (matches(l)) for (const s of l.sources) counts[s]++
  return counts
})

const list = computed(() => {
  const s = source.value
  const out = base.value.filter(matches)
  const by: Record<SortKey, (a: Lineup, b: Lineup) => number> = {
    official: (a, b) => (a.rank[s] ?? 9999) - (b.rank[s] ?? 9999),
    uses: (a, b) => b.uses - a.uses,
    score: (a, b) => b.score - a.score || b.scoreNum - a.scoreNum,
    new: (a, b) => b.createdAt - a.createdAt,
  }
  return out.sort(by[sort.value])
})

const filtered = computed(() => !!q.value || Object.values(f.value).some((v) => v.length > 0))
function reset() {
  f.value = empty()
  q.value = ''
}
const removeHero = (id: number) => (f.value.heroes = f.value.heroes.filter((x) => x !== id))
const removeTalent = (id: number) => (f.value.talents = f.value.talents.filter((x) => x !== id))

// Incremental rendering: render 30 cards at a time as the user scrolls.
const PAGE = 30
const limit = ref(PAGE)
const visible = computed(() => list.value.slice(0, limit.value))
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

/** Re-observing makes the observer report the current state again (it only fires on changes). */
function recheck() {
  const el = sentinel.value
  if (!observer || !el) return
  requestAnimationFrame(() => {
    observer?.unobserve(el)
    observer?.observe(el)
  })
}

watch(
  [source, sort, f, q],
  () => {
    limit.value = PAGE
    recheck()
  },
  { deep: true },
)
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && limit.value < list.value.length) {
        limit.value += PAGE
        recheck()
      }
    },
    { rootMargin: '600px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})
onBeforeUnmount(() => observer?.disconnect())

// Deep links: /lineups?hero=1961,1321 and/or ?talent=637007 → lineups containing all of them,
// opened on the list with the most matches (same rule as the counts shown next to the links).
watch(
  () => [route.path, route.query.hero, route.query.talent] as const,
  ([path, hero, talent]) => {
    if (path !== '/lineups' || (hero === undefined && talent === undefined)) return
    const heroes = parseIdList(hero, (id) => db.heroById.has(id))
    const talents = parseIdList(talent, (id) => db.talentById.has(id))
    void router.replace({ query: {} })
    if (!heroes.length && !talents.length) return
    f.value = { ...empty(), heroes, talents }
    q.value = ''
    source.value = bestSource(db, { heroes, talents }).source
    filtersOpen.value = true
  },
  { immediate: true },
)
</script>

<template>
  <div>
    <nav class="sticky top-12 z-20 -mx-4 mb-3 border-b border-line bg-bg/95 px-4 backdrop-blur lg:top-0 lg:-mx-8 lg:px-8" aria-label="阵容榜单">
      <div class="flex gap-1">
        <button
          v-for="s in SOURCES"
          :key="s.key"
          type="button"
          class="relative flex h-11 items-center gap-1 px-3 text-[15px] transition-colors"
          :class="source === s.key ? 'font-semibold text-text' : 'text-muted hover:text-text'"
          :aria-pressed="source === s.key"
          @click="source = s.key"
        >
          {{ s.label }}榜
          <span class="text-xs text-faint tabular-nums">{{ sourceCounts[s.key] }}</span>
          <span v-if="source === s.key" class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />
        </button>
      </div>
    </nav>

    <p v-if="news.since && (news.added.size || news.removed)" class="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
      自上次访问（{{ formatDateTime(news.since) }}）官方阵容：
      <b class="text-text">新增 {{ news.added.size }} 套</b> · 下架 {{ news.removed }} 套
    </p>

    <CodexToolbar v-model:query="q" :count="list.length" unit="套阵容" placeholder="搜索阵容名" :filtered="filtered" @reset="reset">
      <template #actions>
        <button
          type="button"
          class="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm transition-colors lg:hidden"
          :class="activeFilters ? 'border-accent text-accent' : 'border-line text-muted'"
          aria-controls="lineup-filters"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          <NavIcon name="filter" :size="16" />筛选
          <span v-if="activeFilters" class="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs leading-5 font-semibold text-accent-ink tabular-nums">{{ activeFilters }}</span>
          <NavIcon name="chevron" :size="14" class="transition-transform" :class="filtersOpen ? '-rotate-90' : 'rotate-90'" />
        </button>
      </template>
      <div id="lineup-filters" class="space-y-2" :class="filtersOpen ? '' : 'hidden lg:block'">
        <div class="flex items-center gap-2">
          <span class="w-11 shrink-0 text-xs text-faint">英雄</span>
          <div class="no-scrollbar -mr-4 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5 pr-4 lg:mr-0 lg:pr-0">
            <button
              v-for="id in f.heroes"
              :key="id"
              type="button"
              class="relative shrink-0"
              :aria-label="`移除 ${db.heroById.get(id)?.name ?? ''}`"
              @click="removeHero(id)"
            >
              <HeroAvatar :id="id" :size="32" />
              <span class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-surface-3 text-muted ring-2 ring-[var(--bg)]">
                <NavIcon name="close" :size="10" />
              </span>
            </button>
            <button
              type="button"
              class="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] text-muted hover:border-accent hover:text-text"
              @click="pickerOpen = true"
            >
              <NavIcon name="plus" :size="14" />{{ f.heroes.length ? '修改' : '包含英雄' }}
            </button>
          </div>
        </div>
        <div v-if="f.talents.length" class="flex items-center gap-2">
          <span class="w-11 shrink-0 text-xs text-faint">天赋</span>
          <div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
            <button
              v-for="id in f.talents"
              :key="id"
              type="button"
              class="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent bg-surface-2 pr-2.5 pl-1 text-[13px]"
              :aria-label="`移除天赋 ${db.talentById.get(id)?.name ?? ''}`"
              @click="removeTalent(id)"
            >
              <CardIcon :src="db.talentById.get(id)?.icon ?? ''" :name="db.talentById.get(id)?.name ?? '?'" :size="22" round />
              {{ db.talentById.get(id)?.name ?? `#${id}` }}
              <NavIcon name="close" :size="12" class="text-faint" />
            </button>
          </div>
        </div>
        <ChipGroup v-model="f.lords" label="棋手" :options="lordOptions" />
        <ChipGroup v-model="f.camps" label="阵营" :options="campOptions" />
        <ChipGroup v-if="tagOptions.length" v-model="f.tags" label="标签" :options="tagOptions" />
      </div>
      <SortChips v-model="sort" label="排序" :options="SORTS" />
    </CodexToolbar>

    <ul v-if="list.length" class="grid gap-3 lg:grid-cols-2">
      <li v-for="l in visible" :key="l.key">
        <LineupCard :lineup="l" :is-new="news.added.has(l.key)" :rank="sort === 'official' ? l.rank[source] : undefined" />
      </li>
    </ul>
    <div v-else class="py-16 text-center">
      <p class="text-muted">没有符合条件的阵容</p>
      <button v-if="filtered" type="button" class="mt-3 text-sm text-accent" @click="reset">清除筛选</button>
    </div>
    <div ref="sentinel" class="h-px" aria-hidden="true" />
    <p v-if="list.length > visible.length" class="py-4 text-center text-xs text-faint">继续下滑加载更多…</p>

    <HeroPicker v-model:open="pickerOpen" v-model:selected="f.heroes" title="阵容需包含的英雄" />
  </div>
</template>
