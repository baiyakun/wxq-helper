<script setup lang="ts">
/** Multi-select hero picker (bottom sheet on mobile, dialog on desktop). Edits a draft until 完成. */
import { computed, nextTick, ref, watch } from 'vue'
import { campColor, tierColor } from '@/data/display'
import { nameMatches, preparePinyin } from '@/data/search'
import { useDb } from '@/data/store'
import { CAMPS } from '@/types/data'
import CardIcon from './CardIcon.vue'
import ChipGroup from './ChipGroup.vue'
import NavIcon from './NavIcon.vue'

const props = withDefaults(defineProps<{ title?: string }>(), { title: '选择英雄' })
const open = defineModel<boolean>('open', { required: true })
const selected = defineModel<number[]>('selected', { required: true })

const db = useDb()
const draft = ref<number[]>([])
const q = ref('')
const camps = ref<string[]>([])
const input = ref<HTMLInputElement | null>(null)

const campOptions = CAMPS.map((c) => ({ value: c as string, label: c, color: campColor(c) }))

watch(open, async (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (!v) return
  draft.value = [...selected.value]
  q.value = ''
  preparePinyin()
  await nextTick()
  // Only autofocus on devices with a fine pointer; on phones the keyboard would cover the grid.
  if (window.matchMedia('(pointer: fine)').matches) input.value?.focus()
})

const heroes = computed(() =>
  db.heroes
    .filter((h) => (!camps.value.length || camps.value.includes(h.camp)) && nameMatches(h.name, q.value))
    .sort((a, b) => CAMPS.indexOf(a.camp) - CAMPS.indexOf(b.camp) || a.quality - b.quality || a.id - b.id),
)

function toggle(id: number) {
  draft.value = draft.value.includes(id) ? draft.value.filter((x) => x !== id) : [...draft.value, id]
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
        :aria-label="props.title"
        class="flex h-[88dvh] w-full flex-col rounded-t-2xl bg-surface lg:h-auto lg:max-h-[80vh] lg:w-[680px] lg:rounded-2xl lg:border lg:border-line"
        @keydown.esc="open = false"
      >
        <div class="flex h-12 shrink-0 items-center px-4">
          <h2 class="font-semibold">{{ props.title }}</h2>
          <button type="button" class="-mr-2 ml-auto flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="关闭" @click="open = false">
            <NavIcon name="close" :size="20" />
          </button>
        </div>

        <div class="space-y-2 px-4 pb-2">
          <label class="flex h-10 items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
            <NavIcon name="search" :size="18" class="shrink-0 text-faint" />
            <input ref="input" v-model="q" type="search" autocomplete="off" placeholder="搜索英雄（支持拼音首字母）" class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
          </label>
          <ChipGroup v-model="camps" label="阵营" :options="campOptions" />
        </div>

        <ul class="grid flex-1 grid-cols-5 content-start gap-x-1 gap-y-1 overflow-y-auto overscroll-contain px-3 pb-3 sm:grid-cols-7 lg:grid-cols-8">
          <li v-for="h in heroes" :key="h.id">
            <button
              type="button"
              class="relative flex w-full flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-colors"
              :class="draft.includes(h.id) ? 'bg-surface-3' : 'hover:bg-surface-2'"
              :aria-pressed="draft.includes(h.id)"
              @click="toggle(h.id)"
            >
              <CardIcon :src="h.avatar" :name="h.name" :size="48" :ring="tierColor(h.quality)" :class="draft.includes(h.id) ? '' : 'opacity-90'" />
              <span v-if="draft.includes(h.id)" class="absolute top-1 right-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-ink">
                <NavIcon name="check" :size="14" />
              </span>
              <span class="w-full truncate text-center text-xs" :class="draft.includes(h.id) ? 'font-medium text-text' : 'text-muted'">{{ h.name }}</span>
            </button>
          </li>
          <li v-if="!heroes.length" class="col-span-full py-10 text-center text-sm text-muted">没有符合条件的英雄</li>
        </ul>

        <div class="pb-safe flex shrink-0 items-center gap-3 border-t border-line px-4 pt-3 pb-3">
          <span class="text-sm text-muted">已选 <b class="text-text tabular-nums">{{ draft.length }}</b> 名</span>
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
