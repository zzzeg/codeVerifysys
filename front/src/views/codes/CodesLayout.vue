<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const currentTitle = computed(() => (route.path === '/codes/generate' ? '注册码生成' : '注册码管理'))
const actionLabel = computed(() => (route.path === '/codes/generate' ? '返回列表' : '注册码生成'))
const mobileActionLabel = computed(() => (route.path === '/codes/generate' ? '返回' : '生成'))
const actionTarget = computed(() => (route.path === '/codes/generate' ? '/codes/list' : '/codes/generate'))

const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <section class="vs-ref-main">
        <div class="vs-ref-main-head">
          <div class="head-row">
            <h2 class="vs-ref-main-title">{{ currentTitle }}</h2>
            <el-button type="primary" class="head-action" @click="navigateTo(actionTarget)">
              <span class="desktop-label">{{ actionLabel }}</span>
              <span class="mobile-label">{{ mobileActionLabel }}</span>
            </el-button>
          </div>
        </div>
        <div class="vs-ref-main-body">
          <router-view />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.mobile-label {
  display: none;
}

@media (max-width: 768px) {
  .head-row {
    min-height: 34px;
    gap: 8px;
  }

  .head-action {
    min-height: 32px;
    padding: 6px 14px;
    border-radius: 10px;
  }

  .desktop-label {
    display: none;
  }

  .mobile-label {
    display: inline;
  }
}
</style>
