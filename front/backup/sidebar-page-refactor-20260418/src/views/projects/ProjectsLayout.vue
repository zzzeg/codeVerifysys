<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const currentTitle = computed(() => (route.path === '/projects/create' ? '新建项目' : '项目管理'))
const actionLabel = computed(() => (route.path === '/projects/create' ? '返回列表' : '新建项目'))
const actionTarget = computed(() => (route.path === '/projects/create' ? '/projects/list' : '/projects/create'))
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <section class="vs-ref-main">
        <div class="vs-ref-main-head">
          <div class="head-row">
            <h2 class="vs-ref-main-title">{{ currentTitle }}</h2>
            <el-button type="primary" @click="router.push(actionTarget)">{{ actionLabel }}</el-button>
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
</style>
