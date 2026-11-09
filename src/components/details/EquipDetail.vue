<script setup lang="ts">
import { computed } from 'vue'
import { useDetail } from '@/composables/useDetail'
import { equipColor } from '@/data/display'
import { useDb } from '@/data/store'
import Badge from '../Badge.vue'
import CardLink from '../CardLink.vue'
import CardRow from '../CardRow.vue'
import RichText from '../RichText.vue'
import DetailHeader from './DetailHeader.vue'
import DetailSection from './DetailSection.vue'

const props = defineProps<{ id: number }>()
const db = useDb()
const { open } = useDetail()
const equip = computed(() => db.equipById.get(props.id))
const forgesInto = computed(() => (equip.value?.to ?? []).map((id) => db.equipById.get(id)).filter((e) => e !== undefined))
</script>

<template>
  <div v-if="equip">
    <DetailHeader :icon="equip.icon" :name="equip.name" :ring="equipColor(equip.sub)">
      <Badge :color="equipColor(equip.sub)">{{ equip.sub }}</Badge>
      <Badge>{{ equip.kind }}</Badge>
    </DetailHeader>

    <DetailSection title="效果">
      <p class="text-[15px] leading-relaxed"><RichText :text="equip.desc" /></p>
    </DetailSection>

    <DetailSection v-if="equip.from.length" title="由以下基础装备铸造">
      <div class="flex flex-wrap gap-2">
        <CardLink v-for="id in equip.from" :key="id" kind="equip" :id="id" />
      </div>
    </DetailSection>

    <DetailSection v-if="forgesInto.length" :title="`可铸造为（${forgesInto.length} 选 1）`">
      <div class="-mx-2">
        <CardRow
          v-for="e in forgesInto"
          :key="e.id"
          :icon="e.icon"
          :name="e.name"
          :ring="equipColor(e.sub)"
          :desc="e.desc"
          @select="open('equip', e.id)"
        >
          <template #badges><Badge>{{ e.kind }}</Badge></template>
        </CardRow>
      </div>
    </DetailSection>
  </div>
  <p v-else class="py-10 text-center text-muted">没有找到这件装备</p>
</template>
