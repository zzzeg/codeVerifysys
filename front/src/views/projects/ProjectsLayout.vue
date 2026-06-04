<script setup lang="ts">
import { computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/projects/list', label: '项目列表' },
  { path: '/projects/create', label: '新建项目' },
]

const isCreateRoute = computed(() => route.path === '/projects/create')
const isEditRoute = computed(() => route.path.startsWith('/projects/edit/'))
const currentTitle = computed(() => {
  if (isCreateRoute.value) return '新建项目'
  if (isEditRoute.value) return '编辑项目'
  return '项目管理'
})
const currentSubTitle = computed(() => {
  if (isCreateRoute.value) return '新建项目'
  if (isEditRoute.value) return '编辑项目'
  return '项目列表'
})
const hasMobileFilter = computed(() => route.path === '/projects/list')
const isActive = (path: string) => route.path === path
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
          <div class="vs-ref-side-head">项目管理</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>项目管理</span>
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
