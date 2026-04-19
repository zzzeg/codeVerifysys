<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const currentTitle = computed(() => (route.name === 'projects-create' ? '新建项目' : '项目管理'))

const sideItems = [
  { label: '项目列表', path: '/projects/list', names: ['projects-list'] },
  { label: '新建项目', path: '/projects/create', names: ['projects-create'] },
]

const isActive = (names: string[]) => names.includes(String(route.name || ''))

const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame auto-frame">
      <aside class="auto-side">
        <div class="auto-side-head">项目管理</div>
        <div class="auto-side-body">
          <button
            v-for="item in sideItems"
            :key="item.path"
            type="button"
            class="auto-side-link"
            :class="{ active: isActive(item.names) }"
            @click="navigateTo(item.path)"
          >
            > {{ item.label }}
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
</template>

<style scoped>
.auto-frame {
  display: flex;
  min-height: 0;
  flex-direction: row;
}

.auto-side {
  width: 224px;
  border-right: 1px solid var(--vs-border);
  background: rgba(255, 255, 255, 0.78);
}

.auto-side-head {
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(90deg, var(--vs-primary) 0%, var(--vs-primary-strong) 100%);
}

.auto-side-body {
  padding: 8px;
}

.auto-side-link {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 14px;
  color: #4b5563;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.auto-side-link:hover {
  background: rgba(249, 250, 251, 0.9);
}

.auto-side-link.active {
  background: rgba(243, 244, 246, 0.96);
  color: #111827;
}

@media (max-width: 980px) {
  .auto-frame {
    flex-direction: column;
  }

  .auto-side {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--vs-border);
  }
}
</style>
