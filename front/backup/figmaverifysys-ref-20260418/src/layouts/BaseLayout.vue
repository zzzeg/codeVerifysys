<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Avatar as AvatarIcon,
  Collection,
  DataAnalysis,
  Document,
  Key,
  Lock,
  Menu,
  ShoppingCart,
  Tickets,
  User,
} from '@element-plus/icons-vue'
import { useAuthStore } from '../store/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const mobileMenuOpen = ref(false)

const primaryMenu = [
  { path: '/users', basePath: '/users', label: '用户管理', icon: User },
  { path: '/roles', basePath: '/roles', label: '角色管理', icon: Key },
  { path: '/projects/list', basePath: '/projects', label: '项目管理', icon: Collection },
  { path: '/codes/list', basePath: '/codes', label: '注册码管理', icon: Tickets },
  { path: '/products', basePath: '/products', label: '商品管理', icon: ShoppingCart },
  { path: '/custom-data', basePath: '/custom-data', label: '自定义数据', icon: DataAnalysis },
  { path: '/security-policies', basePath: '/security-policies', label: '安全策略', icon: Lock },
  { path: '/logs', basePath: '/logs', label: '系统日志', icon: Document },
]

const isActive = (path: string, basePath?: string) => {
  if (route.path === path) return true
  return basePath ? route.path === basePath || route.path.startsWith(`${basePath}/`) : false
}

const currentUsername = computed(() => auth.currentUser?.username || '管理员')

const navigateTo = (path: string) => {
  mobileMenuOpen.value = false
  if (route.path !== path) {
    router.push(path)
  }
}

const handleLogout = () => {
  auth.logout()
  mobileMenuOpen.value = false
  router.push('/login')
}

onMounted(() => {
  auth.fetchProfile().catch(() => undefined)
})
</script>

<template>
  <div class="layout-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand" @click="navigateTo('/users')">
          <div class="brand-mark">V</div>
          <div class="brand-copy">
            <div class="brand-title">VerifySys</div>
            <div class="brand-subtitle">License Workspace</div>
          </div>
        </div>

        <nav class="desktop-nav">
          <button
            v-for="item in primaryMenu"
            :key="item.basePath"
            type="button"
            class="nav-link"
            :class="{ active: isActive(item.path, item.basePath) }"
            @click="navigateTo(item.path)"
          >
            {{ item.label }}
          </button>
        </nav>

        <div class="toolbar">
          <div class="user-menu">
            <button type="button" class="user-badge">
              <el-icon><AvatarIcon /></el-icon>
              <span>{{ currentUsername }}</span>
            </button>
            <div class="user-dropdown">
              <button type="button" class="user-dropdown-link" @click="navigateTo('/profile')">
                个人中心
              </button>
              <button type="button" class="user-dropdown-link danger" @click="handleLogout">
                退出登录
              </button>
            </div>
          </div>
          <button type="button" class="mobile-toggle" @click="mobileMenuOpen = !mobileMenuOpen">
            <el-icon><Menu /></el-icon>
          </button>
        </div>
      </div>

      <div v-if="mobileMenuOpen" class="mobile-panel">
        <div class="mobile-links">
          <button
            v-for="item in primaryMenu"
            :key="item.basePath"
            type="button"
            class="mobile-link"
            :class="{ active: isActive(item.path, item.basePath) }"
            @click="navigateTo(item.path)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
        </div>

        <div class="mobile-account">
          <button type="button" class="mobile-link" :class="{ active: route.path === '/profile' }" @click="navigateTo('/profile')">
            <el-icon><AvatarIcon /></el-icon>
            <span>个人中心</span>
          </button>
          <button type="button" class="mobile-link danger" @click="handleLogout">
            <span>退出登录</span>
          </button>
        </div>
      </div>
    </header>

    <main class="page-shell">
      <section class="content-shell">
        <router-view />
      </section>
    </main>

    <nav class="mobile-bottom-nav">
      <button
        v-for="item in primaryMenu.slice(0, 4)"
        :key="item.basePath"
        type="button"
        class="mobile-bottom-link"
        :class="{ active: isActive(item.path, item.basePath) }"
        @click="navigateTo(item.path)"
      >
        <el-icon><component :is="item.icon" /></el-icon>
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped lang="scss">
.layout-shell {
  min-height: 100vh;
  background: transparent;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(18px);
  background: rgba(255, 255, 255, 0.7);
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.topbar-inner {
  max-width: 1280px;
  margin: 0 auto;
  min-height: 72px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
  cursor: pointer;
}

.brand-mark {
  width: 40px;
  height: 40px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #2f6bff, #38bdf8);
  box-shadow: 0 14px 26px rgba(47, 107, 255, 0.26);
}

.brand-title {
  font-size: 17px;
  font-weight: 800;
  color: #172033;
}

.brand-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #7a8aa2;
}

