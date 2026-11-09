<script setup lang="ts">
/** Multi-select picker for hero-linked talents (e.g. 技能突破：亚瑟). Edits a draft until 完成. */
import { computed, nextTick, ref, watch } from 'vue'
import { stageShort, talentGrade } from '@/data/display'
import { nameMatches, preparePinyin } from '@/data/search'
import { useDb } from '@/data/store'
import Badge from './Badge.vue'
import CardIcon from './CardIcon.vue'
import HeroAvatar from './HeroAvatar.vue'
import NavIcon from './NavIcon.vue'

const props = withDefaults(defineProps<{ title?: string }>(), { title: '选择天赋' })
const open = defineModel<boolean>('open', { required: true })
const selected = defineModel<number[]>('selected', { required: true })

const db = useDb()
const draft = ref<number[]>([])
const q = ref('')
const input = ref<HTMLInputElement | null>(null)

const linked = db.talents
  .filter((t) => t.heroes.length > 0)
  .sort((a, b) => b.stageNo - a.stageNo || b.quality - a.quality || a.id - b.id)

watch(open, async (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
  if (!v) return
  draft.value = [...selected.value]
  q.value = ''
  preparePinyin()
  await nextTick()
  if (window.matchMedia('(pointer: fine)').matches) input.value?.focus()
})

// Match the talent name or any of its heroes, so "亚瑟" finds 技能突破：亚瑟.
const list = computed(() =>
  linked.filter((t) => nameMatches(t.name, q.value) || t.heroes.some((id) => nameMatches(db.heroById.get(id)?.name ?? '', q.value))),
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
        class="flex h-[88dvh] w-full flex-col rounded-t-2xl bg-surface lg:h-auto lg:max-h-[80vh] lg:w-[560px] lg:rounded-2xl lg:border lg:border-line"
        @keydown.esc="open = false"
      >
        <div class="flex h-12 shrink-0 items-center px-4">
          <h2 class="font-semibold">{{ props.title }}</h2>
          <button type="button" class="-mr-2 ml-auto flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2" aria-label="关闭" @click="open = false">
            <NavIcon name="close" :size="20" />
          </button>
        </div>

        <div class="px-4 pb-2">
          <label class="flex h-10 items-center gap-2 rounded-xl border border-line bg-bg px-3 focus-within:border-accent">
            <NavIcon name="search" :size="18" class="shrink-0 text-faint" />
            <input ref="input" v-model="q" type="search" autocomplete="off" placeholder="搜天赋或英雄名（支持拼音首字母）" class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" />
          </label>
          <p class="mt-2 text-xs text-faint">只列出与英雄相关的天赋：阵容里有对应英雄才算契合。</p>
        </div>

        <ul class="flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-3">
          <li v-for="t in list" :key="t.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors"
              :class="draft.includes(t.id) ? 'bg-surface-3' : 'hover:bg-surface-2'"
              :aria-pressed="draft.includes(t.id)"
              @click="toggle(t.id)"
            >
              <CardIcon :src="t.icon" :name="t.name" :size="40" :ring="talentGrade(t.quality).color" />
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-1.5">
                  <span class="font-medium">{{ t.name }}</span>
                  <Badge v-if="t.stage">{{ stageShort(t.stage) }}</Badge>
                  <Badge v-if="t.cp" color="var(--t-exclusive)">CP</Badge>
                </span>
                <span class="mt-1 flex items-center gap-1">
                  <HeroAvatar v-for="id in t.heroes" :key="id" :id="id" :size="22" />
                  <span class="ml-1 truncate text-xs text-muted">
                    {{ t.heroes.map((id) => db.heroById.get(id)?.name).join(t.heroes.length > 2 ? ' / ' : ' + ') }}
                    <template v-if="t.heroes.length > 2">（任一）</template>
                  </span>
                </span>
              </span>
              <span
                class="flex size-6 shrink-0 items-center justify-center rounded-full border"
                :class="draft.includes(t.id) ? 'border-accent bg-accent text-accent-ink' : 'border-line'"
                aria-hidden="true"
              >
                <NavIcon v-if="draft.includes(t.id)" name="check" :size="14" />
              </span>
            </button>
          </li>
          <li v-if="!list.length" class="py-10 text-center text-sm text-muted">没有找到相关天赋</li>
        </ul>

        <div class="pb-safe flex shrink-0 items-center gap-3 border-t border-line px-4 pt-3 pb-3">
          <span class="text-sm text-muted">已选 <b class="text-text tabular-nums">{{ draft.length }}</b> 个</span>
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
