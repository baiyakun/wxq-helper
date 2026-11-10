import { computed } from 'vue'
import { isRushRoom } from '@/data/rush'
import type { RushRoom } from '@/types/data'
import { usePersistentRef } from './usePersistentRef'

const stored = usePersistentRef<string>('rush:room', 'standard')

/** The 钻石狂潮 room the user plays in; shared by the pack ranking and the auction bid estimates. */
export const rushRoom = computed<RushRoom>({
  get: () => (isRushRoom(stored.value) ? stored.value : 'standard'),
  set: (v) => (stored.value = v),
})
