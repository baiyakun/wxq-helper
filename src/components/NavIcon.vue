<script setup lang="ts">
import { ICON_PATHS, type IconName } from './ui'

withDefaults(defineProps<{ name: IconName; size?: number; filled?: boolean }>(), { size: 22, filled: false })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="ICON_PATHS[name]" />
  </svg>
</template>
