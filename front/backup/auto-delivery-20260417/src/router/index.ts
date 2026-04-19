import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '../store/auth'
import BaseLayout from '../layouts/BaseLayout.vue'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Users from '../views/Users.vue'
import Roles from '../views/Roles.vue'
import ProjectsLayout from '../views/projects/ProjectsLayout.vue'
import ProjectsList from '../views/projects/ProjectsList.vue'
import ProjectsCreate from '../views/projects/ProjectsCreate.vue'
import CodesLayout from '../views/codes/CodesLayout.vue'
import CodesList from '../views/codes/CodesList.vue'
import CodesGenerate from '../views/codes/CodesGenerate.vue'
import Products from '../views/Products.vue'
import Logs from '../views/Logs.vue'
import Profile from '../views/Profile.vue'
import CustomData from '../views/CustomData.vue'
import SecurityPolicies from '../views/SecurityPolicies.vue'

const routes: RouteRecordRaw[] = [
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
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: Dashboard, meta: { title: '仪表盘' } },
      { path: 'users', name: 'users', component: Users, meta: { title: '用户管理' } },
      { path: 'roles', name: 'roles', component: Roles, meta: { title: '角色管理' } },
      {
        path: 'projects',
        component: ProjectsLayout,
        children: [
          { path: '', redirect: '/projects/list' },
          { path: 'list', name: 'projects-list', component: ProjectsList, meta: { title: '项目列表' } },
          { path: 'create', name: 'projects-create', component: ProjectsCreate, meta: { title: '新建项目' } },
        ],
      },
      {
        path: 'codes',
        component: CodesLayout,
        children: [
          { path: '', redirect: '/codes/list' },
          { path: 'list', name: 'codes-list', component: CodesList, meta: { title: '注册码列表' } },
          { path: 'generate', name: 'codes-generate', component: CodesGenerate, meta: { title: '注册码生成' } },
        ],
      },
      { path: 'products', name: 'products', component: Products, meta: { title: '商品管理' } },
      { path: 'custom-data', name: 'custom-data', component: CustomData, meta: { title: '自定义数据' } },
      { path: 'security-policies', name: 'security-policies', component: SecurityPolicies, meta: { title: '安全策略管理' } },
      { path: 'logs', name: 'logs', component: Logs, meta: { title: '系统日志' } },
      { path: 'profile', name: 'profile', component: Profile, meta: { title: '个人中心' } },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  if (to.path !== '/login' && !auth.token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
    return
  }
  if (to.path === '/login' && auth.token) {
    next('/dashboard')
    return
  }
  document.title = (to.meta.title as string) || 'VerifySys'
  next()
})

export default router
