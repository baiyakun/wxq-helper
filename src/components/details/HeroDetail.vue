<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { campColor, tierColor } from '@/data/display'
import { bestSource, lineupsLink } from '@/data/lineupQuery'
import { useDb } from '@/data/store'
import Badge from '../Badge.vue'
import CardIcon from '../CardIcon.vue'
import CardLink from '../CardLink.vue'
import RichText from '../RichText.vue'
import DetailHeader from './DetailHeader.vue'
import NavIcon from '../NavIcon.vue'
import DetailSection from './DetailSection.vue'

const props = defineProps<{ id: number }>()
const db = useDb()
const router = useRouter()
const hero = computed(() => db.heroById.get(props.id))
// Count in the list the link opens, so the number matches what the user sees there.
const lineupCount = computed(() => bestSource(db, { heroes: [props.id] }).count)

const cps = computed(() => {
  const h = hero.value
  if (!h) return []
  return (db.cpByHero.get(h.id) ?? []).map((t) => {
    const partnerId = t.cp?.heroes.find((x) => x !== h.id)
    return { talent: t, partner: partnerId !== undefined ? db.heroById.get(partnerId)?.name : undefined }
  })
})

const stats = computed(() => {
  const s = hero.value?.stats
  if (!s) return []
  return [
    { k: '生命', v: s.hp },
    { k: '物理攻击', v: s.atk },
    { k: '法术攻击', v: s.ap },
    { k: '物理防御', v: s.def },
    { k: '法术防御', v: s.mdef },
    { k: '攻击距离', v: `${s.range} 格` },
    { k: '能量上限', v: s.energy },
    { k: '初始能量', v: s.initEnergy },
  ]
})

const keywordDescs = computed(() =>
  (hero.value?.keywords ?? []).map((k) => db.keywordByName.get(k)).filter((k) => k !== undefined),
)
</script>

<template>
  <div v-if="hero">
    <DetailHeader :icon="hero.avatar" :name="hero.name" :ring="tierColor(hero.quality)">
      <Badge :color="campColor(hero.camp)">{{ hero.camp }}</Badge>
      <Badge :color="tierColor(hero.quality)">{{ hero.quality }}阶</Badge>
      <Badge v-for="l in hero.labels" :key="l" color="var(--accent)">{{ l }}</Badge>
    </DetailHeader>

    <button
      v-if="lineupCount"
      type="button"
      class="mt-4 flex w-full items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm transition-colors hover:border-accent"
      @click="router.push(lineupsLink({ heroes: [hero.id] }))"
    >
      <span>出现在 <b class="text-accent tabular-nums">{{ lineupCount }}</b> 套官方阵容中</span>
      <NavIcon name="chevron" :size="18" class="text-faint" />
    </button>

    <DetailSection v-if="hero.desc" title="特性">
      <p class="text-[15px] leading-relaxed"><RichText :text="hero.desc" /></p>
      <div v-if="hero.awakenDesc && hero.awakenDesc !== hero.desc" class="mt-3 rounded-xl bg-surface-2 p-3">
        <div class="mb-1 text-xs font-medium text-accent">觉醒后</div>
        <p class="text-[14px] leading-relaxed"><RichText :text="hero.awakenDesc" /></p>
      </div>
    </DetailSection>

    <DetailSection title="技能">
      <div class="flex items-center gap-2.5">
        <CardIcon :src="hero.skill.icon" :name="hero.skill.name" :size="36" round />
        <span class="font-medium">{{ hero.skill.name }}</span>
      </div>
      <p class="mt-2 text-[15px] leading-relaxed"><RichText :text="hero.skill.desc" /></p>
      <ol v-if="hero.skill.enhance.length" class="mt-3 space-y-2">
        <li v-for="e in hero.skill.enhance" :key="e.level" class="flex gap-3 rounded-xl bg-surface-2 p-3">
          <span class="w-14 shrink-0 text-sm font-semibold text-accent tabular-nums">Lv.{{ e.level }}</span>
          <span class="text-[14px] leading-relaxed"><RichText :text="e.desc" /></span>
        </li>
      </ol>
    </DetailSection>

    <DetailSection v-if="cps.length" title="CP 天赋">
      <ul class="space-y-2">
        <li v-for="c in cps" :key="c.talent.id" class="flex flex-wrap items-center gap-2">
          <CardLink kind="talent" :id="c.talent.id" />
          <span v-if="c.partner" class="text-sm text-muted">与 {{ c.partner }} 共战</span>
        </li>
      </ul>
    </DetailSection>

    <DetailSection v-if="hero.related.length" title="相关卡牌">
      <ul class="space-y-2">
        <li v-for="r in hero.related" :key="r.id" class="flex gap-3 rounded-xl bg-surface-2 p-3">
          <CardIcon :src="r.icon" :name="r.name" :size="36" />
          <div class="min-w-0">
            <div class="font-medium">{{ r.name }}</div>
            <p class="text-[13px] leading-relaxed text-muted"><RichText :text="r.desc" /></p>
          </div>
        </li>
      </ul>
    </DetailSection>

    <DetailSection v-if="keywordDescs.length" title="关键词">
      <dl class="space-y-1.5 text-[14px]">
        <div v-for="k in keywordDescs" :key="k.name">
          <dt class="inline font-medium">{{ k.name }}：</dt>
          <dd class="inline text-muted"><RichText :text="k.desc" :interactive="false" /></dd>
        </div>
      </dl>
    </DetailSection>

    <DetailSection title="基础属性">
      <dl class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div v-for="s in stats" :key="s.k" class="rounded-xl bg-surface-2 px-3 py-2">
          <dt class="text-xs text-faint">{{ s.k }}</dt>
          <dd class="font-semibold tabular-nums">{{ s.v }}</dd>
        </div>
      </dl>
    </DetailSection>
  </div>
  <p v-else class="py-10 text-center text-muted">没有找到这名英雄</p>
</template>