.desktop-nav {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 0;
}

.desktop-nav::-webkit-scrollbar {
  display: none;
}

.nav-link {
  border: none;
  background: transparent;
  color: #5f6f86;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition: background-color 0.18s ease, color 0.18s ease;
}

.nav-link:hover {
  background: rgba(148, 163, 184, 0.12);
  color: #172033;
}

.nav-link.active {
  color: #fff;
  background: linear-gradient(135deg, #2f6bff, #1748cf);
  box-shadow: 0 12px 22px rgba(47, 107, 255, 0.22);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-menu {
  position: relative;
}

.user-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: #506176;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  min-width: 148px;
  padding: 8px;
  display: grid;
  gap: 6px;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 18px 34px rgba(15, 23, 42, 0.12);
  opacity: 0;
  pointer-events: none;
  transform: translateY(6px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.user-menu:hover .user-dropdown,
.user-menu:focus-within .user-dropdown {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}

.user-dropdown-link {
  width: 100%;
  border: none;
  background: rgba(248, 250, 252, 0.92);
  color: #506176;
  padding: 10px 12px;
  border-radius: 12px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.user-dropdown-link:hover {
  background: rgba(47, 107, 255, 0.08);
  color: #1748cf;
}

.user-dropdown-link.danger:hover {
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
}

.mobile-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.88);
  color: #172033;
}

.page-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px 24px 32px;
}

.content-shell {
  //min-height: calc(100vh - 120px);
  min-height:100%;
}

.mobile-panel {
  display: none;
}

.mobile-bottom-nav {
  display: none;
}

.mobile-account {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.mobile-link.danger {
  justify-content: center;
}

@media (max-width: 1024px) {
  .topbar-inner {
    padding: 0 18px;
    min-height: 64px;
  }

  .page-shell {
    padding: 18px 18px 88px;
  }

  .desktop-nav,
  .user-menu {
    display: none;
  }

  .mobile-toggle {
    display: inline-grid;
    place-items: center;
  }

  .mobile-panel {
    display: block;
    border-top: 1px solid rgba(226, 232, 240, 0.8);
    background: rgba(255, 255, 255, 0.92);
    padding: 12px 18px 16px;
  }

  .mobile-links {
    display: grid;
    gap: 8px;
  }

  .mobile-link {
    border: none;
    background: #fff;
    border-radius: 14px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #506176;
    font-size: 14px;
    font-weight: 600;
  }

  .mobile-link.active {
    color: #1748cf;
    background: rgba(47, 107, 255, 0.08);
    border-color: rgba(47, 107, 255, 0.2);
  }

  .mobile-bottom-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(226, 232, 240, 0.9);
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(18px);
  }

  .mobile-bottom-link {
    border: none;
    background: transparent;
    border-radius: 14px;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: #607089;
    font-size: 11px;
    font-weight: 600;
  }

  .mobile-bottom-link.active {
    color: #1748cf;
    background: rgba(47, 107, 255, 0.08);
  }
}

@media (max-width: 640px) {
  .brand {
    min-width: auto;
  }

  .brand-copy {
    display: none;
  }
}
</style>
