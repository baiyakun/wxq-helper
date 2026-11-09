<script setup lang="ts">
import { computed, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { isCodexTab, lastCodexTab } from '@/composables/codexTab'
import { useDb } from '@/data/store'
import type { CodexTab } from '@/router'
import CpList from './codex/CpList.vue'
import EffectList from './codex/EffectList.vue'
import EquipList from './codex/EquipList.vue'
import HeroList from './codex/HeroList.vue'
import LordList from './codex/LordList.vue'
import TalentList from './codex/TalentList.vue'

defineOptions({ name: 'CodexView' })

const route = useRoute()
const db = useDb()

const TABS: { key: CodexTab; label: string; count: () => number; view: Component }[] = [
  { key: 'heroes', label: '英雄', count: () => db.heroes.length, view: HeroList },
  { key: 'lords', label: '棋手', count: () => db.lords.length, view: LordList },
  { key: 'cp', label: 'CP', count: () => db.cpGroups.length, view: CpList },
  { key: 'talents', label: '天赋', count: () => db.talents.length, view: TalentList },
  { key: 'equips', label: '装备', count: () => db.equips.length, view: EquipList },
  { key: 'effects', label: '效果牌', count: () => db.effects.length, view: EffectList },
]

const tab = computed<CodexTab>(() => (isCodexTab(route.params.tab) ? route.params.tab : 'heroes'))
const view = computed(() => TABS.find((t) => t.key === tab.value)?.view ?? HeroList)

watch(tab, (t) => (lastCodexTab.value = t), { immediate: true })
</script>

<template>
  <div>
    <nav
      class="sticky top-12 z-20 -mx-4 mb-3 border-b border-line bg-bg/95 px-4 backdrop-blur lg:top-0 lg:-mx-8 lg:px-8"
      aria-label="图鉴分类"
    >
      <div class="no-scrollbar flex gap-1 overflow-x-auto">
        <RouterLink
          v-for="t in TABS"
          :key="t.key"
          :to="`/codex/${t.key}`"
          replace
          class="relative flex h-11 shrink-0 items-center gap-1 px-3 text-[15px] transition-colors"
          :class="tab === t.key ? 'font-semibold text-text' : 'text-muted hover:text-text'"
          :aria-current="tab === t.key ? 'page' : undefined"
        >
          {{ t.label }}
          <span class="text-xs text-faint tabular-nums">{{ t.count() }}</span>
          <span v-if="tab === t.key" class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" aria-hidden="true" />
        </RouterLink>
      </div>
    </nav>
    <KeepAlive>
      <component :is="view" :key="tab" />
    </KeepAlive>
  </div>
</template>
