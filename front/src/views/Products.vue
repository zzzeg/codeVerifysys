<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const hasMobileFilter = ref(false)

const menu = [
  { path: '/products/list', label: '商品列表' },
  { path: '/products/create', label: '新增商品' },
]

const currentTitle = computed(() => {
  if (route.path === '/products/create') return '新增商品'
  if (route.path.startsWith('/products/edit/')) return '编辑商品'
  return '商品管理'
})
const currentSubTitle = computed(() => {
  if (route.path === '/products/create') return '新增商品'
  if (route.path.startsWith('/products/edit/')) return '编辑商品'
  return '商品列表'
})

const isActive = (path: string) => {
  if (path === '/products/create') return route.path === path || route.path.startsWith('/products/edit/')
  return route.path === path
}

const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}
const openMobileFilter = () => window.dispatchEvent(new CustomEvent('vs-open-mobile-filter'))
const updateMobileFilterState = (event: Event) => {
  hasMobileFilter.value = Boolean((event as CustomEvent).detail?.visible)
}

onMounted(() => {
  window.addEventListener('vs-mobile-filter-state', updateMobileFilterState)
})

onBeforeUnmount(() => {
  window.removeEventListener('vs-mobile-filter-state', updateMobileFilterState)
})
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <div class="vs-ref-split">
        <aside class="vs-ref-side">
          <div class="vs-ref-side-head">商品管理</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>商品管理</span>
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
