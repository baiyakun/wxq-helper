<script setup lang="ts">
import CardIcon from './CardIcon.vue'
import RichText from './RichText.vue'

defineProps<{ icon: string; name: string; ring?: string; desc?: string }>()
defineEmits<{ select: [] }>()
</script>

<template>
  <button
    type="button"
    class="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2 active:bg-surface-3"
    @click="$emit('select')"
  >
    <CardIcon :src="icon" :name="name" :size="44" :ring="ring" />
    <span class="min-w-0 flex-1">
      <span class="flex flex-wrap items-center gap-1.5">
        <span class="font-medium">{{ name }}</span>
        <slot name="badges" />
      </span>
      <span v-if="desc" class="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">
        <RichText :text="desc" :interactive="false" />
      </span>
    </span>
  </button>
</template>
