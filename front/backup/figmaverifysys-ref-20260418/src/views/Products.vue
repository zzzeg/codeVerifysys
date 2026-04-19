<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import request from '../utils/request'

const cardTypes = ['小时卡', '天卡', '周卡', '月卡', '季卡', '半年卡', '年卡', '永久卡'] as const
const cardTypeKeyMap: Record<(typeof cardTypes)[number], string> = {
  小时卡: 'hour',
  天卡: 'day',
  周卡: 'week',
  月卡: 'month',
  季卡: 'quarter',
  半年卡: 'half_year',
  年卡: 'year',
  永久卡: 'permanent',
}

const cacheLabels = reactive([{ label1: '单次最少购买数量', label2: '单次最多购买数量' }])

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

const list = ref<ProductItem[]>([])
const projects = ref<ProjectItem[]>([])
const projectNameMap = ref<Record<string, string>>({})
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(10)

const form = reactive({
  name: '',
  projectId: '',
  summary: '',
  allowAnonymous: true,
  minBuy: 1,
  maxBuy: 5,
  variants: [{ label: '周卡', price: 29, cardType: 'week' }] as VariantItem[],
})

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const fetchProjects = async () => {
  const resp = await request.get('/api/projects')
  const rows = (resp.data.data || []) as any[]
  projects.value = rows.map((r) => ({ id: r.id, name: r.name }))
  projectNameMap.value = Object.fromEntries(projects.value.map((p) => [p.id, p.name]))
  if (!form.projectId) form.projectId = projects.value[0]?.id || ''
}

const normalizeVariantCardType = (variant: VariantItem) => {
  const mappedKey = (cardTypeKeyMap as Record<string, string>)[variant.cardType]
  return mappedKey ? { ...variant, cardType: mappedKey } : variant
}

const fetchProducts = async () => {
  const resp = await request.get('/api/products')
  list.value = (resp.data.data || []) as ProductItem[]
  const maxPage = Math.max(1, Math.ceil(list.value.length / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
}

const openDialog = (row?: ProductItem) => {
  editingId.value = row?.id || null
  const variants = row?.variants
    ? JSON.parse(JSON.stringify(row.variants))
    : [{ label: '周卡', price: 29, cardType: 'week' }]

  Object.assign(form, {
    name: row?.name || '',
    projectId: row?.projectId || projects.value[0]?.id || '',
    summary: row?.summary || '',
    allowAnonymous: row?.allowAnonymous ?? true,
    minBuy: row?.minBuy ?? 1,
    maxBuy: row?.maxBuy ?? 5,
    variants: (variants as VariantItem[]).map(normalizeVariantCardType),
  })

  dialogVisible.value = true
}

const addVariant = () => {
  form.variants.push({ label: '', price: 0, cardType: 'week' })
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
}

const handleSizeChange = (nextPageSize: number) => {
  pageSize.value = nextPageSize
  page.value = 1
}

const saveProduct = async () => {
  if (!form.projectId) return ElMessage.warning('请选择项目')
  if (!form.name.trim()) return ElMessage.warning('请输入商品名称')
  if (!form.variants.length) return ElMessage.warning('请至少添加一种商品类型')

  const payload = {
    name: form.name.trim(),
    projectId: form.projectId,
    summary: form.summary,
    allowAnonymous: form.allowAnonymous,
    minBuy: form.minBuy,
    maxBuy: form.maxBuy,
    variants: form.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: Number(variant.price || 0),
      cardType: variant.cardType,
    })),
  }

  if (editingId.value) {
    await request.put(`/api/products/${editingId.value}`, payload)
    ElMessage.success('更新成功')
  } else {
    await request.post('/api/products', payload)
    ElMessage.success('创建成功')
  }

  dialogVisible.value = false
  await fetchProducts()
}

const removeProduct = async (row: ProductItem) => {
  await ElMessageBox.confirm(`确认删除商品“${row.name}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/products/${row.id}`)
  ElMessage.success('已删除')
  await fetchProducts()
}

const copyLink = async (row: ProductItem) => {
  const resp = await request.get(`/api/products/${row.id}/link`)
  const link = resp.data.data.link
  await navigator.clipboard.writeText(window.location.origin + link)
  ElMessage.success('链接已复制')
}

