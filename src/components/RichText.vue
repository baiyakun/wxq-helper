<script setup lang="ts">
/**
 * Renders our rich-text markers as plain DOM text (never v-html):
 *   {{text}} -> highlight, [[keyword]] -> tappable keyword with inline explanation.
 */
import { computed, ref } from 'vue'
import { useDb } from '@/data/store'

const props = withDefaults(defineProps<{ text: string; interactive?: boolean }>(), { interactive: true })

interface Token {
  t: 'text' | 'hl' | 'kw'
  v: string
}

const TOKEN_RE = /\{\{([\s\S]*?)\}\}|\[\[([\s\S]*?)\]\]/g

const tokens = computed<Token[]>(() => {
  const out: Token[] = []
  let last = 0
  for (const m of props.text.matchAll(TOKEN_RE)) {
    const at = m.index ?? 0
    if (at > last) out.push({ t: 'text', v: props.text.slice(last, at) })
    if (m[1] !== undefined) out.push({ t: 'hl', v: m[1] })
    else out.push({ t: 'kw', v: m[2] ?? '' })
    last = at + m[0].length
  }
  if (last < props.text.length) out.push({ t: 'text', v: props.text.slice(last) })
  return out
})

const db = useDb()
const openKw = ref<string | null>(null)
const openDesc = computed(() => (openKw.value ? (db.keywordByName.get(openKw.value)?.desc ?? '') : ''))

const toggle = (name: string) => (openKw.value = openKw.value === name ? null : name)
</script>

<template>
  <span class="whitespace-pre-line">
    <template v-for="(tk, i) in tokens" :key="i">
      <template v-if="tk.t === 'text'">{{ tk.v }}</template>
      <span v-else-if="tk.t === 'hl'" class="font-medium text-accent">{{ tk.v }}</span>
      <button
        v-else-if="interactive && db.keywordByName.has(tk.v)"
        type="button"
        class="font-medium text-text underline decoration-dotted decoration-1 underline-offset-4"
        :aria-expanded="openKw === tk.v"
        @click.stop="toggle(tk.v)"
      >{{ tk.v }}</button>
      <span v-else class="font-medium text-text">{{ tk.v }}</span>
    </template>
  </span>
  <span v-if="interactive && openKw" class="mt-2 block rounded-lg bg-surface-3 px-3 py-2 text-[13px] leading-relaxed" role="note">
    <span class="font-medium text-text">{{ openKw }}：</span>
    <RichText :text="openDesc" :interactive="false" />
  </span>
</template>
