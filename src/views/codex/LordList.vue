<script setup lang="ts">
import { computed } from 'vue'
import CardIcon from '@/components/CardIcon.vue'
import CodexToolbar from '@/components/CodexToolbar.vue'
import RichText from '@/components/RichText.vue'
import { useDetail } from '@/composables/useDetail'
import { usePersistentRef } from '@/composables/usePersistentRef'
import { nameMatches } from '@/data/search'
import { useDb } from '@/data/store'

const db = useDb()
const { open } = useDetail()
const q = usePersistentRef('codex:lords:q', '', 'session')

const list = computed(() => db.lords.filter((l) => nameMatches(l.name, q.value)))
</script>

<template>
  <div>
    <CodexToolbar v-model:query="q" :count="list.length" unit="名棋手" placeholder="搜索棋手（支持拼音首字母）" :filtered="!!q" @reset="q = ''" />

    <ul v-if="list.length" class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <li v-for="l in list" :key="l.id">
        <button
          type="button"
          class="flex h-full w-full items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent"
          @click="open('lord', l.id)"
        >
          <CardIcon :src="l.avatar" :name="l.name" :size="52" round />
          <span class="min-w-0 flex-1">
            <span class="block font-semibold">{{ l.name }}</span>
            <span v-if="l.skill" class="mt-0.5 block text-xs text-accent">{{ l.skill.name }}</span>
            <span v-if="l.skill" class="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">
              <RichText :text="l.skill.desc" :interactive="false" />
            </span>
          </span>
        </button>
      </li>
    </ul>
    <p v-else class="py-16 text-center text-muted">没有找到这名棋手</p>
  </div>
</template>
