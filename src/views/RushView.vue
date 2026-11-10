<script setup lang="ts">
/**
 * 钻石狂潮: compare the opening packs offered in a game, and browse every pack / lineup
 * ranked by Huya's rating in the chosen room.
 */
import { computed, ref } from 'vue'
import Badge from '@/components/Badge.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import HeroAvatar from '@/components/HeroAvatar.vue'
import NavIcon from '@/components/NavIcon.vue'
import RushLineupCard from '@/components/RushLineupCard.vue'
import RushPackPicker from '@/components/RushPackPicker.vue'
import SortChips from '@/components/SortChips.vue'
import { rushRoom as room } from '@/composables/rushRoom'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { campColor } from '@/data/display'
import { byScore, categoryLabel, gradeColor, RUSH_CATEGORIES, RUSH_ROOMS, roomLabel, sortHeroes } from '@/data/rush'
import { nameMatches } from '@/data/search'
import { loadRush, useDataStatus, useDb } from '@/data/store'
import { CAMPS, type RushLineup } from '@/types/data'

defineOptions({ name: 'RushView' })

const db = useDb()
const { rushStatus } = useDataStatus()

const roomOptions = RUSH_ROOMS.map((r) => ({ value: r.value, label: r.label }))
const roomRange = computed(() => RUSH_ROOMS.find((r) => r.value === room.value)?.range ?? '')

// --- Opening packs offered in the current game ---------------------------------------------

const offer = usePersistentRef<string[]>('rush:offer', [], 'session')
const pickerOpen = ref(false)
const offered = computed(() =>
  offer.value
    .map((id) => db.rushById.get(id))
    .filter((l): l is RushLineup => l !== undefined)
    .sort(byScore(room.value)),
)
const bestScore = computed(() => offered.value[0]?.ratings[room.value]?.score)
/** Several packs share the best score: the rating alone does not decide. */
const tie = computed(() => offered.value.length > 1 && bestScore.value !== undefined && offered.value[1]?.ratings[room.value]?.score === bestScore.value)
const isBest = (l: RushLineup) => offered.value.length > 1 && bestScore.value !== undefined && l.ratings[room.value]?.score === bestScore.value
const packHeroes = (l: RushLineup) => sortHeroes(l.groups[0]?.heroes ?? []).filter((h) => h.id)

// --- All packs -----------------------------------------------------------------------------

const empty = () => ({ cats: [] as string[], camps: [] as string[] })
const f = usePersistentRef('rush:filters', empty())
const q = usePersistentRef('rush:q', '', 'session')

const catOptions = computed(() =>
  RUSH_CATEGORIES.filter((c) => db.rush.some((l) => l.category === c)).map((c) => ({ value: c, label: categoryLabel(c) })),
)
const campOptions = CAMPS.filter((c) => c !== '无阵营').map((c) => ({ value: c as string, label: c, color: campColor(c) }))

const heroNames = (l: RushLineup) => (l.groups[0]?.heroes ?? []).map((h) => (h.id ? db.heroById.get(h.id)?.name : h.name) ?? '')
const matchesQuery = (l: RushLineup) =>
  !q.value || nameMatches(l.pack?.name ?? l.name, q.value) || heroNames(l).some((n) => nameMatches(n, q.value))

const list = computed(() =>
  db.rush
    .filter(
      (l) =>
        (!f.value.cats.length || f.value.cats.includes(l.category)) &&
        (!f.value.camps.length || l.camps.some((c) => f.value.camps.includes(c))) &&
        matchesQuery(l),
    )
    .sort(byScore(room.value)),
)
/** Rank among all packs in the room, so filtering does not renumber them. */
const rankById = computed(() => new Map([...db.rush].sort(byScore(room.value)).map((l, i) => [l.id, i + 1])))
const filtered = computed(() => !!q.value || f.value.cats.length > 0 || f.value.camps.length > 0)
function reset() {
  f.value = empty()
  q.value = ''
}
</script>

