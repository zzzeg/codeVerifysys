<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
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
const route = useRoute()
const list = ref<CustomDataItem[]>([])
const loading = ref(false)
const total = ref(0)
const projects = ref<ProjectOption[]>([])
const query = reactive({ projectId: '', key: '', remark: '', page: 1, pageSize: 10 })
const filterDrawerOpen = ref(false)
const tableMaxHeight = 'var(--vs-table-max-height)'

const fetchProjects = async () => {
  const resp = await request.get('/api/projects', { params: { page: 1, pageSize: 200 } })
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
  filterDrawerOpen.value = false
}

const resetSearch = () => {
  query.projectId = ''
  query.key = ''
  query.remark = ''
  query.page = 1
  query.pageSize = 10
  fetchData()
  filterDrawerOpen.value = false
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

const openMobileFilter = () => {
  filterDrawerOpen.value = true
}

const applyProjectQuery = (projectId: unknown) => {
  const nextProjectId = typeof projectId === 'string' ? projectId : ''
  if (nextProjectId === query.projectId) return
  query.projectId = nextProjectId
  query.page = 1
  fetchData()
}

onMounted(async () => {
  window.addEventListener('vs-open-mobile-filter', openMobileFilter)
  await fetchProjects()
  const initialProjectId = typeof route.query.projectId === 'string' ? route.query.projectId : ''
  if (initialProjectId) {
    query.projectId = initialProjectId
  }
  await fetchData()
})

onBeforeUnmount(() => {
  window.removeEventListener('vs-open-mobile-filter', openMobileFilter)
})

watch(
  () => route.query.projectId,
  (projectId) => {
    applyProjectQuery(projectId)
  },
)
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
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
    </div>

    <el-drawer v-model="filterDrawerOpen" title="筛选条件" direction="rtl" size="86%" class="mobile-filter-drawer"
      append-to-body>
      <div class="mobile-filter-body">
        <div class="mobile-filter-scroll">
          <label>项目名称</label>
          <el-select v-model="query.projectId" filterable>
            <el-option label="全部项目" value="" />
            <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
          <label>Key 值</label>
          <el-input v-model="query.key" clearable />
          <label>备注</label>
          <el-input v-model="query.remark" clearable />
        </div>
        <div class="mobile-filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </div>
      </div>
    </el-drawer>

    <el-table :data="list" :max-height="tableMaxHeight" v-loading="loading" style="width: 100%">
      <el-table-column prop="projectName" label="项目名称" min-width="120" />
      <el-table-column prop="key" label="Key 值" min-width="100" />
      <el-table-column prop="value" label="Value 值" min-width="120" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="140" align="center">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="router.push(`/custom-data/edit/${row.id}`)">编辑</el-button>
          <el-button size="small" type="danger" @click="removeData(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > query.pageSize" class="pager">
      <el-pagination v-model:current-page="query.page" v-model:page-size="query.pageSize"
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
