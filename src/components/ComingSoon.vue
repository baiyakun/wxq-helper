<script setup lang="ts">
defineProps<{ title: string; desc: string }>()
</script>

<template>
  <div class="mx-auto mt-10 max-w-sm rounded-2xl border border-dashed border-line p-8 text-center">
    <h2 class="text-lg font-semibold">{{ title }}</h2>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ desc }}</p>
    <RouterLink to="/codex" class="mt-5 inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-medium text-accent-ink">
      先去图鉴看看
    </RouterLink>
  </div>
</template>
