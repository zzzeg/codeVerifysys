<script setup lang="ts">
import { computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/users/list', label: '用户列表' },
  { path: '/users/create', label: '新增用户' },
  { path: '/users/roles/list', label: '角色配置' },
]

const currentTitle = computed(() => {
  if (route.path === '/users/create') return '新增用户'
  if (route.path.startsWith('/users/edit/')) return '编辑用户'
  if (route.path.startsWith('/users/roles')) return '角色配置'
  return '用户管理'
})
const currentSubTitle = computed(() => {
  if (route.path === '/users/create') return '新增用户'
  if (route.path.startsWith('/users/edit/')) return '编辑用户'
  if (route.path.startsWith('/users/roles')) return '角色配置'
  return '用户列表'
})
const hasMobileFilter = computed(() => route.path === '/users/list')

const isActive = (path: string) => route.path === path || (path === '/users/roles/list' && route.path.startsWith('/users/roles'))

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
          <div class="vs-ref-side-head">用户管理</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>用户管理</span>
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
            <router-view :key="route.fullPath" />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
