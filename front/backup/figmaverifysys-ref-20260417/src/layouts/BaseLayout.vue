<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Avatar as AvatarIcon,
  CirclePlus,
  Collection,
  DataAnalysis,
  Document,
  Edit,
  House,
  Key,
  List,
  Lock,
  ShoppingCart,
  Tickets,
  User,
} from '@element-plus/icons-vue'

const route = useRoute()

const menuItems = [
  { path: '/dashboard', label: '仪表盘', icon: House },
  { path: '/users', label: '用户管理', icon: User },
  { path: '/roles', label: '角色管理', icon: Key },
  {
    path: '/projects',
    label: '项目管理',
    icon: Collection,
    children: [
      { path: '/projects/list', label: '项目列表', icon: Document },
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
const openedMenus = computed(() => {
  const segments = route.path.split('/').filter(Boolean)
  return segments.length > 1 ? [`/${segments[0]}`] : []
})
</script>

<template>
  <div class="layout">
    <aside class="sider">
      <div class="logo">
        <div class="logo-mark">V</div>
        <div class="logo-text">
          <div class="name">VerifySys</div>
          <div class="desc">License Workspace</div>
        </div>
      </div>

      <div class="nav-caption">Workspace</div>

      <el-menu
        :default-active="activeMenu"
        :default-openeds="openedMenus"
        router
        class="menu"
        background-color="transparent"
        text-color="#5f6f86"
        active-text-color="#1748cf"
      >
        <template v-for="item in menuItems" :key="item.path">
          <el-sub-menu v-if="item.children" :index="item.path">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </template>
            <el-menu-item v-for="sub in item.children" :key="sub.path" :index="sub.path">
              <el-icon><component :is="sub.icon" /></el-icon>
              <span>{{ sub.label }}</span>
            </el-menu-item>
          </el-sub-menu>
          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </el-menu-item>
        </template>
      </el-menu>

      <div class="sider-footer">
        <div class="status-dot" />
        <div>
          <div class="status-title">System Online</div>
          <div class="status-desc">Unified license operations</div>
        </div>
      </div>
    </aside>

    <main class="main">
      <section class="content">
        <router-view />
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.layout {
  display: grid;
  grid-template-columns: 288px minmax(0, 1fr);
  min-height: 100vh;
  padding: 18px;
  gap: 18px;
  background: transparent;
}

.sider {
  display: flex;
  flex-direction: column;
  padding: 18px 14px 14px;
  border-radius: 30px;
  border: 1px solid rgba(255, 255, 255, 0.75);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(245, 249, 255, 0.84)),
    radial-gradient(circle at top, rgba(47, 107, 255, 0.14), transparent 34%);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.logo {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 10px 18px;
}

.logo-mark {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #2f6bff, #5b8cff 70%, #7dd3fc);
  box-shadow: 0 10px 20px rgba(47, 107, 255, 0.2);
}

.logo-text .name {
  font-size: 18px;
  font-weight: 800;
  color: #172033;
}

.logo-text .desc {
  margin-top: 2px;
  font-size: 12px;
  color: #7a8aa2;
}

.nav-caption {
  padding: 0 12px 10px;
  color: #8b9ab0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.menu {
  border-right: none;
  flex: 1;
  padding: 6px 0 0;
}

.menu :deep(.el-menu-item),
.menu :deep(.el-sub-menu__title) {
  height: 46px;
  line-height: 46px;
  margin: 4px 0;
  border-radius: 16px;
  padding-left: 14px !important;
  padding-right: 14px;
  transition:
    background-color 0.12s ease,
    color 0.12s ease;
}

.menu :deep(.el-menu-item:hover),
.menu :deep(.el-sub-menu__title:hover) {
  background: rgba(47, 107, 255, 0.08);
  color: #1748cf;
}

.menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(47, 107, 255, 0.12), rgba(47, 107, 255, 0.04));
  color: #1748cf;
  font-weight: 700;
}

.menu :deep(.el-sub-menu .el-menu-item) {
  margin-left: 8px;
  margin-right: 8px;
  height: 42px;
  line-height: 42px;
}

.menu :deep(.el-sub-menu__icon-arrow) {
  transition: transform 0.12s ease;
}

.menu :deep(.el-menu-item [class*='el-icon']),
.menu :deep(.el-sub-menu__title [class*='el-icon']) {
  color: inherit;
  font-size: 18px;
}

.sider-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 20px;
  background: #f7faff;
  border: 1px solid rgba(148, 163, 184, 0.14);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1);
}

.status-title {
  font-size: 13px;
  font-weight: 700;
  color: #172033;
}

.status-desc {
  margin-top: 2px;
  font-size: 12px;
  color: #7a8aa2;
}

.main {
  min-width: 0;
  min-height: 0;
}

.content {
  height: 100%;
  min-height: calc(100vh - 36px);
  overflow: auto;
  padding: 2px;
}

@media (max-width: 1120px) {
  .layout {
    grid-template-columns: 96px minmax(0, 1fr);
  }

  .logo {
    justify-content: center;
  }

  .logo-text,
  .nav-caption,
  .sider-footer {
    display: none;
  }

  .menu :deep(.el-menu-item span),
  .menu :deep(.el-sub-menu__title span) {
    display: none;
  }

  .menu :deep(.el-menu-item),
  .menu :deep(.el-sub-menu__title) {
    justify-content: center;
    padding-left: 0 !important;
    padding-right: 0;
  }
}

@media (max-width: 820px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sider {
    display: none;
  }
}
</style>
