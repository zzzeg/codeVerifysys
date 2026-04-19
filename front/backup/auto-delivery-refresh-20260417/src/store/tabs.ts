import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface TabItem {
  title: string
  path: string
  hover: boolean
}

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<TabItem[]>([{ title: '首页', path: '/dashboard', hover: false }])
  const active = ref('/dashboard')

  const addTab = (tab: TabItem) => {
    if (!tabs.value.find((t) => t.path === tab.path)) {
      tabs.value.push(tab)
    }
    active.value = tab.path
  }

  const removeTab = (path: string) => {
    const idx = tabs.value.findIndex((t) => t.path === path)
    if (idx > -1) {
      tabs.value.splice(idx, 1)
      if (active.value === path) {
        const next = tabs.value[idx - 1] || tabs.value[0]
        active.value = next?.path || '/dashboard'
      }
    }
  }

  return { tabs, active, addTab, removeTab }
})
