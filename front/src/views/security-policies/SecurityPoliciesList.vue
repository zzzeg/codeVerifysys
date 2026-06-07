<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import request from '../../utils/request'
import { formatDateTime } from '../../utils/datetime'
import { useAuthStore } from '../../store/auth'
import { isAdminUser } from '../../utils/authScope'

interface ProjectOption {
  id: string
  name: string
}

type PolicyStatus = 'enabled' | 'disabled'
type PolicyMode = 'basic' | 'advanced'

interface PolicyItem {
  id: string
  publicId?: string
  projectId: string
  projectName?: string
  developerUsername?: string
  developerCode?: string
  status: PolicyStatus
  mode: PolicyMode
  createdAt?: number
}

const router = useRouter()
const auth = useAuthStore()
const list = ref<PolicyItem[]>([])
const loading = ref(false)
const total = ref(0)
const projects = ref<ProjectOption[]>([])
const filters = reactive({ projectId: '', status: '', mode: '', developerKeyword: '' })
const pagination = reactive({ page: 1, pageSize: 10 })
const filterDrawerOpen = ref(false)
const tableMaxHeight = 'var(--vs-table-max-height)'
const canViewDeveloper = computed(() => isAdminUser(auth.currentUser))

const statusText = (status: PolicyStatus) => (status === 'enabled' ? '开启' : '关闭')
const modeText = (mode: PolicyMode) => (mode === 'advanced' ? '高级' : '初级')

const fetchProjects = async () => {
  const resp = await request.get('/api/projects', { params: { page: 1, pageSize: 200 } })
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
}

const fetchPolicies = async () => {
  loading.value = true
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (filters.projectId) params.projectId = filters.projectId
    if (filters.status) params.status = filters.status
    if (filters.mode) params.mode = filters.mode
    if (canViewDeveloper.value && filters.developerKeyword) params.developerKeyword = filters.developerKeyword

    const resp = await request.get('/api/security-policies', { params })
    const data = resp.data.data as any
    list.value = data?.list || []
    total.value = data?.total || 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchPolicies()
  filterDrawerOpen.value = false
}

const resetSearch = () => {
  filters.projectId = ''
  filters.status = ''
  filters.mode = ''
  filters.developerKeyword = ''
  pagination.page = 1
  fetchPolicies()
  filterDrawerOpen.value = false
}

const removePolicy = async (row: PolicyItem) => {
  await ElMessageBox.confirm('删除该安全策略吗？', '提示', { type: 'warning' })
  await request.delete(`/api/security-policies/${row.id}`)
  ElMessage.success('删除成功')
  await fetchPolicies()
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchPolicies()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  fetchPolicies()
}

const openMobileFilter = () => {
  filterDrawerOpen.value = true
}

onMounted(async () => {
  window.addEventListener('vs-open-mobile-filter', openMobileFilter)
  await fetchProjects()
  await fetchPolicies()
})

onBeforeUnmount(() => {
  window.removeEventListener('vs-open-mobile-filter', openMobileFilter)
})
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <span class="label">项目名称：</span>
        <el-select v-model="filters.projectId" filterable style="width: 220px" @change="handleSearch">
          <el-option label="全部项目" value="" />
          <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <span class="label">策略状态：</span>
        <el-select v-model="filters.status" style="width: 140px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="开启" value="enabled" />
          <el-option label="关闭" value="disabled" />
        </el-select>
        <span class="label">策略模式：</span>
        <el-select v-model="filters.mode" style="width: 140px" @change="handleSearch">
          <el-option label="全部" value="" />
          <el-option label="初级" value="basic" />
          <el-option label="高级" value="advanced" />
        </el-select>
        <span v-if="canViewDeveloper" class="label">开发者：</span>
        <el-input v-if="canViewDeveloper" v-model="filters.developerKeyword" style="width: 180px" clearable />
        <el-button type="primary" class="vs-ref-button" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <el-drawer v-model="filterDrawerOpen" title="筛选条件" direction="rtl" size="86%" class="mobile-filter-drawer"
      append-to-body>
      <div class="mobile-filter-body">
        <div class="mobile-filter-scroll">
          <label>项目名称</label>
          <el-select v-model="filters.projectId" filterable>
            <el-option label="全部项目" value="" />
            <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
          <label>策略状态</label>
          <el-select v-model="filters.status">
            <el-option label="全部" value="" />
            <el-option label="开启" value="enabled" />
            <el-option label="关闭" value="disabled" />
          </el-select>
          <label>策略模式</label>
          <el-select v-model="filters.mode">
            <el-option label="全部" value="" />
            <el-option label="初级" value="basic" />
            <el-option label="高级" value="advanced" />
          </el-select>
          <label v-if="canViewDeveloper">开发者</label>
          <el-input v-if="canViewDeveloper" v-model="filters.developerKeyword" clearable />
        </div>
        <div class="mobile-filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </div>
      </div>
    </el-drawer>

    <el-table :data="list" :max-height="tableMaxHeight" v-loading="loading" style="width: 100%">
      <el-table-column prop="projectName" label="项目名称" min-width="100">
        <template #default="{ row }">
          {{ row.projectName || row.projectId }}
        </template>
      </el-table-column>
      <el-table-column v-if="canViewDeveloper" label="开发者" min-width="110">
        <template #default="{ row }">
          {{ row.developerUsername || row.developerCode || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="策略状态" min-width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="mode" label="策略模式" min-width="90">
        <template #default="{ row }">
          {{ modeText(row.mode) }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间" min-width="180" align="center">
        <template #default="{ row }">
          {{ row.createdAt ? formatDateTime(row.createdAt) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary"
            @click="router.push(`/security-policies/edit/${row.publicId || row.id}`)">编辑</el-button>
          <el-button size="small" type="danger" @click="removePolicy(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pagination.pageSize" class="pager">
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange" @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<style scoped>
.label {
  color: #303133;
  font-size: 13px;
  white-space: nowrap;
}

.pager {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}
</style>
