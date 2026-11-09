<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import CardIcon from '@/components/CardIcon.vue'
import ChipGroup from '@/components/ChipGroup.vue'
import HeroAvatar from '@/components/HeroAvatar.vue'
import HeroPicker from '@/components/HeroPicker.vue'
import NavIcon from '@/components/NavIcon.vue'
import RecommendCard from '@/components/RecommendCard.vue'
import TalentPicker from '@/components/TalentPicker.vue'
import { useIncremental } from '@/composables/useIncremental'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { campColor } from '@/data/display'
import { isOfficial } from '@/data/lineupQuery'
import { MATCH_WEIGHTS, hasInput, recommend, type RecommendInput } from '@/data/recommend'
import { useDb } from '@/data/store'
import { CAMPS } from '@/types/data'

defineOptions({ name: 'RecommendView' })

const db = useDb()
const empty = (): RecommendInput => ({ lord: 0, camps: [], heroes: [], talents: [] })
const stored = usePersistentRef('recommend:input', empty())
const pickerOpen = ref(false)
const talentPickerOpen = ref(false)

// Ignore ids that disappeared after a data update.
const input = computed<RecommendInput>(() => ({
  lord: db.lordById.has(stored.value.lord) ? stored.value.lord : 0,
  camps: stored.value.camps.filter((c) => (CAMPS as readonly string[]).includes(c)),
  heroes: stored.value.heroes.filter((id) => db.heroById.has(id)),
  talents: stored.value.talents.filter((id) => (db.talentById.get(id)?.heroes.length ?? 0) > 0),
}))
const active = computed(() => hasInput(input.value))

// Lords recommended by more official lineups first.
const lordUse = new Map<number, number>()
for (const l of db.lineups.filter(isOfficial)) for (const id of l.lords) lordUse.set(id, (lordUse.get(id) ?? 0) + 1)
const lords = [...db.lords].sort((a, b) => (lordUse.get(b.id) ?? 0) - (lordUse.get(a.id) ?? 0))
const campOptions = CAMPS.filter((c) => c !== '无阵营').map((c) => ({ value: c as string, label: c, color: campColor(c) }))

const pickLord = (id: number) => (stored.value.lord = stored.value.lord === id ? 0 : id)
const removeHero = (id: number) => (stored.value.heroes = stored.value.heroes.filter((x) => x !== id))
const removeTalent = (id: number) => (stored.value.talents = stored.value.talents.filter((x) => x !== id))
const clearAll = () => (stored.value = empty())

const results = computed(() => recommend(db, input.value))
const { visible, reset } = useIncremental(results, 20, useTemplateRef<HTMLElement>('sentinel'))
watch(input, reset)

// Mobile: scroll each horizontal option row so its selected item is visible on load.
const form = useTemplateRef<HTMLElement>('form')
onMounted(() => {
  for (const row of form.value?.querySelectorAll<HTMLElement>('.overflow-x-auto') ?? []) {
    const picked = [...row.querySelectorAll<HTMLElement>('[aria-pressed="true"]')].pop()
    if (!picked) continue
    const overflow = picked.getBoundingClientRect().right - row.getBoundingClientRect().right
    if (overflow > 0) row.scrollLeft += overflow + 16
  }
})
</script>

