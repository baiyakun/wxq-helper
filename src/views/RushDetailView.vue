<script setup lang="ts">
/** A 钻石狂潮 lineup: opening pack, board per config group and the 8 auction rounds. */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Badge from '@/components/Badge.vue'
import CardIcon from '@/components/CardIcon.vue'
import CardLink from '@/components/CardLink.vue'
import DetailSection from '@/components/details/DetailSection.vue'
import HeroAvatar from '@/components/HeroAvatar.vue'
import NavIcon from '@/components/NavIcon.vue'
import RichText from '@/components/RichText.vue'
import RushBoard from '@/components/RushBoard.vue'
import RushCardTile from '@/components/RushCardTile.vue'
import SortChips from '@/components/SortChips.vue'
import { findRushLineup, isRushFavorite, toggleRushFavorite } from '@/composables/rushFavorites'
import { rushRoom as room } from '@/composables/rushRoom'
import { showToast } from '@/composables/toast'
import { campColor } from '@/data/display'
import { categoryLabel, gradeColor, maxBid, RUSH_ROOMS, roomLabel, type BidTier } from '@/data/rush'
import { rushComplete, useDb } from '@/data/store'
import type { RushHero, RushPack, RushRound } from '@/types/data'

const route = useRoute()
const db = useDb()

const id = computed(() => String(route.params.id ?? ''))
const found = computed(() => findRushLineup(db, id.value))
const lineup = computed(() => found.value?.lineup)
const fav = computed(() => (lineup.value ? isRushFavorite(lineup.value.id) : false))

const roomOptions = RUSH_ROOMS.map((r) => ({ value: r.value, label: r.label }))

const groupIndex = ref(0)
watch(id, () => (groupIndex.value = 0))
const group = computed(() => lineup.value?.groups[groupIndex.value] ?? lineup.value?.groups[0])

const TIP_HINT: Record<string, string> = { S: '优先拿', A: '强力备选', B: '按局势补强' }
const tipGroups = computed(() => {
  const groups: { grade: string; cards: RushPack['tips'] }[] = []
  for (const t of lineup.value?.pack?.tips ?? []) {
    const g = groups.find((x) => x.grade === t.grade)
    if (g) g.cards.push(t)
    else groups.push({ grade: t.grade, cards: [t] })
  }
  return groups
})

const heroName = (h: RushHero) => (h.id ? (db.heroById.get(h.id)?.name ?? `#${h.id}`) : (h.name ?? '?'))
const equipped = computed(() => (group.value?.heroes ?? []).filter((h) => h.equips.length || h.extraEquips?.length))

function bidNote(r: RushRound, i: number) {
  const tier: BidTier = i > 0 ? 'alternative' : r.keyPick ? 'key' : 'primary'
  const bid = maxBid(r.round, room.value, tier)
  return bid ? `≤ ${bid} 钻` : ''
}

function onFavorite() {
  if (lineup.value) showToast(toggleRushFavorite(lineup.value) ? '已收藏，可在「我的」中查看' : '已取消收藏')
}
</script>

