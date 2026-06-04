<script setup lang="ts">
import { computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/auto-delivery/list', label: '商品列表' },
  { path: '/auto-delivery/orders', label: '已卖出的商品' },
  { path: '/auto-delivery/create', label: '商品添加' },
]

const isCreateRoute = computed(() => route.path === '/auto-delivery/create')
const isOrdersRoute = computed(() => route.path === '/auto-delivery/orders')
const isEditRoute = computed(() => route.path.startsWith('/auto-delivery/edit/'))
const hasMobileFilter = computed(() => route.path === '/auto-delivery/list' || route.path === '/auto-delivery/orders')

const currentTitle = computed(() => {
  if (isEditRoute.value) return '编辑商品'
  if (isCreateRoute.value) return '商品添加'
  if (isOrdersRoute.value) return '已卖出的商品'
  return '自动发卡'
})

const currentSubTitle = computed(() => {
  if (isEditRoute.value) return '编辑商品'
  if (isCreateRoute.value) return '商品添加'
  if (isOrdersRoute.value) return '已卖出的商品'
  return '商品列表'
})

const isActive = (path: string) => route.path === path

const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}

const openMobileFilter = () => {
  window.dispatchEvent(new CustomEvent('vs-open-auto-delivery-filter'))
}
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <div class="vs-ref-split">
        <aside class="vs-ref-side">
          <div class="vs-ref-side-head">自动发卡</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>自动发卡</span>
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
