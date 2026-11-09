<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { talentGrade } from '@/data/display'
import { bestSource, lineupsLink } from '@/data/lineupQuery'
import { useDb } from '@/data/store'
import Badge from '../Badge.vue'
import CardLink from '../CardLink.vue'
import NavIcon from '../NavIcon.vue'
import RichText from '../RichText.vue'
import DetailHeader from './DetailHeader.vue'
import DetailSection from './DetailSection.vue'

const props = defineProps<{ id: number }>()
const db = useDb()
const router = useRouter()
const talent = computed(() => db.talentById.get(props.id))
const grade = computed(() => talentGrade(talent.value?.quality ?? 0))

/** 1-2 linked heroes: the talent needs all of them, so link to lineups that have them all. */
const pairedHeroes = computed(() => {
  const ids = talent.value?.heroes ?? []
  return ids.length > 0 && ids.length <= 2 ? ids : []
})
const heroNames = computed(() => pairedHeroes.value.map((id) => db.heroById.get(id)?.name ?? `#${id}`).join(' + '))
const lineupCount = computed(() => (pairedHeroes.value.length ? bestSource(db, { heroes: pairedHeroes.value }).count : 0))
</script>

<template>
  <div v-if="talent">
    <DetailHeader :icon="talent.icon" :name="talent.name" :ring="grade.color">
      <Badge :color="grade.color">{{ grade.label }}</Badge>
      <Badge v-if="talent.cp" color="var(--t-exclusive)">CP天赋</Badge>
      <Badge v-if="talent.stage">{{ talent.stage }}</Badge>
      <Badge v-if="talent.pack">{{ talent.pack }}</Badge>
    </DetailHeader>

    <DetailSection title="效果">
      <p class="text-[15px] leading-relaxed"><RichText :text="talent.desc" /></p>
    </DetailSection>

    <DetailSection v-if="talent.cp" title="CP 英雄">
      <div class="flex flex-wrap items-center gap-2">
        <CardLink kind="hero" :id="talent.cp.heroes[0]" />
        <span class="text-faint">+</span>
        <CardLink kind="hero" :id="talent.cp.heroes[1]" />
      </div>
      <p class="mt-2 text-[13px] text-muted">
        两名英雄同时在场时生效。{{ talent.cp.grantsCards ? '选择该天赋会直接获得这两张英雄牌。' : '' }}
      </p>
    </DetailSection>

    <DetailSection v-else-if="talent.heroes.length" :title="talent.heroes.length > 2 ? '相关英雄（举例）' : '相关英雄'">
      <div class="flex flex-wrap items-center gap-2">
        <CardLink v-for="id in talent.heroes" :key="id" kind="hero" :id="id" />
      </div>
      <p class="mt-2 text-[13px] text-muted">
        <template v-if="talent.heroes.length > 2">这类英雄任意一名在场即可受益，点英雄可查看用到它的阵容。</template>
        <template v-else>{{ talent.grantsHeroes ? '选择该天赋会直接获得这张英雄牌。' : '对应英雄在场时才有效果。' }}</template>
      </p>
    </DetailSection>

    <template v-if="pairedHeroes.length">
      <button
        v-if="lineupCount"
        type="button"
        class="mt-3 flex w-full items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm transition-colors hover:border-accent"
        @click="router.push(lineupsLink({ heroes: pairedHeroes }))"
      >
        <span>含 {{ heroNames }} 的官方阵容 <b class="text-accent tabular-nums">{{ lineupCount }}</b> 套</span>
        <NavIcon name="chevron" :size="18" class="text-faint" />
      </button>
      <p v-else class="mt-3 px-1 text-[13px] text-faint">官方阵容里暂时没有同时用到 {{ heroNames }} 的</p>
    </template>

    <DetailSection v-if="talent.lordId !== undefined" title="棋手专属">
      <CardLink kind="lord" :id="talent.lordId" sub="6 级领取" />
    </DetailSection>
  </div>
  <p v-else class="py-10 text-center text-muted">没有找到这个天赋</p>
</template>
