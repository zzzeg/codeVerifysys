<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Collection,
  DataAnalysis,
  Document,
  Key,
  Lock,
  Message,
  Menu,
  ArrowDown,
  ArrowRight,
  Promotion,
  SetUp,
  SwitchButton,
  Tickets,
  User as AvatarIcon,
  UserFilled,
} from '@element-plus/icons-vue'
import { useAuthStore } from '../store/auth'

interface NavItem {
  path: string
  basePath: string
  label: string
  icon: any
  adminOnly?: boolean
  permissions?: string[]
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const mobileMenuOpen = ref(false)
const expandedMobileBasePath = ref('')

const currentUsername = computed(() => auth.currentUser?.username || '管理员')
const currentRoles = computed(() => auth.currentUser?.roles || [])
const currentPermissions = computed(() => auth.currentUser?.permissions || [])
const isSuperAdmin = computed(
  () => currentRoles.value.includes('role-admin') || currentPermissions.value.includes('*') || currentUsername.value === 'admin',
)
const hasAccess = (permissions?: string[]) => {
  if (!permissions?.length) return true
  if (isSuperAdmin.value) return true
  return permissions.some((permission) => currentPermissions.value.includes(permission))
}

const allPrimaryMenu: NavItem[] = [
  { path: '/codes/list', basePath: '/codes', label: '注册码管理', icon: Tickets, permissions: ['codes'] },
  { path: '/projects/list', basePath: '/projects', label: '项目管理', icon: Collection, permissions: ['projects'] },
  { path: '/custom-data/list', basePath: '/custom-data', label: '自定义数据', icon: DataAnalysis, permissions: ['custom-data'] },
  { path: '/security-policies/list', basePath: '/security-policies', label: '安全策略', icon: Lock, permissions: ['security-policies'] },
  { path: '/auto-delivery/list', basePath: '/auto-delivery', label: '自动发卡', icon: Promotion, permissions: ['auto-delivery'] },
]
const primaryMenu = computed(() => allPrimaryMenu.filter((item) => hasAccess(item.permissions)))

const secondaryMenuMap: Record<string, NavItem[]> = {
  '/projects': [
    { path: '/projects/list', basePath: '/projects/list', label: '项目列表', icon: Collection },
    { path: '/projects/create', basePath: '/projects/create', label: '新建项目', icon: Collection },
  ],
  '/codes': [
    { path: '/codes/list', basePath: '/codes/list', label: '注册码列表', icon: Tickets },
    { path: '/codes/generate', basePath: '/codes/generate', label: '注册码生成', icon: Tickets },
  ],
  '/custom-data': [
    { path: '/custom-data/list', basePath: '/custom-data/list', label: '数据列表', icon: DataAnalysis },
    { path: '/custom-data/create', basePath: '/custom-data/create', label: '新增数据', icon: DataAnalysis },
    { path: '/custom-data/help', basePath: '/custom-data/help', label: '使用说明', icon: DataAnalysis },
  ],
  '/security-policies': [
    { path: '/security-policies/list', basePath: '/security-policies/list', label: '策略列表', icon: Lock },
    { path: '/security-policies/create', basePath: '/security-policies/create', label: '新增策略', icon: Lock },
  ],
  '/auto-delivery': [
    { path: '/auto-delivery/list', basePath: '/auto-delivery/list', label: '商品列表', icon: Promotion },
    { path: '/auto-delivery/create', basePath: '/auto-delivery/create', label: '商品添加', icon: Promotion },
  ],
  '/users': [
    { path: '/users/list', basePath: '/users/list', label: '用户列表', icon: UserFilled },
    { path: '/users/create', basePath: '/users/create', label: '新增用户', icon: UserFilled },
  ],
  '/logs': [
    { path: '/logs/operation', basePath: '/logs/operation', label: '操作日志', icon: Document },
    { path: '/logs/login', basePath: '/logs/login', label: '登录日志', icon: Document },
    { path: '/logs/error', basePath: '/logs/error', label: '错误日志', icon: Document },
  ],
}

const manageMenu = computed<NavItem[]>(() => {
  if (!isSuperAdmin.value) return []

  return [
    { path: '/users/list', basePath: '/users', label: '用户管理', icon: UserFilled, adminOnly: true },
    { path: '/roles/list', basePath: '/roles', label: '角色配置', icon: Key, adminOnly: true },
    { path: '/settlements', basePath: '/settlements', label: '结算管理', icon: SetUp, adminOnly: true },
    { path: '/logs/operation', basePath: '/logs', label: '全站日志', icon: Document, adminOnly: true },
  ]
})

const mobileMenu = computed(() => [...primaryMenu.value, ...manageMenu.value])
const activeMobileBasePath = computed(() => mobileMenu.value.find((item) => isActive(item.path, item.basePath))?.basePath || '')
const getSecondaryMenu = (item: NavItem) =>
  expandedMobileBasePath.value === item.basePath ? secondaryMenuMap[item.basePath] || [] : []

const isActive = (path: string, basePath?: string) => {
  if (route.path === path) return true
  return basePath ? route.path === basePath || route.path.startsWith(`${basePath}/`) : false
}

const navigateTo = (path: string) => {
  mobileMenuOpen.value = false
  if (route.path !== path) router.push(path)
}

const handleMobilePrimaryClick = (item: NavItem) => {
  const children = secondaryMenuMap[item.basePath] || []
  if (!children.length) {
    navigateTo(item.path)
    return
  }

  expandedMobileBasePath.value = expandedMobileBasePath.value === item.basePath ? '' : item.basePath
}

const handleLogout = () => {
  auth.logout()
  mobileMenuOpen.value = false
  router.push('/login')
}

watch(
  () => route.fullPath,
  () => {
    expandedMobileBasePath.value = activeMobileBasePath.value
    mobileMenuOpen.value = false
  },
  { immediate: true },
)
</script>

<template>
  <div class="layout-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand" @click="navigateTo('/codes/list')">
          <div class="brand-mark">
            <img src="/favicon-verify-v.svg?v=20260603-edge" alt="VerifySys" />
          </div>
          <div class="brand-copy">
            <div class="brand-title">VerifySys</div>
            <div class="brand-subtitle">License Workspace</div>
          </div>
        </div>

