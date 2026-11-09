<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailSheet from '@/components/DetailSheet.vue'
import NavIcon from '@/components/NavIcon.vue'
import SearchOverlay from '@/components/SearchOverlay.vue'
import ToastHost from '@/components/ToastHost.vue'
import type { IconName } from '@/components/ui'
import { isCodexTab, lastCodexTab } from '@/composables/codexTab'
import { refreshFavoriteSnapshots } from '@/composables/favorites'
import { initData, useDataStatus, useDb } from '@/data/store'

const route = useRoute()
const router = useRouter()
const { status, error, huyaStatus } = useDataStatus()

// Keep favorite snapshots fresh so removed lineups still show their last known content
// (again once Huya's lineups have loaded).
watch([status, huyaStatus], ([s]) => s === 'ready' && refreshFavoriteSnapshots(useDb()))

function goBack() {
  // history.state.back is set by vue-router when there is an in-app previous entry
  if (window.history.state?.back) router.back()
  else void router.push(route.meta.back ?? '/')
}
const searchOpen = ref(false)

const nav = computed<{ to: string; match: string; label: string; icon: IconName }[]>(() => [
  { to: '/lineups', match: '/lineups', label: '阵容', icon: 'lineups' },
  { to: '/recommend', match: '/recommend', label: '推荐', icon: 'recommend' },
  { to: `/codex/${isCodexTab(lastCodexTab.value) ? lastCodexTab.value : 'heroes'}`, match: '/codex', label: '图鉴', icon: 'codex' },
  { to: '/me', match: '/me', label: '我的', icon: 'me' },
])
const isActive = (match: string) => route.path.startsWith(match)
const title = computed(() => route.meta.title ?? '万象棋助手')

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))

function onKey(e: KeyboardEvent) {
  if (status.value !== 'ready') return
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchOpen.value = !searchOpen.value
  } else if (e.key === '/' && !searchOpen.value && !isTyping(e.target)) {
    e.preventDefault()
    searchOpen.value = true
  }
}

onMounted(() => {
  void initData()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
</script>

<template>
  <div class="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
    <!-- Desktop sidebar -->
    <aside class="sticky top-0 hidden h-dvh flex-col border-r border-line px-3 py-5 lg:flex">
      <div class="px-3 text-lg font-semibold">万象棋助手</div>
      <button
        type="button"
        class="mt-5 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-faint hover:border-accent"
        :disabled="status !== 'ready'"
        @click="searchOpen = true"
      >
        <NavIcon name="search" :size="18" />
        <span class="flex-1 text-left">搜索</span>
        <kbd class="rounded border border-line px-1.5 text-[11px]">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
      </button>
      <nav class="mt-4 space-y-1" aria-label="主导航">
        <RouterLink
          v-for="n in nav"
          :key="n.match"
          :to="n.to"
          class="flex h-11 items-center gap-3 rounded-xl px-3 transition-colors"
          :class="isActive(n.match) ? 'bg-surface-2 font-medium text-text' : 'text-muted hover:bg-surface hover:text-text'"
          :aria-current="isActive(n.match) ? 'page' : undefined"
        >
          <NavIcon :name="n.icon" :class="isActive(n.match) ? 'text-accent' : ''" />
          {{ n.label }}
        </RouterLink>
      </nav>
    </aside>

    <div class="min-w-0">
      <!-- Mobile header -->
      <header class="sticky top-0 z-30 flex h-12 items-center border-b border-line bg-bg/90 px-4 backdrop-blur lg:hidden">
        <button
          v-if="route.meta.back"
          type="button"
          class="-ml-2 flex size-10 items-center justify-center rounded-full text-muted hover:text-text"
          aria-label="返回"
          @click="goBack"
        >
          <NavIcon name="back" />
        </button>
        <h1 class="text-[17px] font-semibold">{{ title }}</h1>
        <button
          type="button"
          class="-mr-2 ml-auto flex size-10 items-center justify-center rounded-full text-muted hover:text-text"
          aria-label="搜索"
          :disabled="status !== 'ready'"
          @click="searchOpen = true"
        >
          <NavIcon name="search" />
        </button>
      </header>

      <main class="mx-auto w-full max-w-5xl px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:pt-6 lg:pb-12">
        <div v-if="status === 'loading'" class="grid grid-cols-4 gap-3 pt-14 sm:grid-cols-6 lg:grid-cols-8" aria-busy="true" aria-label="加载中">
          <div v-for="i in 16" :key="i" class="flex flex-col items-center gap-2">
            <div class="size-14 animate-pulse rounded-[10px] bg-surface-2" />
            <div class="h-3 w-10 animate-pulse rounded bg-surface-2" />
          </div>
        </div>
        <div v-else-if="status === 'error'" class="mx-auto mt-16 max-w-sm text-center" role="alert">
          <p class="font-medium">数据加载失败</p>
          <p class="mt-1 text-sm text-muted">{{ error }}</p>
          <button type="button" class="mt-4 h-10 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink" @click="initData">
            重试
          </button>
        </div>
        <RouterView v-else v-slot="{ Component }">
          <!-- Keep list pages alive so filters, loaded items and scroll survive opening a detail page -->
          <KeepAlive include="LineupsView,CodexView,RecommendView">
            <component :is="Component" />
          </KeepAlive>
        </RouterView>
      </main>
    </div>

    <!-- Mobile tab bar -->
    <nav class="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur lg:hidden" aria-label="主导航">
      <div class="grid h-14 grid-cols-4">
        <RouterLink
          v-for="n in nav"
          :key="n.match"
          :to="n.to"
          class="flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors"
          :class="isActive(n.match) ? 'font-medium text-accent' : 'text-faint'"
          :aria-current="isActive(n.match) ? 'page' : undefined"
        >
          <NavIcon :name="n.icon" />
          {{ n.label }}
        </RouterLink>
      </div>
    </nav>

    <template v-if="status === 'ready'">
      <DetailSheet />
      <SearchOverlay v-model:open="searchOpen" />
    </template>
    <ToastHost />
  </div>
</template>
