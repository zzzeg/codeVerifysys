<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const currentTitle = computed(() => (route.path === '/codes/generate' ? '注册码生成' : '注册码管理'))
const actionLabel = computed(() => (route.path === '/codes/generate' ? '返回列表' : '注册码生成'))
const actionTarget = computed(() => (route.path === '/codes/generate' ? '/codes/list' : '/codes/generate'))
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
