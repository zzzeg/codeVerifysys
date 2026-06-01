<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import request from '../../utils/request'
import type { ApiResp } from '../../utils/request'

interface UserItem {
  id: string
  username: string
  email?: string
  phone?: string
  status: string
  roleIds: string[]
}

interface RoleItem {
  id: string
  name: string
  description?: string
}

const router = useRouter()
const query = reactive({ keyword: '' })
const list = ref<UserItem[]>([])
const roles = ref<RoleItem[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const filterDrawerOpen = ref(false)
const tableHeight = 'var(--vs-table-max-height)'

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})
const roleNameMap = computed(() => Object.fromEntries(roles.value.map((role) => [role.id, role.name])))
const getRoleName = (roleId: string) => roleNameMap.value[roleId] || roleId

const fetchRoles = async () => {
  const resp = await request.get<ApiResp<RoleItem[]>>('/api/roles')
  roles.value = resp?.data?.data ?? []
}

const fetchUsers = async () => {
  loading.value = true
  try {
    const resp = await request.get<ApiResp<{ list: UserItem[] }>>('/api/users', { params: query })
    list.value = resp?.data?.data?.list ?? []
    const maxPage = Math.max(1, Math.ceil(list.value.length / pageSize.value))
    if (page.value > maxPage) page.value = maxPage
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '获取用户失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  page.value = 1
  await fetchUsers()
  filterDrawerOpen.value = false
}

const resetSearch = async () => {
  query.keyword = ''
  page.value = 1
  await fetchUsers()
  filterDrawerOpen.value = false
}

const removeUser = async (row: UserItem) => {
  await ElMessageBox.confirm(`确定删除用户“${row.username}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/users/${row.id}`)
  ElMessage.success('已删除')
  await fetchUsers()
}

const toggleStatus = async (row: UserItem) => {
  const newStatus = row.status === 'active' ? 'disabled' : 'active'
  await request.patch(`/api/users/${row.id}/status`, { status: newStatus })
  ElMessage.success('状态已更新')
  await fetchUsers()
}

const resetPassword = async (row: UserItem) => {
  await ElMessageBox.confirm(`确定将用户“${row.username}”的密码重置为 123456 吗？`, '提示', { type: 'warning' })
  await request.post(`/api/users/${row.id}/reset-pwd`, { password: '123456' })
  ElMessage.success('密码已重置为 123456')
}

const handlePageChange = (value: number) => {
  page.value = value
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
}

const openMobileFilter = () => {
  filterDrawerOpen.value = true
}

onMounted(async () => {
  window.addEventListener('vs-open-mobile-filter', openMobileFilter)
  await Promise.all([fetchRoles(), fetchUsers()])
})

onBeforeUnmount(() => {
  window.removeEventListener('vs-open-mobile-filter', openMobileFilter)
})
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="query.keyword"
          placeholder="搜索用户名或邮箱"
          style="width: 240px"
          clearable
          @clear="handleSearch"
          @keyup.enter="handleSearch"
        />
        <el-button type="primary" class="vs-ref-button" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <el-drawer v-model="filterDrawerOpen" title="筛选条件" direction="rtl" size="86%" class="mobile-filter-drawer" append-to-body>
      <div class="mobile-filter-body">
        <div class="mobile-filter-scroll">
          <label>关键词</label>
          <el-input v-model="query.keyword" placeholder="搜索用户名或邮箱" clearable @keyup.enter="handleSearch" />
        </div>
        <div class="mobile-filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </div>
      </div>
    </el-drawer>

    <el-table :data="pagedList" :max-height="tableHeight" v-loading="loading" style="width: 100%">
      <el-table-column prop="username" label="用户名" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column prop="phone" label="电话" />
      <el-table-column label="角色" min-width="180">
        <template #default="{ row }">
          <div class="role-tags">
            <el-tag v-for="roleId in row.roleIds" :key="roleId" type="info">
              {{ getRoleName(roleId) }}
            </el-tag>
            <span v-if="!row.roleIds?.length" class="muted-text">未分配</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.status === 'active' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="300">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="router.push(`/users/edit/${row.id}`)">编辑</el-button>
          <el-button size="small" type="info" @click="resetPassword(row)">重置密码</el-button>
          <el-button size="small" :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleStatus(row)">
            {{ row.status === 'active' ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" @click="removeUser(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="list.length"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.pure-table-toolbar {
  justify-content: space-between;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.muted-text {
  color: #909399;
  font-size: 12px;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}

@media (max-width: 768px) {
  .pure-table-toolbar,
  .toolbar-left,
  .toolbar-right {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
