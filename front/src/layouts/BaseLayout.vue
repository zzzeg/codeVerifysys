<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox, ElMessage } from 'element-plus'
import {
  House,
  User,
  Key,
  Collection,
  Tickets,
  ShoppingCart,
  DataAnalysis,
  Lock,
  Document,
  Avatar as AvatarIcon,
  List,
  Edit,
  CirclePlus,
  Close,
} from '@element-plus/icons-vue'
import { useAuthStore } from '../store/auth'
import { useTabsStore } from '../store/tabs'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const tabsStore = useTabsStore()

const menuItems = [
  { path: '/dashboard', label: '仪表盘', icon: House },
  { path: '/users', label: '用户管理', icon: User },
  { path: '/roles', label: '角色管理', icon: Key },
  {
    path: '/projects',
    label: '项目管理',
    icon: Collection,
    children: [
      { path: '/projects/list', label: '项目管理', icon: Document },
      { path: '/projects/create', label: '新建项目', icon: CirclePlus },
    ],
  },
  {
    path: '/codes',
    label: '注册码管理',
    icon: Tickets,
    children: [
      { path: '/codes/list', label: '注册码列表', icon: List },
      { path: '/codes/generate', label: '注册码生成', icon: Edit },
    ],
  },
  { path: '/products', label: '商品管理', icon: ShoppingCart },
  { path: '/custom-data', label: '自定义数据', icon: DataAnalysis },
  { path: '/security-policies', label: '安全策略', icon: Lock },
  { path: '/logs', label: '系统日志', icon: Document },
  { path: '/profile', label: '个人中心', icon: AvatarIcon },
]

const activeMenu = computed(() => route.path)

const breadcrumb = computed(() => {
  const matched = route.matched.filter((m) => m.meta?.title)
  return [{ title: '首页', path: '/dashboard' }, ...matched.map((m) => ({ title: m.meta?.title as string, path: m.path || '' }))]
})

const addTabByRoute = () => {
  const title = (route.meta.title as string) || '未命名'
  tabsStore.addTab({ title, path: route.path, hover: false })
}

const handleLogout = async () => {
  await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' })
  auth.logout()
  ElMessage.success('已退出')
  router.push('/login')
}

const handleTabClick = (path: string) => {
  tabsStore.active = path
  router.push(path)
}

const handleTabClose = (path: string) => {
  tabsStore.removeTab(path)
  router.push(tabsStore.active)
}

onMounted(() => {
  auth.fetchProfile()
  addTabByRoute()
})

watch(
  () => route.fullPath,
  () => addTabByRoute(),
  { immediate: false },
)

const handleTabHover = (hovered: boolean, path: string) => {
  const tab = tabsStore.tabs.find((tab) => tab.path === path)
  if (tab) {
    tab.hover = hovered
  }
}

</script>

