<script setup lang="ts">
import { computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/custom-data/list', label: '数据列表' },
  { path: '/custom-data/create', label: '新增数据' },
  { path: '/custom-data/help', label: '使用说明' },
]

const currentTitle = computed(() => {
  if (route.path === '/custom-data/create') return '新增自定义数据'
  if (route.path.startsWith('/custom-data/edit/')) return '编辑自定义数据'
  if (route.path === '/custom-data/help') return '使用说明'
  return '自定义数据'
})
const currentSubTitle = computed(() => {
  if (route.path === '/custom-data/create') return '新增数据'
  if (route.path.startsWith('/custom-data/edit/')) return '编辑数据'
  if (route.path === '/custom-data/help') return '使用说明'
  return '数据列表'
})
const hasMobileFilter = computed(() => route.path === '/custom-data/list')

const isActive = (path: string) => {
  if (path === '/custom-data/create') return route.path === path || route.path.startsWith('/custom-data/edit/')
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
          <div class="vs-ref-side-head">自定义数据</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>自定义数据</span>
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
