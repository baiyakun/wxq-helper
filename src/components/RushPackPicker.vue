<script setup lang="ts">
/** Pick the (up to 3) opening packs offered in a 钻石狂潮 game. Edits a draft until 完成. */
import { computed, nextTick, ref, watch } from 'vue'
import { categoryLabel, RUSH_CATEGORIES, sortHeroes } from '@/data/rush'
import { nameMatches, preparePinyin } from '@/data/search'
import { useDb } from '@/data/store'
import type { RushLineup } from '@/types/data'
import CardIcon from './CardIcon.vue'
import ChipGroup from './ChipGroup.vue'
import HeroAvatar from './HeroAvatar.vue'
import NavIcon from './NavIcon.vue'

const MAX = 3

const open = defineModel<boolean>('open', { required: true })
const selected = defineModel<string[]>('selected', { required: true })

const db = useDb()
const draft = ref<string[]>([])
const q = ref('')
const cats = ref<string[]>([])
const input = ref<HTMLInputElement | null>(null)

const catOptions = computed(() =>
  RUSH_CATEGORIES.filter((c) => db.rush.some((l) => l.category === c)).map((c) => ({ value: c, label: categoryLabel(c) })),
)

watch(open, async (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (!v) return
  draft.value = selected.value.filter((id) => db.rushById.has(id)).slice(0, MAX)
  q.value = ''
  preparePinyin()
  await nextTick()
  if (window.matchMedia('(pointer: fine)').matches) input.value?.focus()
})

const title = (l: RushLineup) => l.pack?.name ?? l.name
/** The pack's own heroes (3+ copies), else the lineup's carry first. */
function packHeroes(l: RushLineup): number[] {
  const own = (l.pack?.items ?? []).filter((c) => c.kind === 'hero' && c.id && c.count >= 3).map((c) => c.id)
  return own.length ? own : sortHeroes(l.groups[0]?.heroes ?? []).filter((h) => h.id).slice(0, 1).map((h) => h.id)
}
const heroNames = (l: RushLineup) => (l.groups[0]?.heroes ?? []).map((h) => (h.id ? db.heroById.get(h.id)?.name : h.name) ?? '')

const packs = computed(() =>
  db.rush
    .filter((l) => (!cats.value.length || cats.value.includes(l.category)) && (nameMatches(title(l), q.value) || heroNames(l).some((n) => nameMatches(n, q.value))))
    .sort((a, b) => {
      const ca = RUSH_CATEGORIES.indexOf(a.category)
      const cb = RUSH_CATEGORIES.indexOf(b.category)
      return (ca < 0 ? 99 : ca) - (cb < 0 ? 99 : cb) || title(a).localeCompare(title(b), 'zh-CN')
    }),
)

const full = computed(() => draft.value.length >= MAX)

function toggle(id: string) {
  if (draft.value.includes(id)) draft.value = draft.value.filter((x) => x !== id)
  else if (!full.value) draft.value = [...draft.value, id]
}

function done() {
  selected.value = draft.value
  open.value = false
}
</script>

<template>
  <Transition name="fade">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end bg-[var(--scrim)] lg:items-center lg:justify-center" @click.self="open = false">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="选择开局卡包"
        class="flex h-[88dvh] w-full flex-col rounded-t-2xl bg-surface lg:h-auto lg:max-h-[80vh] lg:w-[680px] lg:rounded-2xl lg:border lg:border-line"
        @keydown.esc="open = false"
      >
        <div class="flex h-12 shrink-0 items-center px-4">
          <h2 class="font-semibold">选择开局给你的卡包</h2>
          <button type="button" class="-mr-2 ml-auto flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="关闭" @click="open = false">
            <NavIcon name="close" :size="20" />
          </button>
        </div>

        <div class="space-y-2 px-4 pb-2">
          <label class="flex h-10 items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
            <NavIcon name="search" :size="18" class="shrink-0 text-faint" />
            <input ref="input" v-model="q" type="search" autocomplete="off" placeholder="搜索卡包或英雄（支持拼音首字母）" class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
          </label>
          <ChipGroup v-model="cats" label="分类" :options="catOptions" />
        </div>

        <ul class="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-3">
          <li v-for="l in packs" :key="l.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors"
              :class="draft.includes(l.id) ? 'bg-surface-3' : full ? 'opacity-50' : 'hover:bg-surface-2'"
              :aria-pressed="draft.includes(l.id)"
              :disabled="full && !draft.includes(l.id)"
              @click="toggle(l.id)"
            >
              <span class="flex shrink-0 -space-x-2">
                <HeroAvatar v-for="id in packHeroes(l)" :key="id" :id="id" :size="36" />
                <CardIcon v-if="!packHeroes(l).length" :src="l.groups[0]?.heroes[0]?.icon ?? ''" :name="l.subject" :size="36" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ title(l) }}</span>
                <span class="block truncate text-xs text-muted">{{ categoryLabel(l.category) }} · {{ l.camps.join(' / ') }}</span>
              </span>
              <span
                class="flex size-6 shrink-0 items-center justify-center rounded-full border"
                :class="draft.includes(l.id) ? 'border-transparent bg-accent text-accent-ink' : 'border-line'"
                aria-hidden="true"
              >
                <NavIcon v-if="draft.includes(l.id)" name="check" :size="14" />
              </span>
            </button>
          </li>
          <li v-if="!packs.length" class="py-10 text-center text-sm text-muted">没有符合条件的卡包</li>
        </ul>

        <div class="pb-safe flex shrink-0 items-center gap-3 border-t border-line px-4 pt-3 pb-3">
          <span class="text-sm text-muted">已选 <b class="text-text tabular-nums">{{ draft.length }}</b> / {{ MAX }}</span>
          <button v-if="draft.length" type="button" class="text-sm text-accent" @click="draft = []">清空</button>
          <button type="button" class="ml-auto h-10 rounded-full bg-accent px-6 text-sm font-medium text-accent-ink" @click="done">完成</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
