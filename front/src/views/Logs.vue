<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/logs/operation', label: '操作日志' },
  { path: '/logs/login', label: '登录日志' },
  { path: '/logs/error', label: '错误日志' },
]

const currentTitle = computed(() => {
  if (route.path === '/logs/login') return '登录日志'
  if (route.path === '/logs/error') return '错误日志'
  return '操作日志'
})

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
          <div class="vs-ref-side-head">全站日志</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>全站日志</span>
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
          <div class="vs-ref-main-body">
            <router-view />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
