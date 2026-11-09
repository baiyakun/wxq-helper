<script setup lang="ts">
/** One CP pair: both heroes, all of their CP talents, and links into the lineup list. */
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDetail } from '@/composables/useDetail'
import type { CpGroup, CpStats } from '@/data/cp'
import { campColor, stageShort, talentGrade } from '@/data/display'
import { lineupsLink } from '@/data/lineupQuery'
import { useDb } from '@/data/store'
import Badge from './Badge.vue'
import CardIcon from './CardIcon.vue'
import HeroAvatar from './HeroAvatar.vue'
import NavIcon from './NavIcon.vue'
import RichText from './RichText.vue'

const props = defineProps<{ group: CpGroup; stats: CpStats }>()
const db = useDb()
const router = useRouter()
const { open } = useDetail()

const heroes = computed(() => props.group.heroes.map((id) => ({ id, hero: db.heroById.get(id) })))
const pairName = computed(() => heroes.value.map((h) => h.hero?.name ?? `#${h.id}`).join(' + '))
</script>

<template>
  <article class="rounded-2xl border border-line bg-surface p-3">
    <h3 class="sr-only">{{ pairName }}</h3>
    <div class="flex items-center gap-1">
      <template v-for="(h, i) in heroes" :key="h.id">
        <span v-if="i" class="shrink-0 text-lg text-faint" aria-hidden="true">+</span>
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left transition-colors hover:bg-surface-2"
          @click="open('hero', h.id)"
        >
          <HeroAvatar :id="h.id" :size="44" />
          <span class="min-w-0">
            <span class="block truncate font-semibold">{{ h.hero?.name ?? `#${h.id}` }}</span>
            <Badge v-if="h.hero" :color="campColor(h.hero.camp)">{{ h.hero.camp }}</Badge>
          </span>
        </button>
      </template>
    </div>

    <ul class="mt-2 space-y-2">
      <li v-for="t in group.talents" :key="t.id" class="rounded-xl bg-surface-2 p-3">
        <button type="button" class="flex w-full items-center gap-2.5 text-left" @click="open('talent', t.id)">
          <CardIcon :src="t.icon" :name="t.name" :size="36" :ring="talentGrade(t.quality).color" />
          <span class="min-w-0 flex-1">
            <span class="block font-medium">{{ t.name }}</span>
            <span class="mt-0.5 flex flex-wrap gap-1">
              <Badge :color="talentGrade(t.quality).color">{{ talentGrade(t.quality).label }}</Badge>
              <Badge v-if="t.stage">{{ stageShort(t.stage) }}</Badge>
              <Badge v-if="t.pack">{{ t.pack }}</Badge>
              <Badge v-if="t.cp?.grantsCards" color="var(--accent)">送两张英雄牌</Badge>
            </span>
          </span>
          <NavIcon name="chevron" :size="16" class="shrink-0 text-faint" />
        </button>
        <p class="mt-2 text-[14px] leading-relaxed"><RichText :text="t.desc" /></p>
        <button
          v-if="stats.byTalent.get(t.id)"
          type="button"
          class="mt-2 inline-flex items-center gap-0.5 text-[13px] text-accent"
          @click="router.push(lineupsLink({ talents: [t.id] }))"
        >
          {{ stats.byTalent.get(t.id) }} 套官方阵容推荐了该天赋
          <NavIcon name="chevron" :size="14" />
        </button>
      </li>
    </ul>

    <button
      v-if="stats.both"
      type="button"
      class="mt-2 flex w-full items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm transition-colors hover:border-accent"
      @click="router.push(lineupsLink({ heroes: group.heroes }))"
    >
      <span>同时使用两人的官方阵容 <b class="text-accent tabular-nums">{{ stats.both }}</b> 套</span>
      <NavIcon name="chevron" :size="18" class="text-faint" />
    </button>
    <p v-else class="mt-2 px-1 text-[13px] text-faint">官方阵容里暂时没有同时使用这两人的</p>
  </article>
</template>
