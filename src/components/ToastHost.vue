<script setup lang="ts">
import { toast } from '@/composables/toast'
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-8" aria-live="polite">
    <Transition name="toast">
      <div v-if="toast" :key="toast.id" class="max-w-md rounded-xl bg-text px-4 py-2.5 text-center text-sm text-bg shadow-xl">
        {{ toast.text }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
