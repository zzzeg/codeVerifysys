<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/profile/dashboard', label: '数据看板' },
  { path: '/profile/info', label: '个人信息' },
  { path: '/profile/finance', label: '财务管理' },
]

const currentTitle = computed(() => menu.find((item) => route.path === item.path)?.label || '个人中心')
const isActive = (path: string) => route.path === path
const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <div class="vs-ref-split">
        <aside class="vs-ref-side">
          <div class="vs-ref-side-head">个人中心</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>个人中心</span>
              <i>/</i>
              <strong>{{ currentTitle }}</strong>
            </div>
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
          <div class="vs-ref-main-body profile-page-body">
            <router-view />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-page-body {
  overflow: auto;
}
</style>
