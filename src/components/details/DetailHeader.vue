<script setup lang="ts">
import CardIcon from '../CardIcon.vue'

defineProps<{ icon: string; name: string; ring?: string; round?: boolean }>()
</script>

<template>
  <div class="flex items-center gap-4">
    <CardIcon :src="icon" :name="name" :size="72" :ring="ring" :round="round" />
    <div class="min-w-0">
      <h2 class="text-xl font-semibold">{{ name }}</h2>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        <slot />
      </div>
    </div>
  </div>
</template>
