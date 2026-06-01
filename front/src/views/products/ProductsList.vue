<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import request from '../../utils/request'

interface VariantItem {
  id?: string
  label: string
  price: number
  cardType: string
}

interface ProductItem {
  id: string
  name: string
  projectId: string
  summary?: string
  allowAnonymous: boolean
  minBuy: number
  maxBuy: number
  variants: VariantItem[]
  linkCode: string
}

interface ProjectItem {
  id: string
  name: string
}

const router = useRouter()
const list = ref<ProductItem[]>([])
const projects = ref<ProjectItem[]>([])
const projectNameMap = ref<Record<string, string>>({})
const page = ref(1)
const pageSize = ref(10)
const tableMaxHeight = 'var(--vs-table-max-height)'

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const fetchProjects = async () => {
  const resp = await request.get('/api/projects')
  const rows = (resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
  projectNameMap.value = Object.fromEntries(projects.value.map((row) => [row.id, row.name]))
}

const fetchProducts = async () => {
  const resp = await request.get('/api/products')
  list.value = (resp.data.data || []) as ProductItem[]
  const maxPage = Math.max(1, Math.ceil(list.value.length / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
}

const copyLink = async (row: ProductItem) => {
  const resp = await request.get(`/api/products/${row.id}/link`)
  const link = resp.data.data.link
  const code = String(link).split('/').pop()
  await navigator.clipboard.writeText(`${window.location.origin}/buy/${code}`)
  ElMessage.success('商品链接已复制')
}

const removeProduct = async (row: ProductItem) => {
  await ElMessageBox.confirm(`确认删除商品“${row.name}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/products/${row.id}`)
  ElMessage.success('删除成功')
  await fetchProducts()
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
}

const handleSizeChange = (nextSize: number) => {
  pageSize.value = nextSize
  page.value = 1
}

onMounted(async () => {
  await fetchProjects()
  await fetchProducts()
})
</script>

<template>
  <div class="pure-table-page">
    <el-table :data="pagedList" :max-height="tableMaxHeight" style="width: 100%">
      <el-table-column label="项目名称">
        <template #default="{ row }">
          {{ projectNameMap[row.projectId] || row.projectId }}
        </template>
      </el-table-column>
      <el-table-column prop="name" label="商品名称" width="180" />
      <el-table-column label="购买数量范围" width="160">
        <template #default="{ row }">
          {{ row.minBuy }} ~ {{ row.maxBuy }}
        </template>
      </el-table-column>
      <el-table-column label="允许匿名购买" width="140">
        <template #default="{ row }">
          <el-tag :type="row.allowAnonymous ? 'success' : 'info'">
            {{ row.allowAnonymous ? '启用' : '关闭' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="商品链接" width="110">
        <template #default="{ row }">
          <el-link type="primary" @click="copyLink(row)">复制链接</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="summary" label="简介" show-overflow-tooltip />
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button size="small" type="primary" @click="router.push(`/products/edit/${row.id}`)">编辑</el-button>
          <el-button size="small" type="danger" @click="removeProduct(row)">删除</el-button>
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
.pager {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}
</style>
