<script setup lang="ts">
import { computed } from 'vue'
import { campColor, tierColor } from '@/data/display'
import { useDb } from '@/data/store'
import Badge from '../Badge.vue'
import RichText from '../RichText.vue'
import DetailHeader from './DetailHeader.vue'
import DetailSection from './DetailSection.vue'

const props = defineProps<{ id: number }>()
const db = useDb()
const effect = computed(() => db.effectById.get(props.id))
</script>

<template>
  <div v-if="effect">
    <DetailHeader :icon="effect.icon" :name="effect.name" :ring="tierColor(effect.quality)">
      <Badge :color="tierColor(effect.quality)">{{ effect.quality }}阶</Badge>
      <Badge :color="campColor(effect.camp)">{{ effect.camp }}</Badge>
      <Badge v-if="effect.cost > 0" color="var(--accent)">{{ effect.cost }} 能量</Badge>
      <Badge v-if="effect.pack">{{ effect.pack }}</Badge>
    </DetailHeader>

    <DetailSection title="效果">
      <p class="text-[15px] leading-relaxed"><RichText :text="effect.desc" /></p>
    </DetailSection>
  </div>
  <p v-else class="py-10 text-center text-muted">没有找到这张效果牌</p>
</template>
