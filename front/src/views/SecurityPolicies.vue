<script setup lang="ts">
import { computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/security-policies/list', label: '策略列表' },
  { path: '/security-policies/create', label: '新增策略' },
]

const currentTitle = computed(() => {
  if (route.path === '/security-policies/create') return '新增安全策略'
  if (route.path.startsWith('/security-policies/edit/')) return '编辑安全策略'
  return '安全策略管理'
})
const currentSubTitle = computed(() => {
  if (route.path === '/security-policies/create') return '新增策略'
  if (route.path.startsWith('/security-policies/edit/')) return '编辑策略'
  return '策略列表'
})
const hasMobileFilter = computed(() => route.path === '/security-policies/list')

const isActive = (path: string) => {
  if (path === '/security-policies/create') return route.path === path || route.path.startsWith('/security-policies/edit/')
  return route.path === path
}

const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}
const openMobileFilter = () => window.dispatchEvent(new CustomEvent('vs-open-mobile-filter'))
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <div class="vs-ref-split">
        <aside class="vs-ref-side">
          <div class="vs-ref-side-head">安全策略</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>安全策略</span>
              <i>/</i>
              <strong>{{ currentSubTitle }}</strong>
            </div>
            <button v-if="hasMobileFilter" type="button" class="mobile-side-action" @click="openMobileFilter">
              <el-icon><Search /></el-icon>
              筛选
            </button>
            <button
              v-for="item in menu"
              :key="item.path"
              type="button"
              class="vs-ref-side-link"
              :class="{ active: isActive(item.path) }"
              @click="navigateTo(item.path)"
            >
              &gt; {{ item.label }}
            </button>
          </div>
        </aside>

        <section class="vs-ref-main">
          <div class="vs-ref-main-head">
            <h2 class="vs-ref-main-title">{{ currentTitle }}</h2>
          </div>
          <div class="vs-ref-main-body">
            <router-view />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
