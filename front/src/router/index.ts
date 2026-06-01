import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../store/auth'
import { finishProgress, startProgress } from '../utils/progress'
import BaseLayout from '../layouts/BaseLayout.vue'
import Login from '../views/Login.vue'
import Users from '../views/Users.vue'
import UsersList from '../views/users/UsersList.vue'
import UsersForm from '../views/users/UsersForm.vue'
import Roles from '../views/Roles.vue'
import RolesList from '../views/roles/RolesList.vue'
import ProjectsLayout from '../views/projects/ProjectsLayout.vue'
import ProjectsList from '../views/projects/ProjectsList.vue'
import ProjectsCreate from '../views/projects/ProjectsCreate.vue'
import CodesLayout from '../views/codes/CodesLayout.vue'
import CodesList from '../views/codes/CodesList.vue'
import CodesGenerate from '../views/codes/CodesGenerate.vue'
import Products from '../views/Products.vue'
import ProductsList from '../views/products/ProductsList.vue'
import ProductsForm from '../views/products/ProductsForm.vue'
import Logs from '../views/Logs.vue'
import LogsOperation from '../views/logs/LogsOperation.vue'
import LogsLogin from '../views/logs/LogsLogin.vue'
import LogsError from '../views/logs/LogsError.vue'
import Profile from '../views/Profile.vue'
import CustomData from '../views/CustomData.vue'
import CustomDataList from '../views/custom-data/CustomDataList.vue'
import CustomDataForm from '../views/custom-data/CustomDataForm.vue'
import CustomDataHelp from '../views/custom-data/CustomDataHelp.vue'
import SecurityPolicies from '../views/SecurityPolicies.vue'
import SecurityPoliciesList from '../views/security-policies/SecurityPoliciesList.vue'
import SecurityPoliciesForm from '../views/security-policies/SecurityPoliciesForm.vue'
import AutoDelivery from '../views/AutoDelivery.vue'
import Forbidden from '../views/Forbidden.vue'
import PublicProduct from '../views/PublicProduct.vue'

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
    component: PublicProduct,
    meta: { title: '商品购买' },
  },
  {
    path: '/login',
    name: 'login',
    component: Login,
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: BaseLayout,
    children: [
      { path: '', redirect: '/codes/list' },
      {
        path: 'users',
        component: Users,
        meta: { requiresAdmin: true },
        children: [
          { path: '', redirect: '/users/list' },
          { path: 'list', name: 'users-list', component: UsersList, meta: { title: '用户管理' } },
          { path: 'create', name: 'users-create', component: UsersForm, meta: { title: '新增用户' } },
          { path: 'edit/:id', name: 'users-edit', component: UsersForm, meta: { title: '编辑用户' } },
        ],
      },
      {
        path: 'roles',
        component: Roles,
        meta: { requiresAdmin: true },
        children: [
          { path: '', redirect: '/roles/list' },
          { path: 'list', name: 'roles-list', component: RolesList, meta: { title: '角色配置' } },
          { path: 'create', redirect: '/roles/list' },
          { path: 'edit/:id', redirect: '/roles/list' },
        ],
      },
      {
        path: 'projects',
        component: ProjectsLayout,
        meta: { permissions: ['projects'] },
        children: [
          { path: '', redirect: '/projects/list' },
          { path: 'list', name: 'projects-list', component: ProjectsList, meta: { title: '项目列表' } },
          { path: 'create', name: 'projects-create', component: ProjectsCreate, meta: { title: '新建项目' } },
        ],
      },
      {
        path: 'codes',
        component: CodesLayout,
        meta: { permissions: ['codes'] },
        children: [
          { path: '', redirect: '/codes/list' },
          { path: 'list', name: 'codes-list', component: CodesList, meta: { title: '注册码列表' } },
          { path: 'generate', name: 'codes-generate', component: CodesGenerate, meta: { title: '注册码生成' } },
        ],
      },
      {
        path: 'products',
        component: Products,
        meta: { permissions: ['products'] },
        children: [
          { path: '', redirect: '/products/list' },
          { path: 'list', name: 'products-list', component: ProductsList, meta: { title: '商品管理' } },
          { path: 'create', name: 'products-create', component: ProductsForm, meta: { title: '新增商品' } },
          { path: 'edit/:id', name: 'products-edit', component: ProductsForm, meta: { title: '编辑商品' } },
        ],
      },
      {
        path: 'custom-data',
        component: CustomData,
        meta: { permissions: ['custom-data'] },
        children: [
          { path: '', redirect: '/custom-data/list' },
          { path: 'list', name: 'custom-data-list', component: CustomDataList, meta: { title: '自定义数据' } },
          { path: 'create', name: 'custom-data-create', component: CustomDataForm, meta: { title: '新增自定义数据' } },
          { path: 'edit/:id', name: 'custom-data-edit', component: CustomDataForm, meta: { title: '编辑自定义数据' } },
          { path: 'help', name: 'custom-data-help', component: CustomDataHelp, meta: { title: '使用说明' } },
        ],
      },
      {
        path: 'security-policies',
        component: SecurityPolicies,
        meta: { permissions: ['security-policies'] },
        children: [
          { path: '', redirect: '/security-policies/list' },
          { path: 'list', name: 'security-policies-list', component: SecurityPoliciesList, meta: { title: '安全策略管理' } },
          { path: 'create', name: 'security-policies-create', component: SecurityPoliciesForm, meta: { title: '新增安全策略' } },
          { path: 'edit/:id', name: 'security-policies-edit', component: SecurityPoliciesForm, meta: { title: '编辑安全策略' } },
        ],
      },
      { path: 'auto-delivery', redirect: '/auto-delivery/list' },
      { path: 'auto-delivery/list', name: 'auto-delivery-list', component: AutoDelivery, meta: { title: '商品管理', permissions: ['auto-delivery'] } },
      { path: 'auto-delivery/create', name: 'auto-delivery-create', component: AutoDelivery, meta: { title: '商品添加', permissions: ['auto-delivery'] } },
      { path: 'auto-delivery/edit/:id', name: 'auto-delivery-edit', component: AutoDelivery, meta: { title: '编辑商品', permissions: ['auto-delivery'] } },
      {
        path: 'logs',
        component: Logs,
        meta: { requiresAdmin: true },
        children: [
          { path: '', redirect: '/logs/operation' },
          { path: 'operation', name: 'logs-operation', component: LogsOperation, meta: { title: '操作日志' } },
          { path: 'login', name: 'logs-login', component: LogsLogin, meta: { title: '登录日志' } },
          { path: 'error', name: 'logs-error', component: LogsError, meta: { title: '错误日志' } },
        ],
      },
      { path: 'profile', name: 'profile', component: Profile, meta: { title: '个人中心' } },
      { path: '403', name: 'forbidden', component: Forbidden, meta: { title: '无权访问' } },
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

  if (to.path !== '/login' && !auth.token) {
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
  if (to.path !== '/login' && auth.token) {
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
