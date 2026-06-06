<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const menu = [
  { path: '/users/list', label: '用户列表' },
  { path: '/users/create', label: '新增用户' },
  { path: '/users/roles/list', label: '角色配置' },
]

const isActive = (path: string) => route.path === path
const currentSubTitle = computed(() => (route.path.startsWith('/users/roles') ? '角色配置' : '用户列表'))
const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}
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
            <h2 class="vs-ref-main-title">角色配置</h2>
          </div>
          <div class="vs-ref-main-body">
            <router-view />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
