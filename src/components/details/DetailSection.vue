<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <section class="mt-5">
    <h3 class="mb-2 text-xs font-medium tracking-wider text-faint">{{ title }}</h3>
    <slot />
  </section>
</template>
