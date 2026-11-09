<script setup lang="ts">
import { computed } from 'vue'
import { talentGrade } from '@/data/display'
import { useDb } from '@/data/store'
import Badge from '../Badge.vue'
import CardLink from '../CardLink.vue'
import RichText from '../RichText.vue'
import DetailHeader from './DetailHeader.vue'
import DetailSection from './DetailSection.vue'

const props = defineProps<{ id: number }>()
const db = useDb()
const talent = computed(() => db.talentById.get(props.id))
const grade = computed(() => talentGrade(talent.value?.quality ?? 0))
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
        两名英雄同时上场（共战）时生效。{{ talent.cp.grantsCards ? '选择该天赋会直接获得这两张英雄牌。' : '' }}
      </p>
    </DetailSection>

    <DetailSection v-if="talent.lordId !== undefined" title="棋手专属">
      <CardLink kind="lord" :id="talent.lordId" sub="6 级领取" />
    </DetailSection>
  </div>
  <p v-else class="py-10 text-center text-muted">没有找到这个天赋</p>
</template>