        <nav class="desktop-nav">
          <button v-for="item in primaryMenu" :key="item.basePath" type="button" class="nav-link"
            :class="{ active: isActive(item.path, item.basePath) }" @click="navigateTo(item.path)">
            {{ item.label }}
          </button>
        </nav>

        <div class="toolbar">
          <el-dropdown trigger="click">
            <span class="user-badge">
              <el-icon :size="16">
                <AvatarIcon />
              </el-icon>
              <span>{{ currentUsername }}</span>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="navigateTo('/profile/dashboard')">
                  <el-icon>
                    <AvatarIcon />
                  </el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item @click="navigateTo('/notifications')">
                  <el-icon>
                    <Message />
                  </el-icon>
                  通知中心
                </el-dropdown-item>
                <el-dropdown-item v-for="item in manageMenu" :key="item.path" @click="navigateTo(item.path)">
                  <el-icon>
                    <component :is="item.icon" />
                  </el-icon>
                  {{ item.label }}
                </el-dropdown-item>
                <el-dropdown-item divided class="danger-item" @click="handleLogout">
                  <el-icon>
                    <SwitchButton />
                  </el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <button type="button" class="mobile-toggle" @click="mobileMenuOpen = !mobileMenuOpen">
            <el-icon>
              <Menu />
            </el-icon>
          </button>
        </div>
      </div>

    </header>

    <div v-if="mobileMenuOpen" class="mobile-panel-mask" @click="mobileMenuOpen = false" />
    <div v-if="mobileMenuOpen" class="mobile-panel">
      <div class="mobile-links">
        <template v-for="item in mobileMenu" :key="item.basePath">
          <button type="button" class="mobile-link"
            :class="{ active: isActive(item.path, item.basePath), expanded: expandedMobileBasePath === item.basePath }"
            @click="handleMobilePrimaryClick(item)">
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
            <el-icon v-if="secondaryMenuMap[item.basePath]?.length" class="mobile-link-arrow">
              <component :is="expandedMobileBasePath === item.basePath ? ArrowDown : ArrowRight" />
            </el-icon>
          </button>
          <div v-if="getSecondaryMenu(item).length" class="mobile-sub-links">
            <button v-for="subItem in getSecondaryMenu(item)" :key="subItem.path" type="button"
              class="mobile-link secondary" :class="{ active: isActive(subItem.path, subItem.basePath) }"
              @click="navigateTo(subItem.path)">
              <el-icon>
                <component :is="subItem.icon" />
              </el-icon>
              <span>{{ subItem.label }}</span>
            </button>
          </div>
        </template>
        <button type="button" class="mobile-link" :class="{ active: route.path.startsWith('/profile') }"
          @click="navigateTo('/profile/dashboard')">
          <el-icon>
            <AvatarIcon />
          </el-icon>
          <span>个人中心</span>
        </button>
        <button type="button" class="mobile-link" :class="{ active: route.path === '/notifications' }"
          @click="navigateTo('/notifications')">
          <el-icon>
            <Message />
          </el-icon>
          <span>通知中心</span>
        </button>
        <button type="button" class="mobile-link danger" @click="handleLogout">
          <el-icon>
            <SwitchButton />
          </el-icon>
          <span>退出登录</span>
        </button>
      </div>
    </div>

