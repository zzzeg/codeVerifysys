<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Collection,
  DataAnalysis,
  Document,
  Key,
  Lock,
  Bell,
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
import {
  getNotifications,
  getUnreadNotifications,
  markNotificationAsRead,
} from '../api/notifications'
import { useAuthStore } from '../store/auth'
import type { NotificationItem } from '../types/notification'

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
const notificationDialogVisible = ref(false)
const notificationLoading = ref(false)
const notificationLoadingMore = ref(false)
const notificationList = ref<NotificationItem[]>([])
const notificationPage = ref(1)
const notificationPageSize = 10
const notificationTotal = ref(0)
const activeNotificationId = ref('')
const unreadCount = ref(0)

const currentUsername = computed(() => auth.currentUser?.username || '管理员')
const currentRoles = computed(() => auth.currentUser?.roles || [])
const currentPermissions = computed(() => auth.currentUser?.permissions || [])
const isSuperAdmin = computed(
  () => currentRoles.value.includes('role-admin') || currentPermissions.value.includes('*') || currentUsername.value === 'admin',
)
const hasMoreNotifications = computed(() => notificationList.value.length < notificationTotal.value)
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
    { path: '/users/roles/list', basePath: '/users/roles', label: '角色配置', icon: Key },
  ],
  '/logs': [
    { path: '/users/settlements', basePath: '/users/settlements', label: '结算管理', icon: SetUp },
    { path: '/notifications/publish', basePath: '/notifications/publish', label: '发布通知', icon: Bell },
    { path: '/logs/operation', basePath: '/logs/operation', label: '操作日志', icon: Document },
    { path: '/logs/login', basePath: '/logs/login', label: '登录日志', icon: Document },
    { path: '/logs/error', basePath: '/logs/error', label: '错误日志', icon: Document },
  ],
  '/profile': [
    { path: '/profile/dashboard', basePath: '/profile/dashboard', label: '数据看板', icon: DataAnalysis },
    { path: '/profile/info', basePath: '/profile/info', label: '个人信息', icon: AvatarIcon },
    { path: '/profile/finance', basePath: '/profile/finance', label: '财务管理', icon: Tickets },
  ],
}

const profileMenu: NavItem[] = [
  { path: '/profile/dashboard', basePath: '/profile', label: '个人中心', icon: AvatarIcon },
]

const manageMenu = computed<NavItem[]>(() => {
  if (!isSuperAdmin.value) return []

  return [
    { path: '/users/list', basePath: '/users', label: '用户管理', icon: UserFilled, adminOnly: true },
    { path: '/users/settlements', basePath: '/logs', label: '系统管理', icon: Document, adminOnly: true },
  ]
})

const mobileMenu = computed(() => [...primaryMenu.value, ...manageMenu.value, ...profileMenu])
const activeMobileBasePath = computed(() => mobileMenu.value.find((item) => isActive(item.path, item.basePath))?.basePath || '')
const getSecondaryMenu = (item: NavItem) =>
  expandedMobileBasePath.value === item.basePath ? secondaryMenuMap[item.basePath] || [] : []

/**
 * 判断当前路径是否属于系统管理模块
 * @returns 返回当前页面是否应归属到系统管理菜单
 */
const isSystemManagePath = () =>
  route.path.startsWith('/logs/') || route.path === '/users/settlements' || route.path === '/notifications/publish'

/**
 * 判断菜单项是否处于选中状态
 * @param path 菜单默认跳转路径
 * @param basePath 菜单基础路径，用于匹配同模块子页面
 * @returns 返回当前路由是否匹配菜单项
 */
const isActive = (path: string, basePath?: string) => {
  if (route.path === path) return true
  if (basePath === '/logs' && isSystemManagePath()) return true
  if (isSystemManagePath()) return false
  return basePath ? route.path === basePath || route.path.startsWith(`${basePath}/`) : false
}

/**
 * 跳转到指定页面
 * @param path 目标页面路径
 * @returns 无返回值，路径变化时触发路由跳转
 */
