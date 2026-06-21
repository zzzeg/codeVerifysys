import { computed, onBeforeUnmount, ref } from 'vue'

const MOBILE_QUERY = '(max-width: 720px)'
const MOBILE_PAGER_COUNT = 5
const DESKTOP_PAGER_COUNT = 7

/**
 * 获取全站分页显示配置
 *
 * @param 无
 * @returns 返回响应式分页按钮数量配置
 */
export function usePaginationConfig() {
  const isMobile = ref(false)
  const mediaQuery = typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY) : null

  /**
   * 同步当前视口对应的分页按钮数量
   *
   * @param 无
   * @returns 无
   */
  const syncViewport = () => {
    isMobile.value = Boolean(mediaQuery?.matches)
  }

  syncViewport()
  mediaQuery?.addEventListener('change', syncViewport)

  onBeforeUnmount(() => {
    mediaQuery?.removeEventListener('change', syncViewport)
  })

  return {
    paginationPagerCount: computed(() => (isMobile.value ? MOBILE_PAGER_COUNT : DESKTOP_PAGER_COUNT)),
  }
}
