import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../store/auth'
import { finishProgress, startProgress } from '../utils/progress'
import BaseLayout from '../layouts/BaseLayout.vue'

const UsersForm = () => import('../views/users/UsersForm.vue')
const ProjectsCreate = () => import('../views/projects/ProjectsCreate.vue')
const CustomDataForm = () => import('../views/custom-data/CustomDataForm.vue')
const SecurityPoliciesForm = () => import('../views/security-policies/SecurityPoliciesForm.vue')
const AutoDeliveryForm = () => import('../views/auto-delivery/AutoDeliveryForm.vue')
const Settlement = () => import('../views/Settlement.vue')
const NotificationPublish = () => import('../views/notifications/NotificationPublish.vue')

const hasRoutePermission = (user: { username?: string; roles?: string[]; permissions?: string[] } | null, requiredPermissions?: string[]) => {
  if (!requiredPermissions?.length) return true
  const roles = user?.roles || []
  const permissions = user?.permissions || []
  const username = user?.username || ''
  if (roles.includes('role-admin') || permissions.includes('*') || username === 'admin') return true
  return requiredPermissions.some((permission) => permissions.includes(permission))
}

const routes: RouteRecordRaw[] = [
  {
    path: '/buy/:code',
    name: 'public-product',
    component: () => import('../views/PublicProduct.vue'),
    meta: { title: '商品购买', public: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: BaseLayout,
    children: [
      { path: '', redirect: '/codes/list' },
      {
        path: 'users',
        component: () => import('../views/Users.vue'),
        meta: { requiresAdmin: true },
        children: [
          { path: '', redirect: '/users/list' },
          { path: 'list', name: 'users-list', component: () => import('../views/users/UsersList.vue'), meta: { title: '用户管理' } },
          { path: 'create', name: 'users-create', component: UsersForm, meta: { title: '新增用户' } },
          { path: 'edit/:id', name: 'users-edit', component: UsersForm, meta: { title: '编辑用户' } },
          { path: 'roles/list', name: 'users-roles-list', component: () => import('../views/roles/RolesList.vue'), meta: { title: '角色配置' } },
        ],
      },
      {
        path: 'roles',
        component: () => import('../views/Roles.vue'),
        meta: { requiresAdmin: true },
        children: [
          { path: '', redirect: '/users/roles/list' },
          { path: 'list', redirect: '/users/roles/list' },
          { path: 'create', redirect: '/users/roles/list' },
          { path: 'edit/:id', redirect: '/users/roles/list' },
        ],
      },
      {
        path: 'projects',
        component: () => import('../views/projects/ProjectsLayout.vue'),
        meta: { permissions: ['projects'] },
        children: [
          { path: '', redirect: '/projects/list' },
          { path: 'list', name: 'projects-list', component: () => import('../views/projects/ProjectsList.vue'), meta: { title: '项目列表' } },
          { path: 'create', name: 'projects-create', component: ProjectsCreate, meta: { title: '新建项目' } },
          { path: 'edit/:id', name: 'projects-edit', component: ProjectsCreate, meta: { title: '编辑项目' } },
        ],
      },
      {
        path: 'codes',
        component: () => import('../views/codes/CodesLayout.vue'),
        meta: { permissions: ['codes'] },
        children: [
          { path: '', redirect: '/codes/list' },
          { path: 'list', name: 'codes-list', component: () => import('../views/codes/CodesList.vue'), meta: { title: '注册码列表' } },
          { path: 'generate', name: 'codes-generate', component: () => import('../views/codes/CodesGenerate.vue'), meta: { title: '注册码生成' } },
        ],
      },
      {
        path: 'custom-data',
        component: () => import('../views/CustomData.vue'),
        meta: { permissions: ['custom-data'] },
        children: [
          { path: '', redirect: '/custom-data/list' },
          { path: 'list', name: 'custom-data-list', component: () => import('../views/custom-data/CustomDataList.vue'), meta: { title: '自定义数据' } },
          { path: 'create', name: 'custom-data-create', component: CustomDataForm, meta: { title: '新增自定义数据' } },
          { path: 'edit/:id', name: 'custom-data-edit', component: CustomDataForm, meta: { title: '编辑自定义数据' } },
          { path: 'help', name: 'custom-data-help', component: () => import('../views/custom-data/CustomDataHelp.vue'), meta: { title: '使用说明' } },
        ],
      },
      {
        path: 'security-policies',
        component: () => import('../views/SecurityPolicies.vue'),
        meta: { permissions: ['security-policies'] },
        children: [
          { path: '', redirect: '/security-policies/list' },
          { path: 'list', name: 'security-policies-list', component: () => import('../views/security-policies/SecurityPoliciesList.vue'), meta: { title: '安全策略管理' } },
          { path: 'create', name: 'security-policies-create', component: SecurityPoliciesForm, meta: { title: '新增安全策略' } },
          { path: 'edit/:id', name: 'security-policies-edit', component: SecurityPoliciesForm, meta: { title: '编辑安全策略' } },
        ],
      },
      {
        path: 'auto-delivery',
        component: () => import('../views/AutoDelivery.vue'),
        meta: { permissions: ['auto-delivery'] },
        children: [
          { path: '', redirect: '/auto-delivery/list' },
          { path: 'list', name: 'auto-delivery-list', component: () => import('../views/auto-delivery/AutoDeliveryList.vue'), meta: { title: '商品管理' } },
          { path: 'orders', name: 'auto-delivery-orders', component: () => import('../views/auto-delivery/AutoDeliveryOrders.vue'), meta: { title: '已卖出的商品' } },
          { path: 'create', name: 'auto-delivery-create', component: AutoDeliveryForm, meta: { title: '商品添加' } },
          { path: 'edit/:id', name: 'auto-delivery-edit', component: AutoDeliveryForm, meta: { title: '编辑商品' } },
        ],
      },
      {
        path: 'logs',
        component: () => import('../views/Logs.vue'),
        meta: { requiresAdmin: true },
        children: [
          { path: '', redirect: '/users/settlements' },
          { path: 'operation', name: 'logs-operation', component: () => import('../views/logs/LogsOperation.vue'), meta: { title: '操作日志' } },
          { path: 'login', name: 'logs-login', component: () => import('../views/logs/LogsLogin.vue'), meta: { title: '登录日志' } },
          { path: 'error', name: 'logs-error', component: () => import('../views/logs/LogsError.vue'), meta: { title: '错误日志' } },
          { path: '/users/settlements', name: 'system-settlements', component: Settlement, meta: { title: '结算管理' } },
          { path: '/notifications/publish', name: 'notifications-publish', component: NotificationPublish, meta: { title: '发布通知' } },
        ],
      },
      { path: 'settlements', redirect: '/users/settlements' },
      { path: 'notifications', name: 'notifications-list', component: () => import('../views/Notifications.vue'), meta: { title: '通知中心', requiresAdmin: true } },
      {
        path: 'profile',
        component: () => import('../views/Profile.vue'),
        meta: { title: '个人中心' },
        children: [
          { path: '', redirect: '/profile/dashboard' },
          {
            path: 'dashboard',
            name: 'profile-dashboard',
            component: () => import('../views/profile/ProfileDashboard.vue'),
            meta: { title: '数据看板' },
          },
          {
            path: 'info',
            name: 'profile-info',
            component: () => import('../views/profile/ProfileInfo.vue'),
            meta: { title: '个人信息' },
          },
          {
            path: 'finance',
            name: 'profile-finance',
            component: () => import('../views/profile/ProfileFinance.vue'),
            meta: { title: '财务管理' },
          },
        ],
      },
      { path: '403', name: 'forbidden', component: () => import('../views/Forbidden.vue'), meta: { title: '无权访问' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  startProgress()
  const auth = useAuthStore()
  const isPublicRoute = to.matched.some((record) => record.meta?.public)

  if (!isPublicRoute && to.path !== '/login' && !auth.token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }

  // If we have a token but haven't validated it yet (e.g. after F5 refresh),
  // validate once before allowing navigation.
  const ensureSession = async () => {
    if (!auth.token) return false
    if (auth.currentUser) return true

    try {
      await auth.fetchProfile()
    } catch {
      // ignore and fall through to check currentUser
    }

    // If token is invalid, request interceptor likely logged out already.
    return Boolean(auth.token && auth.currentUser)
  }

  const isAdminRoute = to.matched.some((record) => record.meta?.requiresAdmin)
  const requiredPermissions = to.matched.flatMap((record) => (record.meta?.permissions as string[] | undefined) || [])
  const hasAdminAccess = () => {
    const roles = auth.currentUser?.roles || []
    const permissions = auth.currentUser?.permissions || []
    const username = auth.currentUser?.username || ''
    return roles.includes('role-admin') || permissions.includes('*') || username === 'admin'
  }

  // Visiting login with a token: only skip login if the session is valid.
  if (to.path === '/login' && auth.token) {
    document.title = (to.meta.title as string) || 'VerifySys'
    ensureSession()
      .then((ok) => {
        if (ok) next('/codes/list')
        else next()
      })
      .catch(() => next())
    return
  }

  // Visiting protected pages with a token: validate first, otherwise go to login.
  if (!isPublicRoute && to.path !== '/login' && auth.token) {
    ensureSession()
      .then((ok) => {
        if (!ok) {
          next({ path: '/login', query: { redirect: to.fullPath } })
          return
        }
        if (isAdminRoute && !hasAdminAccess()) {
          next('/403')
          return
        }
        if (!hasRoutePermission(auth.currentUser, requiredPermissions)) {
          next('/403')
          return
        }
        document.title = (to.meta.title as string) || 'VerifySys'
        next()
      })
      .catch(() => {
        next({ path: '/login', query: { redirect: to.fullPath } })
      })
    return
  }

  document.title = (to.meta.title as string) || 'VerifySys'
  next()
})

router.afterEach(() => {
  finishProgress()
})

router.onError(() => {
  finishProgress()
})

export default router
