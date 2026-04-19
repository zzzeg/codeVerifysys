<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import request from '../../utils/request'

interface ProjectOption {
  id: string
  name: string
}

interface CustomDataItem {
  id: string
  projectId: string
  projectName?: string
  key: string
  value: string
  remark?: string
}

const router = useRouter()
const list = ref<CustomDataItem[]>([])
const loading = ref(false)
const total = ref(0)
const projects = ref<ProjectOption[]>([])
const query = reactive({ projectId: '', key: '', remark: '', page: 1, pageSize: 10 })
const tableMaxHeight = 'calc(100vh - 400px)'

const fetchProjects = async () => {
  const resp = await request.get('/api/projects')
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize }
    if (query.projectId) params.projectId = query.projectId
    if (query.key) params.key = query.key
    if (query.remark) params.remark = query.remark
    const resp = await request.get('/api/custom-data', { params })
    list.value = resp.data.data.list || []
    total.value = resp.data.data.total || 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  query.page = 1
  fetchData()
}

const resetSearch = () => {
  query.projectId = ''
  query.key = ''
  query.remark = ''
  query.page = 1
  query.pageSize = 10
  fetchData()
}

const removeData = async (row: CustomDataItem) => {
  await ElMessageBox.confirm(`确认删除键“${row.key}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/custom-data/${row.id}`)
  ElMessage.success('删除成功')
  fetchData()
}

const handlePageChange = (page: number) => {
  query.page = page
  fetchData()
}

const handleSizeChange = (size: number) => {
  query.pageSize = size
  query.page = 1
  fetchData()
}

onMounted(async () => {
  await fetchProjects()
  await fetchData()
})
</script>

<template>
  <div>
    <div class="vs-ref-toolbar">
      <span class="label">项目名称：</span>
      <el-select v-model="query.projectId" filterable style="width: 200px">
        <el-option label="全部项目" value="" />
        <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
      </el-select>
      <span class="label">Key 值：</span>
      <el-input v-model="query.key" style="width: 220px" clearable />
      <span class="label">备注：</span>
      <el-input v-model="query.remark" style="width: 220px" clearable />
      <el-button type="primary" class="vs-ref-button" @click="handleSearch">查询</el-button>
      <el-button @click="resetSearch">重置</el-button>
    </div>

    <el-table :data="list" :max-height="tableMaxHeight" v-loading="loading" style="width: 100%">
      <el-table-column prop="projectName" label="项目名称" width="180" />
      <el-table-column prop="key" label="Key 值" min-width="180" />
      <el-table-column prop="value" label="Value 值" min-width="220" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="router.push(`/custom-data/edit/${row.id}`)">编辑</el-button>
          <el-button size="small" type="danger" @click="removeData(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
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