onMounted(async () => {
  await fetchProjects()
  await fetchProducts()
})
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <section class="vs-ref-main">
        <div class="vs-ref-main-body">
          <div class="vs-page-toolbar page-actions">
            <div class="vs-toolbar-group">
              <h3 class="vs-ref-section-title section-title-inline">商品管理</h3>
            </div>
            <div class="vs-toolbar-group vs-toolbar-group--end">
              <el-button type="primary" @click="openDialog()">添加商品</el-button>
            </div>
          </div>

          <el-table :data="pagedList" style="width: 100%">
            <el-table-column label="项目名称">
              <template #default="{ row }">
                {{ projectNameMap[row.projectId] || row.projectId }}
              </template>
            </el-table-column>
            <el-table-column prop="name" label="商品名称" width="160" />
            <el-table-column label="购买数量范围" width="160">
              <template #default="{ row }">
                {{ row.minBuy }} ~ {{ row.maxBuy }}
              </template>
            </el-table-column>
            <el-table-column label="允许匿名购买" width="140">
              <template #default="{ row }">
                <el-tag :type="row.allowAnonymous ? 'success' : 'info'">
                  {{ row.allowAnonymous ? '允许' : '关闭' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="商品详情" width="120">
              <template #default="{ row }">
                <el-link type="primary" @click="copyLink(row)">复制链接</el-link>
              </template>
            </el-table-column>
            <el-table-column prop="summary" label="简介" />
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button size="small" @click="openDialog(row)">编辑</el-button>
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
      </section>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑商品' : '新增商品'" width="820px">
      <el-form :model="form" label-width="120px">
        <el-form-item label="项目名称">
          <el-select v-model="form.projectId" filterable style="width: 320px">
            <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="商品名称">
          <el-input v-model="form.name" style="width: 320px" />
        </el-form-item>
        <el-form-item label="简介">
          <el-input v-model="form.summary" type="textarea" />
        </el-form-item>
        <el-form-item label="匿名购买">
          <el-switch v-model="form.allowAnonymous" />
        </el-form-item>
        <el-form-item label="商品类型/价格">
          <div class="variants">
            <el-table :data="form.variants" style="width: 100%" border>
              <el-table-column label="类型">
                <template #default="{ row }">
                  <el-input v-model="row.label" placeholder="名称" />
                </template>
              </el-table-column>
              <el-table-column label="价格" width="180">
                <template #default="{ row }">
                  <el-input-number v-model="row.price" :min="0" :controls="false" align="left" :precision="2" />
                </template>
              </el-table-column>
              <el-table-column label="卡类型" width="200">
                <template #default="{ row }">
                  <el-select v-model="row.cardType" style="width: 160px">
                    <el-option
                      v-for="cardType in cardTypes"
                      :key="cardType"
                      :label="cardType"
                      :value="cardTypeKeyMap[cardType]"
                    />
                  </el-select>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="100">
                <template #default="{ $index }">
                  <el-button type="danger" :icon="Delete" @click="form.variants.splice($index, 1)" />
                </template>
              </el-table-column>
            </el-table>
            <el-button type="primary" style="margin-top: 10px" @click="addVariant">增加类型</el-button>
          </div>
        </el-form-item>
        <el-form-item label="商品数量">
          <el-table :data="cacheLabels" style="width: 100%" border>
            <el-table-column label="单次最少购买">
              <template #default="{ row }">
                <el-input-number
                  v-model="form.minBuy"
                  :placeholder="row.label1"
                  :min="1"
                  :max="1000"
                  :controls="false"
                  align="left"
                  :precision="0"
                />
              </template>
            </el-table-column>
            <el-table-column label="单次最多购买">
              <template #default="{ row }">
                <el-input-number
                  v-model="form.maxBuy"
                  :placeholder="row.label2"
                  :min="1"
                  :max="1000"
                  :controls="false"
                  align="left"
                  :precision="0"
                />
              </template>
            </el-table-column>
          </el-table>
          <div class="hint">商品单次购买数量最少为 1，最多为 1000。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveProduct">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-actions {
  margin-bottom: 20px;
}

.section-title-inline {
  margin: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}

.variants {
  flex: 1;
}

.hint {
  margin-top: 6px;
  color: #666;
  font-size: 12px;
}
</style>
