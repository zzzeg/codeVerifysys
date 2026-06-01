<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Search, Refresh } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import request from '../utils/request'

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
  allowAnonymous: boolean
  minBuy: number
  maxBuy: number
  variants: VariantItem[]
  description?: string
  linkCode: string
}

const route = useRoute()
const router = useRouter()

const filterDrawerOpen = ref(false)
const loading = ref(false)
const projects = ref<ProjectItem[]>([])
const cardTypeOptions = ref<CardTypeOption[]>([])
const products = ref<ProductItem[]>([])
const projectsRequestId = ref(0)
const cardTypesRequestId = ref(0)
const productsRequestId = ref(0)
const productDetailRequestId = ref(0)

const menu = [
  { path: '/auto-delivery/list', label: '商品列表' },
  { path: '/auto-delivery/create', label: '商品添加' },
]

const filterForm = reactive({
  projectId: '',
  productName: '',
})

const form = reactive({
  projectId: '',
  name: '',
  allowAnonymous: true,
  addonMode: false,
  summary: '',
  description: '',
  minBuy: 1,
  maxBuy: 10,
  variants: [] as VariantItem[],
})

const isList = computed(() => route.path === '/auto-delivery/list')
const isCreate = computed(() => route.path === '/auto-delivery/create')
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => route.path.startsWith('/auto-delivery/edit/') && !!editingId.value)

const currentTitle = computed(() => {
  if (isEdit.value) return '编辑商品'
  if (isCreate.value) return '商品添加'
  return '自动发卡'
})

const currentSubTitle = computed(() => {
  if (isEdit.value) return '编辑商品'
  if (isCreate.value) return '商品添加'
  return '商品列表'
})

const filteredProducts = computed(() => {
  return products.value.filter((item) => {
    const matchProject = !filterForm.projectId || item.projectId === filterForm.projectId
    const matchKeyword = !filterForm.productName.trim() || item.name.includes(filterForm.productName.trim())
    return matchProject && matchKeyword
  })
})

const projectNameMap = computed(() => Object.fromEntries(projects.value.map((item) => [item.id, item.name])))

const resetForm = () => {
  form.projectId = projects.value[0]?.id || ''
  form.name = ''
  form.allowAnonymous = true
  form.addonMode = false
  form.summary = ''
  form.description = ''
  form.minBuy = 1
  form.maxBuy = 10
  form.variants = []
}

const addVariantRow = () => {
  form.variants.push({
    label: '',
    price: 0,
    cardType: cardTypeOptions.value[0]?.value || 'day',
  })
}

const removeVariantRow = (index: number) => {
  form.variants.splice(index, 1)
}

const fetchProjects = async () => {
  const requestId = ++projectsRequestId.value
  const resp = await request.get('/api/projects')
  if (requestId !== projectsRequestId.value) return
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
  if (!form.projectId) form.projectId = projects.value[0]?.id || ''
}

const fetchCardTypes = async () => {
  const requestId = ++cardTypesRequestId.value
  const resp = await request.get('/api/system/dict/cardType')
  if (requestId !== cardTypesRequestId.value) return
  cardTypeOptions.value = resp.data.data || []
}

const fetchProducts = async () => {
  const requestId = ++productsRequestId.value
  loading.value = true
  try {
    const resp = await request.get('/api/products')
    if (requestId !== productsRequestId.value) return
    products.value = resp.data.data || []
  } finally {
    if (requestId === productsRequestId.value) {
      loading.value = false
    }
  }
}

const fillForm = (row: ProductItem) => {
  form.projectId = row.projectId
  form.name = row.name
  form.allowAnonymous = row.allowAnonymous
  form.addonMode = false
  form.summary = row.summary || ''
  form.description = row.description || ''
  form.minBuy = row.minBuy
  form.maxBuy = row.maxBuy
  form.variants = row.variants?.length
    ? JSON.parse(JSON.stringify(row.variants))
    : []

  if (!form.variants.length) addVariantRow()
}

