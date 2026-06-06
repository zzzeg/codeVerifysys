<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/users/settlements', label: '结算管理' },
  { path: '/notifications/publish', label: '发布通知' },
  { path: '/logs/operation', label: '操作日志' },
  { path: '/logs/login', label: '登录日志' },
  { path: '/logs/error', label: '错误日志' },
]

const currentTitle = computed(() => {
  if (route.path === '/logs/login') return '登录日志'
  if (route.path === '/logs/error') return '错误日志'
  if (route.path === '/users/settlements') return '结算管理'
  if (route.path === '/notifications/publish') return '发布通知'
  return '操作日志'
})

/**
 * 判断系统管理菜单是否处于选中状态
 * @param path 菜单对应的目标路径
 * @returns 返回当前路由是否匹配目标路径
 */
const isActive = (path: string) => route.path === path

/**
 * 跳转到系统管理二级菜单页面
 * @param path 目标页面路径
 * @returns 无返回值，仅在路径变化时触发路由跳转
 */
const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <div class="vs-ref-split">
        <aside class="vs-ref-side">
          <div class="vs-ref-side-head">系统管理</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>系统管理</span>
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