const navigateTo = (path: string) => {
  mobileMenuOpen.value = false
  if (route.path !== path) router.push(path)
}

/**
 * 格式化通知时间
 * @param value 通知创建时间戳
 * @returns 返回中文本地化时间文本
 */
const formatNotificationTime = (value: number) => new Date(value).toLocaleString('zh-CN', { hour12: false })

/**
 * 获取通知类型展示文本
 * @param category 通知类型编码
 * @returns 返回通知类型中文文本
 */
const getNotificationCategoryText = (category: string) => {
  const map: Record<string, string> = {
    system: '系统',
    todo: '待办',
    order: '订单',
    settlement: '结算',
  }
  return map[category] || category
}

/**
 * 获取当前用户未读通知数量
 * @returns 无返回值，内部更新未读数量状态
 */
const fetchUnreadCount = async () => {
  const resp = await getUnreadNotifications()
  unreadCount.value = Array.isArray(resp.data.data) ? resp.data.data.length : 0
}

/**
 * 获取通知列表
 * @param reset 是否重置为第一页重新加载
 * @returns 无返回值，内部维护通知列表、分页和展开状态
 */
const fetchNotifications = async (reset = false) => {
  if (notificationLoading.value || notificationLoadingMore.value) return
  if (!reset && !hasMoreNotifications.value) return

  const nextPage = reset ? 1 : notificationPage.value
  if (reset) notificationLoading.value = true
  else notificationLoadingMore.value = true

  try {
    const resp = await getNotifications({ page: nextPage, pageSize: notificationPageSize })
    const data = resp.data.data || { list: [], total: 0 }
    const rows = data.list || []
    notificationTotal.value = Number(data.total || 0)
    notificationList.value = reset ? rows : notificationList.value.concat(rows)
    notificationPage.value = nextPage + 1
    if (!activeNotificationId.value && notificationList.value[0]) {
      activeNotificationId.value = notificationList.value[0].id
      await markNotificationRead(notificationList.value[0])
    }
  } finally {
    notificationLoading.value = false
    notificationLoadingMore.value = false
  }
}

/**
 * 打开通知弹窗
 * @returns 无返回值，打开后加载第一页通知并刷新未读数量
 */
const openNotificationDialog = async () => {
  notificationDialogVisible.value = true
  activeNotificationId.value = ''
  await fetchNotifications(true)
  await fetchUnreadCount()
}

/**
 * 处理通知弹窗滚动加载
 * @param event 滚动事件对象
 * @returns 无返回值，滚动到底部附近时拉取下一页
 */
const handleNotificationScroll = (event: Event) => {
  const target = event.target as HTMLElement
  if (target.scrollTop + target.clientHeight >= target.scrollHeight - 48) {
    fetchNotifications()
  }
}

/**
 * 标记指定通知为已读
 * @param row 通知行数据
 * @returns 无返回值，后端成功后同步本地已读状态
 */
const markNotificationRead = async (row?: NotificationItem) => {
  if (!row || row.read) return
  await markNotificationAsRead(row.id)
  row.read = true
  unreadCount.value = Math.max(0, unreadCount.value - 1)
}

/**
 * 处理折叠面板展开变化
 * @param value 当前展开的通知ID
 * @returns 无返回值，展开通知时自动标记已读
 */
const handleNotificationActiveChange = async (value: string | string[]) => {
  const id = Array.isArray(value) ? value[0] : value
  if (!id) return
  await markNotificationRead(notificationList.value.find((item) => item.id === id))
}

/**
 * 处理移动端一级菜单点击
 * @param item 当前点击的菜单项
 * @returns 无返回值，有二级菜单时展开或折叠，无二级菜单时直接跳转
 */
const handleMobilePrimaryClick = (item: NavItem) => {
  const children = secondaryMenuMap[item.basePath] || []
  if (!children.length) {
    navigateTo(item.path)
    return
  }

  expandedMobileBasePath.value = expandedMobileBasePath.value === item.basePath ? '' : item.basePath
}