<template>
  <div class="layout">
    <aside class="sider">
      <div class="logo">
        <div class="logo-mark">V</div>
        <div class="logo-text">
          <div class="name">VerifySys</div>
          <div class="desc">控制台</div>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="menu" 
        active-text-color="#fff">
        <template v-for="item in menuItems" :key="item.path">
          <el-sub-menu v-if="item.children" :index="item.path">
            <template #title>
              <el-icon>
                <component :is="item.icon" />
              </el-icon>
              <span>{{ item.label }}</span>
            </template>
            <el-menu-item v-for="sub in item.children" :key="sub.path" :index="sub.path">
              <el-icon>
                <component :is="sub.icon" />
              </el-icon>
              <span>{{ sub.label }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </aside>
    <main class="main">
      <header class="header">
        <div class="breadcrumb">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="item in breadcrumb" :key="item.path || item.title" :to="item.path">{{ item.title
              }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="user-area">
          <el-icon class="avatar">
            <AvatarIcon />
          </el-icon>
          <span class="user">{{ auth.currentUser?.username || '访客' }}</span>
          <el-button size="small" @click="router.push('/profile')">个人中心</el-button>
          <el-button size="small" type="danger" @click="handleLogout">退出</el-button>
        </div>
      </header>
      <div class="tabs-bar">
        <div v-for="tab in tabsStore.tabs" :key="tab.path" class="tab-item" @mouseover="handleTabHover(true, tab.path)"
          @mouseleave="handleTabHover(false, tab.path)"
          :class="{ active: tabsStore.active === tab.path, 'schedule-in': tab.hover, 'schedule-out': !tab.hover }"
          @click="handleTabClick(tab.path)">
          <span>{{ tab.title }}</span>
          <el-icon v-if="tab.path !== '/dashboard'" class="close" @click.stop="handleTabClose(tab.path)">
            <Close />
          </el-icon>
        </div>
      </div>
      <section class="content">
        <router-view />
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
  background: #eef2f7;
}

.sider {
  color: #303133;
  display: flex;
  flex-direction: column;
  box-shadow: 0px 0 3px rgba(15, 23, 42, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: #fff;
}

.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: grid;
  place-items: center;
  font-weight: 800;
  color: #303133;
}

.logo-text .name {
  font-weight: 700;
}

.logo-text .desc {
  font-size: 12px;
  color: #94a3b8;
}

.menu {
  border-right: none;
  flex: 1;
  padding: 8px 0;
  display: flex;
    flex-direction: column; 
}

.menu :deep(.el-menu-item) {
  margin: 5px 4px;
  border-radius: 4px;
}
:deep(.el-sub-menu) {
  margin: 5px 4px;
  border-radius: 4px;
}
.menu :deep(.el-menu-item.is-active) {
  background:#409EFF;
}
:deep(.el-sub-menu__title) {
  height: 40px; line-height: 50px; overflow: hidden;
}
:deep(.el-menu-item) {
  height: 40px; line-height: 50px; overflow: hidden; border-top:solid 1px transparent;
}

.main {
  display: flex;
  flex-direction: column;
}

.header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 10px rgba(15, 23, 42, 0.08);
}

.breadcrumb {
  font-weight: 600;
}

.content {
  padding: 18px;
  overflow: auto;
  flex: 1;
}

.tabs-bar {
  display: flex;
  align-items: center;

  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  padding: 0px 12px;
  height: 34px; line-height: 34px;
  cursor: pointer;
  color: #334155;
  position: relative;
  font-size: 14px;
}

.tab-item.active {
  color: #409EFF;
  background: #fff;
  border-left: 1px solid #eee;
  border-right: 1px solid #eee;

  &::after {
    content: '';
    display: block;
    position: absolute;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 2px;
    background: #409EFF;
  }
}

.tab-item .close {
  font-size: 14px;
  color: #94a3b8;
  margin-left:10px;
}

.schedule-in {
  &::before {
    animation: schedule-in .2s ease-in;
    background: #409EFF;
    bottom: 0;
    height: 2px;
    left: 0;
    position: absolute;
    width: 100%;
    content: "";
    display: block;
  }
}

.schedule-out {
  &::before {
    animation: schedule-out .2s ease-in;
    background: #409EFF;
    bottom: 0;
    height: 2px;
    left: 0;
    position: absolute;
    width: 0;
    content: "";
    display: block;
  }
}

@keyframes schedule-in {
  0% {
    width: 0
  }

  to {
    width: 100%
  }
}

@keyframes schedule-out {
  0% {
    width: 100%
  }

  to {
    width: 0
  }
}

.user-area {
  display: flex;
  gap: 10px;
  align-items: center;
}

.avatar {
  background: #e0f2fe;
  color: #0ea5e9;
  border-radius: 50%;
  padding: 6px;
}

.user {
  color: #0f172a;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 72px 1fr;
  }

  .logo-text {
    display: none;
  }

  .menu :deep(.el-menu-item span) {
    font-size: 12px;
  }
}
</style>