    <main class="page-shell">
      <section class="content-shell">
        <router-view />
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.layout-shell {
  height: 100dvh;
  min-height: 100dvh;
  background:
    radial-gradient(circle at top left, rgba(64, 158, 255, 0.14), transparent 34%),
    radial-gradient(circle at top right, rgba(103, 194, 58, 0.1), transparent 26%),
    linear-gradient(180deg, #f7fbff 0%, #eef3fb 52%, #edf2f9 100%);
  overflow: hidden;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(255, 255, 255, 0.86);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(12px);
}

.topbar-inner {
  max-width: 1400px;
  min-height: 64px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 220px;
  margin-right: 32px;
  cursor: pointer;
  user-select: none;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  padding: 0;
  background: transparent;
  box-shadow: 0 10px 18px rgba(64, 158, 255, 0.3);
  overflow: hidden;
}

.brand-mark img {
  width: 100%;
  height: 100%;
  display: block;
}

.brand-title {
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  line-height: 20px;
}

.brand-subtitle {
  margin-top: 2px;
  color: #909399;
  font-size: 12px;
  line-height: 16px;
}

.desktop-nav {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-link {
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  background: transparent;
  color: #606266;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
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
}

.user-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 180px;
  padding: 7px 16px;
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.92);
  color: #222;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.04);
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;
}

.user-badge span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-badge:hover {
  background: rgba(243, 244, 246, 1);
}

.mobile-toggle {
  display: none;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #303133;
  cursor: pointer;
}

.page-shell {
  max-width: 1400px;
  height: calc(100dvh - 64px);
  margin: 0 auto;
  padding: 16px 20px 24px;
}

.content-shell {
  height: 100%;
  min-height: 0;
}

.content-shell :deep(> *) {
  min-height: 100%;
}

.mobile-panel {
  display: none;
}

.mobile-panel-mask {
  display: none;
}

:deep(.danger-item.el-dropdown-menu__item) {
  color: var(--el-color-danger);
  font-weight: 700;
}

@media (max-width: 1180px) {
  .brand {
    min-width: 176px;
    margin-right: 10px;
  }

  .desktop-nav {
    gap: 4px;
  }

  .nav-link {
    padding-inline: 9px;
  }
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
    height: calc(100dvh - 64px);
    padding: 12px;
  }

  .mobile-panel {
    position: fixed;
    top: 64px;
    right: 12px;
    left: 12px;
    z-index: 70;
    max-height: calc(100dvh - 150px);
    overflow: auto;
    display: block;
    border: 1px solid #e4e7ed;
    border-radius: 0 0 6px 6px;
    padding: 6px 12px 10px;
    background: #fff;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  }

  .mobile-panel-mask {
    position: fixed;
    inset: 64px 0 0;
    z-index: 69;
    display: block;
    background: rgba(15, 23, 42, 0.32);
    backdrop-filter: blur(1px);
  }

  .mobile-links {
    display: grid;
    gap: 4px;
  }

  .mobile-link {
    border: none;
    border-radius: 4px;
    min-height: 38px;
    padding: 9px 12px;
    display: flex;
    align-items: center;
    gap: 9px;
    background: transparent;
    color: #606266;
    font-size: 14px;
    font-weight: 500;
    text-align: left;

    &.expanded span {
      font-weight: 600;
    }
  }

  .mobile-link span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-link-arrow {
    flex: 0 0 auto;
    margin-left: auto;
    opacity: 0.78;
  }

  .mobile-link.active {
    color: #2563eb;
    background: rgba(64, 158, 255, 0.1);
    box-shadow: 0 1px 2px rgba(64, 158, 255, 0.24);
  }

  .mobile-link.expanded:not(.active) {
    color: #2563eb;
    background: #f5faff;
  }

  .mobile-sub-links {
    display: grid;
    gap: 2px;
    margin: -1px 0 2px 28px;
    padding: 2px 0 3px 8px;
    border-left: 1px solid #e1e7ef;
  }

  .mobile-link.secondary {
    min-height: 32px;
    padding: 7px 10px;
    background: transparent;
    color: #6b7280;
    font-size: 13px;
    box-shadow: none;
  }

  .mobile-link.secondary:hover {
    background: #f8fafc;
  }

  .mobile-link.secondary.active {
    color: #2563eb;
    // background: rgba(64, 158, 255, 0.08);
    box-shadow: none;
    font-weight: 600;
  }

  .mobile-link.danger {
    justify-content: center;
    border-top: 1px solid rgba(229, 231, 235, 0.8);
    border-radius: 0;
    margin-top: 6px;
    color: var(--el-color-danger);
  }

}

@media (max-width: 640px) {
  .topbar-inner {
    min-height: 56px;
    padding: 0 12px;
    gap: 10px;
  }

  .brand {
    flex: 1;
    min-width: 0;
    gap: 10px;
    margin-right: 0;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
    border-radius: 10px;
  }

  .brand-copy {
    display: block;
    min-width: 0;
  }

  .brand-title,
  .brand-subtitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-toggle {
    flex: 0 0 auto;
    width: 36px;
    height: 36px;
  }

  .page-shell {
    height: calc(100dvh - 56px);
    padding: 10px;
  }

  .content-shell {
    min-width: 0;
  }

  .mobile-panel {
    top: 56px;
    right: 0px;
    left: 0px;
  }

  .mobile-panel-mask {
    inset: 56px 0 0;
  }

}
</style>
