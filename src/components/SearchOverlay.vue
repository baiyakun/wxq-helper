<script setup lang="ts">
/** Global search across heroes, players, talents, equips, effect cards and lineups (incl. 钻石狂潮). */
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useDetail } from '@/composables/useDetail'
import { buildIndex, search, type SearchEntry, type SearchKind } from '@/data/search'
import { KIND_LABEL, useDb } from '@/data/store'
import CardIcon from './CardIcon.vue'
import NavIcon from './NavIcon.vue'

const open = defineModel<boolean>('open', { required: true })

const HINTS = ['hml', '兄妹', '复生', '弈星', '倒转', 'cxe']

const db = useDb()
const router = useRouter()
const { open: openDetail } = useDetail()
const kindLabel = (k: SearchKind) => (k === 'lineup' ? '阵容' : k === 'rush' ? '狂潮' : KIND_LABEL[k])
const index = shallowRef<SearchEntry[] | null>(null)
const query = ref('')
const active = ref(0)
const input = ref<HTMLInputElement | null>(null)
const list = ref<HTMLElement | null>(null)

const hits = computed(() => (index.value ? search(index.value, query.value) : []))

watch(open, async (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (!v) return
  query.value = ''
  active.value = 0
  await nextTick()
  input.value?.focus()
  index.value ??= await buildIndex(db)
})

watch(query, () => (active.value = 0))

// Huya's lineups and the 钻石狂潮 data arrive after start-up: rebuild an index that was built without them.
watch(
  () => [db.lineups, db.rush],
  async () => {
    if (index.value) index.value = await buildIndex(db)
  },
)

function choose(e: SearchEntry) {
  open.value = false
  if (e.kind === 'lineup') {
    if (e.key) void router.push(`/lineups/${e.key}`)
  } else if (e.kind === 'rush') {
    if (e.key) void router.push(`/rush/${e.key}`)
  } else {
    openDetail(e.kind, e.id)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false
  } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = hits.value.length
    if (!n) return
    active.value = (active.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
    void nextTick(() => list.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }))
  } else if (e.key === 'Enter') {
    const hit = hits.value[active.value]
    if (hit) choose(hit.entry)
  }
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-50 bg-[var(--scrim)] lg:flex lg:items-start lg:justify-center lg:pt-[12vh]"
      @click.self="open = false"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="搜索"
        class="flex h-full w-full flex-col bg-bg lg:h-auto lg:max-h-[70vh] lg:w-[580px] lg:rounded-2xl lg:border lg:border-line lg:bg-surface lg:shadow-2xl"
        @keydown="onKeydown"
      >
        <div class="flex items-center gap-2 border-b border-line px-4 py-2.5">
          <NavIcon name="search" :size="20" class="shrink-0 text-faint" />
          <input
            ref="input"
            v-model="query"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            placeholder="搜英雄、棋手、天赋、装备、阵容…支持拼音首字母"
            class="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
            role="combobox"
            aria-controls="search-results"
            :aria-expanded="hits.length > 0"
          />
          <button type="button" class="shrink-0 px-1 text-sm text-accent lg:hidden" @click="open = false">取消</button>
          <kbd class="hidden rounded border border-line px-1.5 text-xs text-faint lg:inline">Esc</kbd>
        </div>

        <div ref="list" class="flex-1 overflow-y-auto overscroll-contain p-2">
          <div v-if="!query" class="p-3">
            <p class="mb-3 text-sm text-muted">试试这些：</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="h in HINTS"
                :key="h"
                type="button"
                class="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm hover:border-accent"
                @click="query = h"
              >{{ h }}</button>
            </div>
          </div>
          <p v-else-if="!index" class="p-6 text-center text-sm text-muted">正在准备拼音索引…</p>
          <p v-else-if="!hits.length" class="p-6 text-center text-sm text-muted">没有找到“{{ query }}”</p>
          <ul v-else id="search-results" role="listbox">
            <li v-for="(h, i) in hits" :key="`${h.entry.kind}-${h.entry.key ?? h.entry.id}`" role="option" :aria-selected="i === active">
              <button
                type="button"
                :data-active="i === active"
                class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left"
                :class="i === active ? 'bg-surface-2' : 'hover:bg-surface-2'"
                @click="choose(h.entry)"
                @mousemove="active = i"
              >
                <CardIcon :src="h.entry.icon" :name="h.entry.name" :size="36" :round="h.entry.kind === 'lord'" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium">{{ h.entry.name }}</span>
                  <span class="block truncate text-xs text-muted">{{ h.entry.sub }}</span>
                </span>
                <span class="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-muted">{{ kindLabel(h.entry.kind) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
