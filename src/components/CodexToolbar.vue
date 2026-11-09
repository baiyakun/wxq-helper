<script setup lang="ts">
/** Search box + filter chip rows + result count for codex lists. */
import { onMounted } from 'vue'
import { preparePinyin } from '@/data/search'
import NavIcon from './NavIcon.vue'

defineProps<{ count: number; unit: string; placeholder: string; filtered: boolean }>()
defineEmits<{ reset: [] }>()
const query = defineModel<string>('query', { required: true })

onMounted(preparePinyin)
</script>

<template>
  <div class="mb-3 space-y-2">
    <div class="flex gap-2">
      <label class="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 focus-within:border-accent">
        <NavIcon name="search" :size="18" class="shrink-0 text-faint" />
        <input
          v-model="query"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          :placeholder="placeholder"
          class="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
        <button v-if="query" type="button" class="-mr-1 p-1 text-faint hover:text-text" aria-label="清空搜索" @click="query = ''">
          <NavIcon name="close" :size="16" />
        </button>
      </label>
      <slot name="actions" />
    </div>
    <slot />
    <div class="flex h-7 items-center justify-between text-xs text-faint">
      <span>共 {{ count }} {{ unit }}</span>
      <button v-if="filtered" type="button" class="px-1 text-accent" @click="$emit('reset')">清除筛选</button>
    </div>
  </div>
</template>
