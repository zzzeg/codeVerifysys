<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import request from '../../utils/request'

interface ProjectItem {
  id: string
  name: string
}

interface CardTypeOption {
  label: string
  value: string
}

interface VariantItem {
  id?: string
  label: string
  price: number
  cardType: string
}

interface ProductItem {
  id: string
  projectId: string
  name: string
  summary?: string
  status?: 'draft' | 'published'
  coverUrl?: string
  allowAnonymous: boolean
  minBuy: number
  maxBuy: number
  variants: VariantItem[]
  description?: string
  linkCode: string
}

const router = useRouter()
const loading = ref(false)
const filterDrawerOpen = ref(false)
const projects = ref<ProjectItem[]>([])
const products = ref<ProductItem[]>([])
const cardTypeOptions = ref<CardTypeOption[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const filterForm = reactive({
  projectId: '',
  productName: '',
})
const appliedFilters = reactive({
  projectId: '',
  productName: '',
})

const projectNameMap = computed(() => Object.fromEntries(projects.value.map((item) => [item.id, item.name])))

const fetchProjects = async () => {
  const resp = await request.get('/api/projects', { params: { page: 1, pageSize: 200 } })
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
}

const fetchCardTypes = async () => {
  const resp = await request.get('/api/system/dict/cardType')
  cardTypeOptions.value = resp.data.data || []
}

const fetchProducts = async () => {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: page.value, pageSize: pageSize.value }
    if (appliedFilters.projectId) params.projectId = appliedFilters.projectId
    if (appliedFilters.productName.trim()) params.keyword = appliedFilters.productName.trim()
    const resp = await request.get('/api/products', { params })
    const data = resp.data.data || {}
    products.value = data.list || []
    total.value = Number(data.total || 0)
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
      await fetchProducts()
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  appliedFilters.projectId = filterForm.projectId
  appliedFilters.productName = filterForm.productName
  page.value = 1
  filterDrawerOpen.value = false
  fetchProducts()
}

const resetSearch = () => {
  filterForm.projectId = ''
  filterForm.productName = ''
  appliedFilters.projectId = ''
  appliedFilters.productName = ''
  page.value = 1
  filterDrawerOpen.value = false
  fetchProducts()
}

const handlePageChange = (value: number) => {
  page.value = value
  fetchProducts()
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchProducts()
}

const openEdit = (row: ProductItem) => {
  router.push(`/auto-delivery/edit/${row.id}`)
}

const removeProduct = async (row: ProductItem) => {
  await ElMessageBox.confirm(`确认删除商品“${row.name}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/products/${row.id}`)
  ElMessage.success('删除成功')
  await fetchProducts()
}

const openProductLink = async (row: ProductItem) => {
  const resp = await request.get(`/api/products/${row.id}/link`)
  const link = resp.data.data.link
  const code = String(link).split('/').pop()
  if (!code) {
    ElMessage.error('商品链接无效')
    return
  }
  window.open(`${window.location.origin}/buy/${code}`, '_blank', 'noopener')
}

const openMobileFilter = () => {
  filterDrawerOpen.value = true
}

onMounted(async () => {
  window.addEventListener('vs-open-auto-delivery-filter', openMobileFilter)
  await Promise.all([fetchProjects(), fetchCardTypes(), fetchProducts()])
})

onBeforeUnmount(() => {
  window.removeEventListener('vs-open-auto-delivery-filter', openMobileFilter)
})
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <span class="label">项目名称：</span>
        <el-select v-model="filterForm.projectId" class="filter-select" clearable>
          <el-option label="-所有项目-" value="" />
          <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
        <span class="label">商品名称：</span>
        <el-input v-model="filterForm.productName" class="filter-input" clearable />
        <el-button type="primary" class="vs-ref-button" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <el-drawer v-model="filterDrawerOpen" title="筛选条件" direction="rtl" size="86%" class="mobile-filter-drawer"
      append-to-body>
      <div class="mobile-filter-body">
        <div class="mobile-filter-scroll">
          <label>项目名称</label>
          <el-select v-model="filterForm.projectId" clearable>
            <el-option label="-所有项目-" value="" />
            <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
          <label>商品名称</label>
          <el-input v-model="filterForm.productName" clearable />
        </div>
        <div class="mobile-filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </div>
      </div>
    </el-drawer>

    <el-table :data="products" v-loading="loading" style="width: 100%">
      <el-table-column label="项目名称" min-width="100">
        <template #default="{ row }">
          {{ projectNameMap[row.projectId] || row.projectId }}
        </template>
      </el-table-column>
      <el-table-column prop="name" label="商品名称" min-width="140" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'draft' ? 'info' : 'success'">{{ row.status === 'draft' ? '草稿' : '已发布'
          }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="购买数(最少/最多)" width="160" align="center">
        <template #default="{ row }">
          {{ row.minBuy }}/{{ row.maxBuy }}
        </template>
      </el-table-column>
      <!-- <el-table-column label="允许售卡类型" width="180" align="center">
        <template #default="{ row }">
          {{row.variants.map((item: VariantItem) => cardTypeOptions.find((option) => option.value ===
            item.cardType)?.label || item.cardType).join('、')}}
        </template>
      </el-table-column> -->
      <el-table-column label="商品链接" width="90" align="center">
        <template #default="{ row }">
          <el-link v-if="row.status !== 'draft'" type="primary" @click="openProductLink(row)">商品链接</el-link>
          <span v-else class="muted">草稿无链接</span>
        </template>
      </el-table-column>
      <el-table-column prop="summary" label="简介" min-width="180" align="center" show-overflow-tooltip />
      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button type="danger" size="small" @click="removeProduct(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
        :total="total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
        @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<style scoped>
.label {
  color: #374151;
  font-size: 14px;
}

.filter-select,
.filter-input {
  width: 192px;
}

.table-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.muted {
  color: #909399;
  font-size: 12px;
}
</style>
