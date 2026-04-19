<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import request from '../../utils/request'
import { formatDateTime } from '../../utils/datetime'

interface ProjectOption {
  id: string
  name: string
}

type PolicyStatus = 'enabled' | 'disabled'
type PolicyMode = 'basic' | 'advanced'

interface PolicyItem {
  id: string
  projectId: string
  projectName?: string
  status: PolicyStatus
  mode: PolicyMode
  createdAt?: number
}

const router = useRouter()
const list = ref<PolicyItem[]>([])
const loading = ref(false)
const total = ref(0)
const projects = ref<ProjectOption[]>([])
const filters = reactive({ projectId: '', status: '', mode: '' })
const pagination = reactive({ page: 1, pageSize: 10 })
const tableMaxHeight = 'calc(100vh - 400px)'

const statusText = (status: PolicyStatus) => (status === 'enabled' ? '开启' : '关闭')
const modeText = (mode: PolicyMode) => (mode === 'advanced' ? '高级' : '初级')

const fetchProjects = async () => {
  const resp = await request.get('/api/projects')
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

    const resp = await request.get('/api/security-policies', { params })
    const data = resp.data.data as any
    if (Array.isArray(data)) {
      list.value = data
      total.value = data.length
    } else {
      list.value = data?.list || []
      total.value = data?.total || 0
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchPolicies()
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

onMounted(async () => {
  await fetchProjects()
  await fetchPolicies()
})
</script>

<template>
  <div>
    <div class="vs-ref-toolbar">
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
      <el-button type="primary" class="vs-ref-button" @click="handleSearch">查询</el-button>
    </div>

    <el-table :data="list" :max-height="tableMaxHeight" v-loading="loading" style="width: 100%">
      <el-table-column prop="projectName" label="项目名称">
        <template #default="{ row }">
          {{ row.projectName || row.projectId }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="策略状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="mode" label="策略模式" width="120">
        <template #default="{ row }">
          {{ modeText(row.mode) }}
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建时间">
        <template #default="{ row }">
          {{ row.createdAt ? formatDateTime(row.createdAt) : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="router.push(`/security-policies/edit/${row.id}`)">编辑</el-button>
          <el-button size="small" type="danger" @click="removePolicy(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
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