/**
 * 退出当前登录状态
 * @returns 无返回值，清理登录状态后跳转到登录页
 */
const handleLogout = () => {
  auth.logout()
  mobileMenuOpen.value = false
  router.push('/login')
}

onMounted(fetchUnreadCount)

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
          <el-badge :value="unreadCount" :hidden="unreadCount <= 0" :max="99" @click="openNotificationDialog">
            <el-icon :size="18">
              <Bell />
            </el-icon>
          </el-badge>

          <el-dropdown class="user-dropdown" trigger="click">
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

    <el-dialog v-model="notificationDialogVisible" title="通知中心" width="640px" class="notification-dialog"
      destroy-on-close append-to-body align-center>
      <div class="notification-scroll" v-loading="notificationLoading" @scroll="handleNotificationScroll">
        <el-empty v-if="!notificationLoading && !notificationList.length" description="暂无通知" />
        <el-collapse v-else v-model="activeNotificationId" accordion class="notification-collapse"
          @change="handleNotificationActiveChange">
          <el-collapse-item v-for="item in notificationList" :key="item.id" :name="item.id">
            <template #title>
              <div class="notification-title">
                <span class="notice-dot" :class="{ read: item.read }" />
                <span class="notification-title-text">{{ item.title }}</span>
                <el-tag size="small" :type="item.read ? 'info' : 'warning'">{{ item.read ? '已读' : '未读' }}</el-tag>
              </div>
            </template>
            <div class="notification-meta">
              <span>{{ getNotificationCategoryText(item.category) }}</span>
              <span>{{ formatNotificationTime(item.createdAt) }}</span>
            </div>
            <div class="notification-content">{{ item.content }}</div>
          </el-collapse-item>
        </el-collapse>
        <div v-if="notificationLoadingMore" class="notification-loading-more">加载中...</div>
        <div v-else-if="notificationList.length && !hasMoreNotifications" class="notification-finished">没有更多通知了</div>
      </div>
    </el-dialog>
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

.notice-button {
  width: 36px;
  height: 36px;
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 12px;
  display: inline-grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.92);
  color: #303133;
  cursor: pointer;
  box-shadow: 0 0 5px rgba(0, 0, 0, 0.04);
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.notice-button:hover {
  background: rgba(243, 244, 246, 1);
  color: #2563eb;
}

.el-badge {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.notice-button :deep(.el-badge__content) {
  top: 4px;
  right: 4px;
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

.mobile-notice-count {
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  background: #f56c6c;
  color: #fff;
  font-size: 12px;
  line-height: 20px;
}

:global(.notification-dialog.el-dialog) {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
  max-height: 80dvh;
  margin: auto !important;
  overflow: auto;
}

:global(.notification-dialog .el-dialog__header) {
  flex: 0 0 auto;
}

:global(.notification-dialog .el-dialog__body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  max-height: none;
  overflow: hidden;
  padding-top: 12px;
}

.notification-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  color: #606266;
  font-size: 13px;
}

.notification-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notification-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

:deep(.el-collapse) {
  border: none;
}

.notification-title {
  min-width: 0;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 12px;
}

.notice-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  flex: 0 0 auto;
  background: #f56c6c;
}

.notice-dot.read {
  background: #c0c4cc;
}

.notification-title-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #303133;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  color: #909399;
  font-size: 12px;
}

.notification-content {
  color: #303133;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.notification-loading-more,
.notification-finished {
  padding: 12px 0 4px;
  color: #909399;
  font-size: 12px;
  text-align: center;
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
    min-height: 42px;
    padding: 10px 12px;
    display: flex;
    align-items: center;
    gap: 9px;
    background: transparent;
    color: #606266;
    font-size: 15px;
    font-weight: 500;
    text-align: left;
    touch-action: manipulation;
    -webkit-tap-highlight-color: rgba(64, 158, 255, 0.14);

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
    min-height: 36px;
    padding: 8px 10px;
    background: transparent;
    color: #6b7280;
    font-size: 14px;
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