const fetchProductDetail = async () => {
  if (!isEdit.value) return
  const requestId = ++productDetailRequestId.value
  loading.value = true
  try {
    const resp = await request.get(`/api/products/${editingId.value}`)
    if (requestId !== productDetailRequestId.value) return
    fillForm(resp.data.data)
  } finally {
    if (requestId === productDetailRequestId.value) {
      loading.value = false
    }
  }
}

const handleSearch = () => {
  filterDrawerOpen.value = false
}

const resetSearch = () => {
  filterForm.projectId = ''
  filterForm.productName = ''
  filterDrawerOpen.value = false
}

const resetFiltersOnly = () => {
  filterForm.projectId = ''
  filterForm.productName = ''
}

const navigateTo = (path: string) => {
  if (route.path !== path) router.push(path)
}

const isActive = (path: string) => {
  if (path === '/auto-delivery/create') return isCreate.value || isEdit.value
  return route.path === path
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

const copyLink = async (row: ProductItem) => {
  const resp = await request.get(`/api/products/${row.id}/link`)
  const link = resp.data.data.link
  const code = String(link).split('/').pop()
  window.open(`${window.location.origin}/buy/${code}`, '_blank')
}

const saveProduct = async () => {
  if (!form.projectId) return ElMessage.warning('请选择项目')
  if (!form.name.trim()) return ElMessage.warning('请输入商品名称')
  if (!form.variants.length) return ElMessage.warning('请至少添加一种商品类型')
  if (form.summary.trim().length > 200) return ElMessage.warning('商品简介不能超过 200 个字符')
  if (form.minBuy > form.maxBuy) return ElMessage.warning('最少购买数量不能大于最大购买数量')

  const invalidVariant = form.variants.find((item) => !item.label.trim() || !item.cardType)
  if (invalidVariant) return ElMessage.warning('请完善商品类型与卡类型')
  if (form.variants.some((item) => Number(item.price) < 0 || Number.isNaN(Number(item.price)))) {
    return ElMessage.warning('商品价格必须为非负数')
  }

  const payload = {
    projectId: form.projectId,
    name: form.name.trim(),
    summary: form.summary.trim(),
    allowAnonymous: form.allowAnonymous,
    minBuy: form.minBuy,
    maxBuy: form.maxBuy,
    description: form.description.trim(),
    variants: form.variants.map((item) => ({
      id: item.id,
      label: item.label.trim(),
      price: Number(item.price || 0),
      cardType: item.cardType,
    })),
  }

  if (isEdit.value) {
    await request.put(`/api/products/${editingId.value}`, payload)
    ElMessage.success('商品更新成功')
  } else {
    await request.post('/api/products', payload)
    ElMessage.success('商品创建成功')
  }

  resetFiltersOnly()
  await router.push('/auto-delivery/list')
  await fetchProducts()
}

watch(
  () => route.path,
  async () => {
    if (isList.value) {
      await fetchProducts()
    }
    if (isCreate.value) {
      resetForm()
      if (!form.variants.length) addVariantRow()
    }
    if (isEdit.value) {
      await fetchProductDetail()
    }
  },
)

onMounted(async () => {
  await Promise.all([fetchProjects(), fetchCardTypes(), fetchProducts()])

  if (isCreate.value) {
    resetForm()
    addVariantRow()
  }

  if (isEdit.value) {
    await fetchProductDetail()
  }
})
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame auto-frame">
      <div class="vs-ref-split">
        <aside class="vs-ref-side">
          <div class="vs-ref-side-head">自动发卡</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>自动发卡</span>
              <i>/</i>
              <strong>{{ currentSubTitle }}</strong>
            </div>
            <button v-if="isList" type="button" class="mobile-side-action" @click="filterDrawerOpen = true">
              <el-icon>
                <Search />
              </el-icon>
              筛选
            </button>
            <button v-for="item in menu" :key="item.path" type="button" class="vs-ref-side-link"
              :class="{ active: isActive(item.path) }" @click="navigateTo(item.path)">
              &gt; {{ item.label }}
            </button>
          </div>
        </aside>

        <section class="vs-ref-main">
          <div class="vs-ref-main-head">
            <h2 class="vs-ref-main-title">{{ currentTitle }}</h2>
          </div>

          <div class="vs-ref-main-body auto-body">
            <template v-if="isList">
              <div class="auto-toolbar">
                <label>项目名称：</label>
                <el-select v-model="filterForm.projectId" class="filter-select" clearable>
                  <el-option label="-所有项目-" value="" />
                  <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
                </el-select>

                <label class="filter-label-gap">商品名称：</label>
                <el-input v-model="filterForm.productName" class="filter-input" />

                <el-button type="primary" @click="handleSearch">查询</el-button>
              </div>

              <el-drawer v-model="filterDrawerOpen" title="筛选条件" direction="rtl" size="86%" class="mobile-filter-drawer"
                append-to-body>
                <div class="mobile-filter-body">
                  <div class="mobile-filter-scroll">
                    <label>项目名称</label>
                    <el-select v-model="filterForm.projectId" clearable>
                      <el-option label="-所有项目-" value="" />
                      <el-option v-for="project in projects" :key="project.id" :label="project.name"
                        :value="project.id" />
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

              <el-table :data="filteredProducts" class="auto-table" style="width: 100%" v-loading="loading">
                <el-table-column label="项目名称" min-width="120">
                  <template #default="{ row }">
                    {{ projectNameMap[row.projectId] || row.projectId }}
                  </template>
                </el-table-column>
                <el-table-column prop="name" label="商品名称" min-width="120" align="center" />
                <el-table-column label="购买数/最小/最大" min-width="160" align="center">
                  <template #default="{ row }">
                    {{ row.minBuy }}/{{ row.maxBuy }}
                  </template>
                </el-table-column>
                <el-table-column label="允许售卡类型" width="180" align="center">
                  <template #default="{ row }">
                    {{row.variants.map((item: VariantItem) => cardTypeOptions.find((option) => option.value ===
                      item.cardType)?.label || item.cardType).join('、')}}
                  </template>
                </el-table-column>
                <el-table-column label="商品链接" width="110" align="center">
                  <template #default="{ row }">
                    <el-link type="primary" @click="copyLink(row)">商品链接</el-link>
                  </template>
                </el-table-column>
                <el-table-column prop="summary" label="简介" min-width="180" align="center" show-overflow-tooltip />
                <el-table-column label="操作" width="170" align="center" fixed="right">
                  <template #default="{ row }">
                    <div class="table-actions">
                      <el-button type="primary" size="small" @click="openEdit(row)">编辑</el-button>
                      <el-button type="danger" size="small" @click="removeProduct(row)">删除</el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
            </template>

            <template v-else>
              <div class="form-shell" v-loading="loading">
                <el-form label-width="auto" class="edit-form">
                  <el-form-item label="项目名称：">
                    <el-select v-model="form.projectId" filterable style="width: 320px">
                      <el-option v-for="project in projects" :key="project.id" :label="project.name"
                        :value="project.id" />
                    </el-select>
                  </el-form-item>

                  <el-form-item label="商品名称：">
                    <el-input v-model="form.name" style="width: 320px" />
                  </el-form-item>

                  <el-form-item label="*匿名购买：">
                    <div class="form-field">
                      <el-switch v-model="form.allowAnonymous" />
                      <span class="switch-status-text">{{ form.allowAnonymous ? '启用' : '关闭' }}</span>
                      <p class="hint-text">开启后，不用注册宝账户即可购买</p>
                    </div>
                  </el-form-item>

                  <el-form-item label="商品前缀：">
                    <div class="form-field">
                      <el-switch v-model="form.addonMode" />
                      <span class="switch-status-text">{{ form.addonMode ? '启用' : '关闭' }}</span>
                      <p class="hint-text">
                        商品前缀主要用于用户区分卡类型，开启后卡将改为
                        <span class="danger-text">卡类型前缀(拼音)</span>
                        +卡类型，例如：tiankaabcdefghi.js
                      </p>
                    </div>
                  </el-form-item>

                  <el-form-item label="*商品简介：">
                    <div class="form-field">
                      <el-input v-model="form.summary" type="textarea" :rows="4" />
      <p class="hint-text">商品简介不能超过200个字符</p>
                    </div>
                  </el-form-item>

                  <el-form-item label="商品类型/价格：">
                    <div class="form-field wide-field">
                      <el-table :data="form.variants" size="small" border style="width: 100%">
                        <el-table-column label="类型" min-width="260">
                          <template #default="{ row }">
                            <el-input v-model="row.label" placeholder="请输入类型名称" />
                          </template>
                        </el-table-column>
                        <el-table-column label="价格" width="160">
                          <template #default="{ row }">
                            <el-input-number v-model="row.price" :min="0" :controls="false" :precision="2"
                              style="width: 120px" />
                          </template>
                        </el-table-column>
                        <el-table-column label="卡类型" width="180">
                          <template #default="{ row }">
                            <el-select v-model="row.cardType" style="width: 140px">
                              <el-option v-for="item in cardTypeOptions" :key="item.value" :label="item.label"
                                :value="item.value" />
                            </el-select>
                          </template>
                        </el-table-column>
                        <el-table-column label="操作" width="88" align="center">
                          <template #default="{ $index }">
                            <el-button type="danger" :icon="Delete" @click="removeVariantRow($index)" />
                          </template>
                        </el-table-column>
                      </el-table>
                      <p class="warn-text">如果项目设置了解绑密码，那么解绑密码与项目设置一致，否则解绑密码定码为123456</p>
                      <el-button type="primary" @click="addVariantRow">添加</el-button>
                    </div>
                  </el-form-item>

                  <el-form-item label="*商品数量：">
                    <div class="form-field wide-field">
                      <el-table :data="[form]" size="small" border style="width: 100%">
                        <el-table-column label="单次最少购买数量">
                          <template #default>
                            <el-input-number v-model="form.minBuy" :min="1" :max="1000" :controls="false" />
                          </template>
                        </el-table-column>
                        <el-table-column label="单次最多购买数量">
                          <template #default>
                            <el-input-number v-model="form.maxBuy" :min="1" :max="1000" :controls="false" />
                          </template>
                        </el-table-column>
                      </el-table>
                      <p class="hint-text">商品单次购买数量最少为1，最大为1000</p>
                    </div>
                  </el-form-item>

                  <el-form-item label="*商品描述：">
                    <div class="form-field wide-field">
                      <el-input v-model="form.description" type="textarea" :rows="4" />
                      <p class="hint-text">商品描述换行请使用 &lt;br/&gt;</p>
                    </div>
                  </el-form-item>

                  <el-form-item label=" ">
                    <el-button type="default" @click="router.push('/auto-delivery/list')">返回列表</el-button>
                    <el-button type="primary" @click="saveProduct">确认</el-button>
                  </el-form-item>
                </el-form>
              </div>
            </template>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auto-frame {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.auto-body {
  overflow: auto;
}

.auto-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.auto-toolbar label {
  font-size: 14px;
  color: #374151;
}

.filter-select,
.filter-input {
  width: 192px;
}

.filter-label-gap {
  margin-left: 12px;
}

.auto-table {
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.table-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.form-shell {
  max-width: 920px;
}

.edit-form :deep(.el-form-item) {
  align-items: flex-start;
  margin-bottom: 20px;
}

.edit-form :deep(.el-form-item__label) {
  color: #374151;
  padding-top: 2px;
}

.edit-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.form-field {
  width: 100%;
  max-width: 720px;
}

.wide-field {
  max-width: 840px;
}

.hint-text {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
}

.danger-text {
  color: #ef4444;
}

.warn-text {
  margin: 10px 0 8px;
  font-size: 12px;
  color: #ef4444;
}

@media (max-width: 720px) {
  .auto-toolbar {
    display: none;
  }

  .edit-form :deep(.el-form-item) {
    display: block;
  }

  .edit-form :deep(.el-form-item__label) {
    display: block;
    text-align: left;
    margin-bottom: 8px;
  }
}
</style>
