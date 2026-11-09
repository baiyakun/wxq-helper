import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

type ElementRef = Readonly<Ref<HTMLElement | null>>

/**
 * Render a long list `page` items at a time; the next page is added when the sentinel
 * element (e.g. from useTemplateRef) comes within 600px of the viewport.
 */
export function useIncremental<T>(list: Ref<T[]>, page: number, sentinel: ElementRef) {
  const limit = ref(page)
  const visible = computed(() => list.value.slice(0, limit.value))
  let observer: IntersectionObserver | null = null

  /** Re-observing makes the observer report the current state again (it only fires on changes). */
  function recheck() {
    // Read the element after the next render: it may only exist once the list shows up.
    requestAnimationFrame(() => {
      const el = sentinel.value
      if (!observer || !el) return
      observer.unobserve(el)
      observer.observe(el)
    })
  }

  function reset() {
    limit.value = page
    recheck()
  }

  onMounted(() => {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && limit.value < list.value.length) {
          limit.value += page
          recheck()
        }
      },
      { rootMargin: '600px' },
    )
    if (sentinel.value) observer.observe(sentinel.value)
  })
  onBeforeUnmount(() => observer?.disconnect())

  return { visible, reset }
}
