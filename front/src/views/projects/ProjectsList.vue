<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import AppPagination from '../../components/common/AppPagination.vue'
import request from '../../utils/request'
import { useAuthStore } from '../../store/auth'
import { isAdminUser } from '../../utils/authScope'

interface ProjectItem {
  id: string
  publicId?: string
  name: string
  description?: string
  remark?: string
  developerUsername?: string
  developerCode?: string
}

const filters = reactive({ keyword: '', notice: '', developerKeyword: '' })
const list = ref<ProjectItem[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filterDrawerOpen = ref(false)
const tableHeight = 'var(--vs-table-max-height)'
const router = useRouter()
const auth = useAuthStore()
const canViewDeveloper = computed(() => isAdminUser(auth.currentUser))

const normalizeList = (payload: unknown): ProjectItem[] => {
  if (Array.isArray(payload)) return payload as ProjectItem[]
  if (payload && typeof payload === 'object') {
    const listValue = (payload as { list?: unknown }).list
    if (Array.isArray(listValue)) return listValue as ProjectItem[]
  }
  return []
}

const fetchList = async () => {
  loading.value = true
  try {
    const params: Record<string, string | number> = {
      keyword: filters.keyword,
      notice: filters.notice,
      page: page.value,
      pageSize: pageSize.value,
    }
    if (canViewDeveloper.value && filters.developerKeyword) params.developerKeyword = filters.developerKeyword
    const resp = await request.get('/api/projects', { params })
    const data = resp?.data?.data
    list.value = normalizeList(data)
    total.value = Number((data as { total?: number })?.total || list.value.length)
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
      await fetchList()
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = async () => {
  page.value = 1
  await fetchList()
  filterDrawerOpen.value = false
}

const resetSearch = async () => {
  filters.keyword = ''
  filters.notice = ''
  filters.developerKeyword = ''
  page.value = 1
  await fetchList()
  filterDrawerOpen.value = false
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
  fetchList()
}

const handleSizeChange = (nextSize: number) => {
  pageSize.value = nextSize
  page.value = 1
  fetchList()
}

const goToProjectCodes = (row: ProjectItem) => {
  sessionStorage.setItem(
    'codesListProjectContext',
    JSON.stringify({
      projectId: row.id,
      from: 'projects-list',
      at: Date.now(),
    }),
  )
  router.push({
    path: '/codes/list',
  })
}

const goToProjectCustomData = (row: ProjectItem) => {
  router.push({
    path: '/custom-data/list',
    query: { projectId: row.id },
  })
}

const editProject = (row: ProjectItem) => {
  router.push(`/projects/edit/${row.publicId || row.id}`)
}

const removeProject = async (row: ProjectItem) => {
  await ElMessageBox.confirm(`确定删除项目“${row.name}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/projects/${row.id}`)
  ElMessage.success('删除成功')
  await fetchList()
}

const openMobileFilter = () => {
  filterDrawerOpen.value = true
}

onMounted(() => {
  window.addEventListener('vs-open-mobile-filter', openMobileFilter)
  fetchList()
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
        <el-select v-model="filters.keyword" clearable placeholder="全部项目" style="width: 180px">
          <el-option v-for="project in list" :key="project.id" :label="project.name" :value="project.name" />
        </el-select>
        <span class="label">项目备注：</span>
        <el-input v-model="filters.notice" style="width: 180px" />
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
          <el-select v-model="filters.keyword" clearable placeholder="全部项目">
            <el-option v-for="project in list" :key="project.id" :label="project.name" :value="project.name" />
          </el-select>
          <label>项目备注</label>
          <el-input v-model="filters.notice" clearable />
          <label v-if="canViewDeveloper">开发者</label>
          <el-input v-if="canViewDeveloper" v-model="filters.developerKeyword" clearable />
        </div>
        <div class="mobile-filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </div>
      </div>
    </el-drawer>

    <el-table :data="list" :max-height="tableHeight" v-loading="loading">
      <el-table-column prop="name" label="项目名称" min-width="100" />
      <el-table-column v-if="canViewDeveloper" label="开发者" min-width="110">
        <template #default="{ row }">
          {{ row.developerUsername || row.developerCode || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="公告" min-width="100" />
      <el-table-column prop="remark" label="备注" min-width="100" />
      <el-table-column label="操作" width="220" align="center">
        <template #default="{ row }">
          <el-link type="primary" @click="editProject(row)">编辑</el-link>
          <el-link type="primary" style="margin-left: 8px" @click="goToProjectCodes(row)">注册码</el-link>
          <el-link type="primary" style="margin-left: 8px" @click="goToProjectCustomData(row)">自定义数据</el-link>
          <el-link type="danger" style="margin-left: 8px" @click="removeProject(row)">删除</el-link>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <AppPagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
        :total="total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
        @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<style scoped>
.label {
  color: #4b5563;
  font-size: 14px;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}
</style>
