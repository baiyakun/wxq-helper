<script setup lang="ts">
/**
 * Card detail container: bottom sheet on mobile, right-side drawer on desktop.
 * Open/close state comes from the URL (see useDetail).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useDetail } from '@/composables/useDetail'
import { KIND_LABEL, type CardKind } from '@/data/store'
import EffectDetail from './details/EffectDetail.vue'
import EquipDetail from './details/EquipDetail.vue'
import HeroDetail from './details/HeroDetail.vue'
import LordDetail from './details/LordDetail.vue'
import TalentDetail from './details/TalentDetail.vue'
import NavIcon from './NavIcon.vue'

const VIEWS: Record<CardKind, Component> = {
  hero: HeroDetail,
  equip: EquipDetail,
  talent: TalentDetail,
  effect: EffectDetail,
  lord: LordDetail,
}

const { current, close } = useDetail()
const view = computed(() => (current.value ? VIEWS[current.value.kind] : null))
const scroller = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)

watch(current, async (now, before) => {
  document.body.style.overflow = now ? 'hidden' : ''
  if (!now) return
  await nextTick()
  scroller.value?.scrollTo({ top: 0 })
  // Move focus into the dialog (not onto a button, which would show a focus ring right away)
  if (!before) panel.value?.focus({ preventScroll: true })
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && current.value) close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Transition name="fade">
    <div v-if="current" class="fixed inset-0 z-40 bg-[var(--scrim)]" aria-hidden="true" @click="close" />
  </Transition>
  <Transition name="sheet">
    <div
      v-if="current && view"
      ref="panel"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      :aria-label="`${KIND_LABEL[current.kind]}详情`"
      class="fixed outline-none inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-line bg-surface shadow-2xl lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[460px] lg:rounded-none lg:border-t-0 lg:border-l"
    >
      <div class="relative flex h-12 shrink-0 items-center px-4">
        <span class="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-surface-3 lg:hidden" aria-hidden="true" />
        <span class="text-xs text-faint">{{ KIND_LABEL[current.kind] }}</span>
        <button
          type="button"
          class="-mr-2 ml-auto flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
          aria-label="关闭"
          @click="close"
        >
          <NavIcon name="close" :size="20" />
        </button>
      </div>
      <div ref="scroller" class="overflow-y-auto overscroll-contain px-4 pt-1 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <component :is="view" :id="current.id" :key="`${current.kind}-${current.id}`" />
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

.sheet-enter-active,
.sheet-leave-active {
  transition: transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateY(100%);
}
@media (min-width: 1024px) {
  .sheet-enter-from,
  .sheet-leave-to {
    transform: translateX(100%);
  }
}
</style>