<template>
  <div v-if="lineup && group" class="mx-auto max-w-3xl">
    <RouterLink to="/rush" class="mb-3 hidden items-center gap-1 text-sm text-muted hover:text-text lg:inline-flex">
      <NavIcon name="back" :size="16" />钻石狂潮
    </RouterLink>

    <div v-if="found?.removed" class="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--q6)_40%,transparent)] bg-[color-mix(in_srgb,var(--q6)_10%,transparent)] px-3 py-2 text-[13px]">
      虎牙的钻石狂潮阵容库里已经没有这套了（可能随版本调整下架）。以下是你收藏时保存的内容。
    </div>

    <!-- Header -->
    <header>
      <h2 class="text-xl leading-snug font-semibold">{{ lineup.pack?.name ?? lineup.name }}</h2>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <Badge color="var(--accent)">钻石狂潮 · {{ categoryLabel(lineup.category) }}</Badge>
        <Badge v-for="c in lineup.camps" :key="c" :color="campColor(c)">{{ c }}</Badge>
      </div>
      <p class="mt-2 text-[12px] leading-relaxed text-faint">
        来自虎牙万象棋助手，非官方数据，强度会随版本调整。狂潮阵容没有阵容码，需要在对局里照着站位摆。
      </p>

      <ul class="mt-3 grid grid-cols-3 gap-2" aria-label="各场次评级">
        <li v-for="r in RUSH_ROOMS" :key="r.value">
          <button
            type="button"
            class="w-full rounded-xl border py-2 text-center transition-colors"
            :class="room === r.value ? 'border-accent bg-surface-2' : 'border-line bg-surface hover:border-faint'"
            :aria-pressed="room === r.value"
            @click="room = r.value"
          >
            <span class="block text-[11px] text-muted">{{ r.label }}</span>
            <template v-if="lineup.ratings[r.value]">
              <span class="block text-lg leading-tight font-bold" :style="{ color: gradeColor(lineup.ratings[r.value]!.grade) }">{{ lineup.ratings[r.value]!.grade }}</span>
              <span class="block text-[11px] text-faint tabular-nums">{{ lineup.ratings[r.value]!.score }}分</span>
            </template>
            <span v-else class="block py-1.5 text-xs text-faint">暂无</span>
          </button>
        </li>
      </ul>

      <button
        type="button"
        class="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border text-sm sm:w-auto sm:px-5"
        :class="fav ? 'border-accent text-accent' : 'border-line text-muted hover:text-text'"
        :aria-pressed="fav"
        @click="onFavorite"
      >
        <NavIcon name="star" :size="18" :filled="fav" />{{ fav ? '已收藏' : '收藏' }}
      </button>
    </header>

    <!-- Opening pack -->
    <template v-if="lineup.pack">
      <DetailSection title="卡包固定获得">
        <ul class="grid gap-2 sm:grid-cols-2">
          <li v-for="(c, i) in lineup.pack.items" :key="`${c.kind}-${c.name}-${i}`">
            <RushCardTile :card="c" :note="`×${c.count}`" />
          </li>
        </ul>
      </DetailSection>

      <DetailSection v-if="lineup.pack.opening.length || lineup.pack.reminder" title="天赋 / 效果牌使用顺序">
        <ol class="space-y-2">
          <li v-for="(s, i) in lineup.pack.opening" :key="i" class="flex gap-3 rounded-xl bg-surface-2 p-3">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold tabular-nums">{{ i + 1 }}</span>
            <span class="min-w-0">
              <span class="block text-sm font-medium">{{ s.label }}</span>
              <span v-if="s.reason" class="mt-0.5 block text-[13px] leading-relaxed text-muted">{{ s.reason }}</span>
            </span>
          </li>
        </ol>
        <p v-if="lineup.pack.reminder" class="mt-2 text-[13px] leading-relaxed text-muted">机制提醒：{{ lineup.pack.reminder }}</p>
      </DetailSection>

      <DetailSection title="初始上阵顺序">
        <template v-if="lineup.pack.deploy.length">
          <ol class="space-y-2">
            <li v-for="(s, i) in lineup.pack.deploy" :key="i" class="flex gap-3 rounded-xl bg-surface-2 p-3">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold tabular-nums">{{ i + 1 }}</span>
              <span class="min-w-0">
                <span class="block text-sm font-medium">{{ s.label }}</span>
                <span v-if="s.reason" class="mt-0.5 block text-[13px] leading-relaxed text-muted">{{ s.reason }}</span>
              </span>
            </li>
          </ol>
          <p v-if="lineup.pack.deployFollowUp" class="mt-2 text-[13px] leading-relaxed text-muted">后续补牌：{{ lineup.pack.deployFollowUp }}</p>
          <p v-if="lineup.pack.deployNote" class="mt-1 text-[12px] leading-relaxed text-faint">{{ lineup.pack.deployNote }}</p>
        </template>
        <p v-else class="text-[13px] leading-relaxed text-muted">这套卡包的英雄没有硬性的上场先后，按阵营人数、站位和主力升阶的需要灵活上场。</p>
      </DetailSection>

      <DetailSection v-if="tipGroups.length" title="后续效果锦囊推荐">
        <p class="-mt-1 mb-2 text-[12px] text-faint">锦囊是所有人共享的牌池，这里按这套阵容的需要排了优先级。</p>
        <div class="space-y-3">
          <div v-for="g in tipGroups" :key="g.grade">
            <div class="mb-1.5 flex items-center gap-2 text-sm">
              <span class="font-bold" :style="{ color: gradeColor(g.grade) }">{{ g.grade }}</span>
              <span class="text-muted">{{ TIP_HINT[g.grade] ?? '' }}</span>
            </div>
            <ul class="grid gap-2 sm:grid-cols-2">
              <li v-for="t in g.cards" :key="t.card.name"><RushCardTile :card="t.card" /></li>
            </ul>
          </div>
        </div>
      </DetailSection>
    </template>

    <!-- Config groups -->
    <div v-if="lineup.groups.length > 1" class="mt-6">
      <div class="flex rounded-full bg-surface-2 p-0.5" role="tablist" aria-label="配置组">
        <button
          v-for="(g, i) in lineup.groups"
          :key="i"
          type="button"
          role="tab"
          :aria-selected="groupIndex === i"
          class="h-9 flex-1 rounded-full text-sm transition-colors"
          :class="groupIndex === i ? 'bg-surface-3 font-medium text-text shadow-sm' : 'text-muted hover:text-text'"
          @click="groupIndex = i"
        >{{ g.label || `配置组${i + 1}` }}</button>
      </div>
      <p v-if="group.added.length || group.removed.length" class="mt-2 flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
        <template v-if="group.added.length">
          换上
          <HeroAvatar v-for="hid in group.added" :key="`a${hid}`" :id="hid" :size="26" />
        </template>
        <template v-if="group.removed.length">
          <span :class="group.added.length ? 'ml-2' : ''">换下</span>
          <HeroAvatar v-for="hid in group.removed" :key="`r${hid}`" :id="hid" :size="26" class="opacity-60" />
        </template>
      </p>
    </div>

    <DetailSection title="站位">
      <RushBoard :heroes="group.heroes" />
    </DetailSection>

    <DetailSection v-if="group.thought" title="阵容思路">
      <p class="text-[15px] leading-relaxed"><RichText :text="group.thought" /></p>
    </DetailSection>

    <!-- Auction rounds -->
    <DetailSection v-if="group.rounds.length || group.auctionAdvice || group.keyItems" title="拍卖天赋（8 回合）">
      <SortChips v-model="room" label="场次" :options="roomOptions" />
      <p class="mt-1.5 text-[12px] leading-relaxed text-faint">
        「≤」是虎牙按{{ roomLabel(room) }}默认带入估算的最高出价，不含实时换算，仅供参考。首选是这套阵容的关键道具时，估价会高一些。
      </p>
      <ol class="mt-3 space-y-3">
        <li v-for="r in group.rounds" :key="r.round" class="rounded-2xl border border-line bg-surface p-2.5">
          <div class="mb-2 flex items-center gap-2 px-0.5 text-sm">
            <span class="font-semibold">第 {{ r.round }} 回合</span>
            <span class="text-xs text-faint">{{ r.picks[0]?.kind === 'equip' ? '拍卖装备' : '拍卖天赋' }}</span>
          </div>
          <ul class="grid gap-2 sm:grid-cols-3">
            <li v-for="(p, i) in r.picks" :key="`${p.name}-${i}`">
              <RushCardTile
                :card="p"
                :label="i === 0 ? '首选' : '备选'"
                :sub="p.series || (p.kind === 'equip' ? '装备' : '天赋')"
                :note="bidNote(r, i)"
                :badge="i === 0 && r.keyPick ? '关键' : undefined"
                :highlight="i === 0"
              />
            </li>
          </ul>
        </li>
      </ol>
      <div v-if="group.auctionAdvice || group.keyItems" class="mt-3 space-y-1.5 rounded-xl bg-surface-2 p-3 text-[14px] leading-relaxed">
        <p v-if="group.auctionAdvice"><span class="text-faint">拍卖建议：</span>{{ group.auctionAdvice }}</p>
        <p v-if="group.keyItems"><span class="text-faint">关键道具：</span>{{ group.keyItems }}</p>
      </div>
    </DetailSection>

    <DetailSection v-if="equipped.length" title="装备">
      <ul class="space-y-2">
        <li v-for="h in equipped" :key="`${h.id}-${h.x}-${h.z}`" class="flex flex-wrap items-center gap-2">
          <CardLink v-if="h.id" kind="hero" :id="h.id" />
          <span v-else class="inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pr-3 pl-1 text-sm">
            <CardIcon :src="h.icon ?? ''" :name="heroName(h)" :size="26" round />
            <span class="font-medium">{{ heroName(h) }}</span>
          </span>
          <span class="text-faint">→</span>
          <CardLink v-for="(eid, i) in h.equips" :key="`${eid}-${i}`" kind="equip" :id="eid" />
          <span v-for="n in h.extraEquips ?? []" :key="n" class="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm">{{ n }}</span>
        </li>
      </ul>
    </DetailSection>
  </div>

  <div v-else-if="!rushComplete()" class="mx-auto mt-16 max-w-sm text-center text-muted" aria-busy="true">正在加载钻石狂潮数据…</div>

  <div v-else class="mx-auto mt-16 max-w-sm text-center">
    <p class="font-medium">没有找到这套狂潮阵容</p>
    <p class="mt-1 text-sm text-muted">它可能已随版本调整下架。</p>
    <RouterLink to="/rush" class="mt-4 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">返回钻石狂潮</RouterLink>
  </div>
</template>
