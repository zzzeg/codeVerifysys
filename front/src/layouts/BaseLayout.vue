<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  User as AvatarIcon,
  Collection,
  DataAnalysis,
  Document,
  Key,
  Lock,
  Menu,
  Promotion,
  ShoppingCart,
  SwitchButton,
  Tickets,
  UserFilled as User,
} from '@element-plus/icons-vue'
import { useAuthStore } from '../store/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const mobileMenuOpen = ref(false)

const primaryMenu = [
  { path: '/codes/list', basePath: '/codes', label: '注册码管理', icon: Tickets },
  { path: '/projects/list', basePath: '/projects', label: '项目管理', icon: Collection },
  { path: '/products/list', basePath: '/products', label: '商品管理', icon: ShoppingCart },
  { path: '/custom-data/list', basePath: '/custom-data', label: '自定义数据', icon: DataAnalysis },
  { path: '/security-policies/list', basePath: '/security-policies', label: '安全策略', icon: Lock },
  { path: '/auto-delivery', basePath: '/auto-delivery', label: '自动发卡', icon: Promotion },
]

const manageMenu = [
  { path: '/users', basePath: '/users', label: '用户管理', icon: User },
  { path: '/roles', basePath: '/roles', label: '角色管理', icon: Key },
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
        <div class="brand" @click="navigateTo('/codes/list')">
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
          <el-dropdown trigger="click">
            <span class="user-badge">
              <el-icon :size="16"><AvatarIcon /></el-icon>
              <span>{{ currentUsername }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="navigateTo('/profile')">
                  <el-icon><AvatarIcon /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item
                  v-for="item in manageMenu"
                  :key="item.path"
                  @click="navigateTo(item.path)"
                >
                  <el-icon><component :is="item.icon" /></el-icon>
                  {{ item.label }}
                </el-dropdown-item>
				<el-dropdown-item divided @click="handleLogout" class="reditems">
				  <el-icon><SwitchButton /></el-icon>
				  退出登录
				</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

         <!-- <button type="button" class="logout-button" @click="handleLogout" aria-label="退出登录">
            <el-icon><SwitchButton /></el-icon>
          </button> -->
		  
		  <!-- <el-button @click="handleLogout" aria-label="退出登录" size="small" type="danger" circle class="logout-button">
			  <el-icon><SwitchButton /></el-icon>
		  </el-button> -->
		  

          <button type="button" class="mobile-toggle" @click="mobileMenuOpen = !mobileMenuOpen">
            <el-icon><Menu /></el-icon>
          </button>
        </div>
      </div>

      <div v-if="mobileMenuOpen" class="mobile-panel">
        <div class="mobile-links">
          <button
            v-for="item in [...primaryMenu, ...manageMenu]"
            :key="item.basePath"
            type="button"
            class="mobile-link"
            :class="{ active: isActive(item.path, item.basePath) }"
            @click="navigateTo(item.path)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
          <button type="button" class="mobile-link" :class="{ active: route.path === '/profile' }" @click="navigateTo('/profile')">
            <el-icon><AvatarIcon /></el-icon>
            <span>个人中心</span>
          </button>
          <button type="button" class="mobile-link danger" @click="handleLogout">
            <el-icon><SwitchButton /></el-icon>
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
  height: 100vh;
  min-height: 100vh;
  background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
  overflow: hidden;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.86);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

.topbar-inner {
  max-width: 1400px;
  margin: 0 auto;
  min-height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 32px;
  min-width: 220px;
  cursor: pointer;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #409eff 0%, #2f7eea 100%);
  box-shadow: 0 10px 18px rgba(64, 158, 255, 0.3);
}

.brand-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.brand-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}

.desktop-nav {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.nav-link {
  border: none;
  background: transparent;
  color: #606266;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.nav-link:hover {
  background: #f3f4f6;
  color: #4b5563;
}

.nav-link.active {
  color: #fff;
  background: linear-gradient(90deg, #409eff 0%, #2f7eea 100%);
  box-shadow: 0 10px 18px rgba(64, 158, 255, 0.3);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-right:5px;
}

.user-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 16px;
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.92);
  color: #222;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
  box-shadow: 0 0px 5px rgba(000,000,000,.04);
}

.user-badge:hover {
  background: rgba(243,244,246,1);
  //color: #dc2626;
}

.mobile-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #303133;
}

.logout-button {
  
  //background: linear-gradient(135deg, #f56c6c 0%, #eb5252 100%);
 
  box-shadow: 0 2px 10px rgba(245, 108, 108, .6) !important;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.logout-button:hover {
  background: linear-gradient(135deg, #fb7d7d 0%, #f16060 100%);
  box-shadow: 0 14px 22px rgba(245, 108, 108, 0.3);
  transform: translateY(-1px);
}

.page-shell {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 20px 24px;
  height: calc(100vh - 64px);
}

.content-shell {
  height: 100%;
  min-height: 0;
}

.mobile-panel,
.mobile-bottom-nav {
  display: none;
}

:deep(.reditems.el-dropdown-menu__item){
	color:var(--el-color-danger); font-weight: bold;
}

@media (max-width: 1024px) {
  .desktop-nav,
  .toolbar :deep(.el-dropdown) {
    display: none;
  }

  .mobile-toggle {
    display: inline-grid;
    place-items: center;
  }

  .page-shell {
    padding: 16px 16px 88px;
  }

  .mobile-panel {
    display: block;
    border-top: 1px solid #e4e7ed;
    background: #fff;
    padding: 8px 16px 12px;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  }

  .mobile-links {
    display: grid;
    gap: 8px;
  }

  .mobile-link {
    border: none;
    background: transparent;
    border-radius: 10px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    color: #606266;
    font-size: 14px;
    font-weight: 500;
  }

  .mobile-link.active {
    color: #fff;
    background: linear-gradient(90deg, #409eff 0%, #2f7eea 100%);
    box-shadow: 0 10px 18px rgba(64, 158, 255, 0.3);
  }

  .mobile-link.danger {
    justify-content: center;
    border: 1px solid rgba(229, 231, 235, 0.8);
    border-radius: 12px;
    margin-top: 8px;
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
    border-top: 1px solid #e4e7ed;
    background: rgba(255, 255, 255, 0.86);
  }

  .mobile-bottom-link {
    border: none;
    background: transparent;
    border-radius: 10px;
    padding: 8px 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: #606266;
    font-size: 11px;
    font-weight: 500;
  }

  .mobile-bottom-link.active {
    color: #409eff;
  }

  .mobile-bottom-link.active :deep(svg) {
    stroke-width: 2.5;
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