<template>
  <div class="lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-6">
    <section
      ref="form"
      aria-label="推荐条件"
      class="mb-4 space-y-3 lg:sticky lg:top-6 lg:mb-0 lg:rounded-2xl lg:border lg:border-line lg:bg-surface lg:p-4"
    >
      <div>
        <h2 class="font-semibold">智能推荐</h2>
        <p class="mt-0.5 text-[13px] leading-relaxed text-muted">选你的棋手、想玩的阵营、手上已有的英雄和拿到的英雄天赋，按匹配度推荐官方榜单和虎牙收录的阵容。每项都可以不填。</p>
      </div>

      <div class="flex items-start gap-2" role="group" aria-label="我的棋手">
        <span class="mt-3 w-11 shrink-0 text-xs text-faint">棋手</span>
        <div class="no-scrollbar -mr-4 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-4 lg:mr-0 lg:flex-wrap lg:pr-0">
          <button
            v-for="l in lords"
            :key="l.id"
            type="button"
            class="flex w-11 shrink-0 flex-col items-center gap-1 rounded-xl py-1"
            :aria-pressed="stored.lord === l.id"
            @click="pickLord(l.id)"
          >
            <span class="relative">
              <CardIcon :src="l.avatar" :name="l.name" :size="36" round :ring="stored.lord === l.id ? 'var(--accent)' : ''" />
              <span v-if="stored.lord === l.id" class="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent text-accent-ink">
                <NavIcon name="check" :size="11" />
              </span>
            </span>
            <span class="w-full truncate text-center text-[11px]" :class="stored.lord === l.id ? 'font-medium text-accent' : 'text-muted'">{{ l.name }}</span>
          </button>
        </div>
      </div>

      <ChipGroup v-model="stored.camps" label="阵营" :options="campOptions" />

      <div class="flex items-start gap-2">
        <span class="mt-2 w-11 shrink-0 text-xs text-faint">英雄</span>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <button
            v-for="id in input.heroes"
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
            <NavIcon name="plus" :size="14" />{{ input.heroes.length ? '修改' : '添加已有英雄' }}
          </button>
        </div>
      </div>

      <div class="flex items-start gap-2">
        <span class="mt-2 w-11 shrink-0 text-xs text-faint">天赋</span>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <button
            v-for="id in input.talents"
            :key="id"
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-full border border-accent bg-surface-2 pr-2.5 pl-1 text-[13px]"
            :aria-label="`移除天赋 ${db.talentById.get(id)?.name ?? ''}`"
            @click="removeTalent(id)"
          >
            <CardIcon :src="db.talentById.get(id)?.icon ?? ''" :name="db.talentById.get(id)?.name ?? '?'" :size="22" round />
            {{ db.talentById.get(id)?.name }}
            <NavIcon name="close" :size="12" class="text-faint" />
          </button>
          <button
            type="button"
            class="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-line px-3 text-[13px] text-muted hover:border-accent hover:text-text"
            @click="talentPickerOpen = true"
          >
            <NavIcon name="plus" :size="14" />{{ input.talents.length ? '修改' : '英雄相关天赋' }}
          </button>
        </div>
      </div>

      <div v-if="active" class="flex justify-end">
        <button type="button" class="px-1 text-xs text-accent" @click="clearAll">清空条件</button>
      </div>
    </section>

    <section aria-label="推荐结果">
      <div v-if="!active" class="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
        <p class="font-medium text-text">先选一个条件试试</p>
        <p class="mt-1 leading-relaxed">只选棋手，会按热度列出适合这个棋手的阵容；选了「技能突破：亚瑟」这类天赋，会找有对应英雄的阵容；再加上已有英雄，会优先推荐你凑得齐的。</p>
      </div>
      <template v-else>
        <p class="mb-2 text-xs text-faint">为你找到 {{ results.length }} 套阵容</p>
        <details class="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">
          <summary class="cursor-pointer text-text">匹配度怎么算？</summary>
          <p class="mt-1.5 leading-relaxed">
            只计算你填了的条件，按以下分值折算成百分比：已有英雄 {{ MATCH_WEIGHTS.heroes }} 分（按位置加权，主C ×3、坦克和功能 ×2、其他
            ×1）；天赋契合 {{ MATCH_WEIGHTS.talents }} 分（阵容里有天赋对应的英雄；对应 3 名英雄的天赋有其中任一名即可）；推荐棋手一致
            {{ MATCH_WEIGHTS.lord }} 分；属于想玩的阵营 {{ MATCH_WEIGHTS.camps }} 分。天赋会送的英雄牌（如「获得1张亚瑟」）算作你已有。匹配度相同时按使用人数排序。阵容里有一对
            CP 英雄时，会提示对应的 CP 天赋。
          </p>
        </details>
        <ul v-if="results.length" class="grid gap-3 2xl:grid-cols-2">
          <li v-for="r in visible" :key="r.lineup.key">
            <RecommendCard :rec="r" :ownership="input.heroes.length > 0" />
          </li>
        </ul>
        <p v-else class="py-16 text-center text-muted">没有匹配的阵容，试试换个条件</p>
        <p v-if="results.length > visible.length" class="py-4 text-center text-xs text-faint">继续下滑加载更多…</p>
      </template>
      <div ref="sentinel" class="h-px" aria-hidden="true" />
    </section>

    <HeroPicker v-model:open="pickerOpen" v-model:selected="stored.heroes" title="我已有的英雄" />
    <TalentPicker v-model:open="talentPickerOpen" v-model:selected="stored.talents" title="英雄相关天赋" />
  </div>
</template>