<template>
  <div>
    <div v-if="rushStatus === 'loading'" class="py-16 text-center text-muted" aria-busy="true">正在加载钻石狂潮数据…</div>
    <div v-else-if="rushStatus === 'error'" class="py-16 text-center" role="alert">
      <p class="text-muted">钻石狂潮数据加载失败</p>
      <button type="button" class="mt-3 text-sm text-accent" @click="loadRush">重试</button>
    </div>
    <div v-else-if="!db.rush.length" class="mx-auto max-w-sm py-16 text-center">
      <p class="font-medium">暂时没有钻石狂潮数据</p>
      <p class="mt-1 text-sm text-muted">数据来自虎牙万象棋助手，上次同步时没能取到，稍后会自动重试。</p>
    </div>

    <template v-else>
      <div class="mb-3 space-y-1">
        <SortChips v-model="room" label="场次" :options="roomOptions" />
        <p class="pl-[52px] text-[12px] text-faint">{{ roomRange }} · 评级和拍卖出价都按这个场次</p>
      </div>

      <!-- Opening packs: which of the three to take -->
      <section class="mb-5 rounded-2xl border border-line bg-surface p-3 sm:p-4" aria-labelledby="rush-offer-title">
        <div class="flex items-center gap-2">
          <h2 id="rush-offer-title" class="font-semibold">开局卡包三选一</h2>
          <template v-if="offered.length">
            <button type="button" class="ml-auto h-8 rounded-full border border-line px-3 text-[13px] text-muted hover:text-text" @click="pickerOpen = true">修改</button>
            <button type="button" class="h-8 px-1 text-[13px] text-faint hover:text-text" @click="offer = []">清空</button>
          </template>
        </div>

        <template v-if="!offered.length">
          <p class="mt-1 text-[13px] leading-relaxed text-muted">开局时把系统给的 3 个卡包选出来，按{{ roomLabel(room) }}的评级告诉你拿哪个。</p>
          <button type="button" class="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent font-medium text-accent-ink sm:w-auto sm:px-6" @click="pickerOpen = true">
            <NavIcon name="plus" :size="18" />选择开局卡包
          </button>
        </template>

        <template v-else>
          <ol class="mt-3 space-y-2">
            <li v-for="(l, i) in offered" :key="l.id">
              <RouterLink
                :to="`/rush/${l.id}`"
                class="flex items-center gap-3 rounded-xl border p-2.5 transition-colors hover:border-faint"
                :class="isBest(l) ? 'border-accent bg-surface-2' : 'border-line'"
              >
                <span class="w-5 shrink-0 text-center text-sm font-semibold text-faint tabular-nums">{{ i + 1 }}</span>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-1.5">
                    <span class="font-medium">{{ l.pack?.name ?? l.name }}</span>
                    <Badge v-if="isBest(l) && !tie" color="var(--q2)">推荐拿这个</Badge>
                  </span>
                  <span class="mt-1.5 flex flex-wrap gap-1">
                    <HeroAvatar v-for="h in packHeroes(l)" :key="`${h.id}-${h.x}-${h.z}`" :id="h.id" :core="h.core" :size="28" />
                  </span>
                </span>
                <span v-if="l.ratings[room]" class="flex shrink-0 flex-col items-center leading-none" :style="{ color: gradeColor(l.ratings[room]!.grade) }">
                  <span class="text-[24px] font-bold">{{ l.ratings[room]!.grade }}</span>
                  <span class="mt-0.5 text-[11px] text-muted tabular-nums">{{ l.ratings[room]!.score }}分</span>
                </span>
                <span v-else class="shrink-0 text-xs text-faint">暂无评级</span>
              </RouterLink>
            </li>
          </ol>
          <p v-if="offered.length === 1" class="mt-2 text-[12px] text-faint">再选 1–2 个就能比较。</p>
          <p v-else-if="tie" class="mt-2 text-[12px] leading-relaxed text-faint">评分相同：看看哪套的英雄和你的棋手更顺手。</p>
        </template>
      </section>

      <!-- Every pack, ranked -->
      <h2 class="mb-2 font-semibold">全部卡包 <span class="text-sm font-normal text-faint">按{{ roomLabel(room) }}评级排序</span></h2>
      <CodexToolbar v-model:query="q" :count="list.length" unit="个卡包" placeholder="搜索卡包或英雄" :filtered="filtered" @reset="reset">
        <ChipGroup v-model="f.cats" label="分类" :options="catOptions" />
        <ChipGroup v-model="f.camps" label="阵营" :options="campOptions" />
      </CodexToolbar>

      <ul v-if="list.length" class="grid gap-3 lg:grid-cols-2">
        <li v-for="l in list" :key="l.id">
          <RushLineupCard :lineup="l" :room="room" :rank="rankById.get(l.id)" />
        </li>
      </ul>
      <div v-else class="py-16 text-center">
        <p class="text-muted">没有符合条件的卡包</p>
        <button type="button" class="mt-3 text-sm text-accent" @click="reset">清除筛选</button>
      </div>

      <p class="mt-6 text-center text-[12px] leading-relaxed text-faint">
        卡包评级、阵容和拍卖推荐来自虎牙万象棋助手，非官方数据，会随版本调整。
      </p>

      <RushPackPicker v-model:open="pickerOpen" v-model:selected="offer" />
    </template>
  </div>
</template>
