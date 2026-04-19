<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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
  永久卡: 'permanent'
}

const cacheLabels = reactive([{
  laebl1: '单次最少购买数量',
  label2: '单次最多购买数量'
}])

interface VariantItem {
  id?: string
  label: string
  price: number
  cardType: string // 后端存 key：hour/day/week/...
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

const form = reactive<{
  name: string
  projectId: string
  summary: string
  allowAnonymous: boolean
  minBuy: number
  maxBuy: number
  variants: VariantItem[]
}>({
  name: '',
  projectId: '',
  summary: '',
  allowAnonymous: true,
  minBuy: 1,
  maxBuy: 5,
  variants: [{ label: '周卡', price: 29, cardType: 'week' }]
})

const fetchProjects = async () => {
  const resp = await request.get('/api/projects')
  const rows = (resp.data.data || []) as any[]
  projects.value = rows.map((r) => ({ id: r.id, name: r.name }))
  projectNameMap.value = Object.fromEntries(projects.value.map((p) => [p.id, p.name]))
  if (!form.projectId) form.projectId = projects.value[0]?.id || ''
}

const normalizeVariantCardType = (v: VariantItem) => {
  const maybeKey = (cardTypeKeyMap as any)[v.cardType]
  if (maybeKey) return { ...v, cardType: maybeKey }
  return v
}

const fetchProducts = async () => {
  const resp = await request.get('/api/products')
  list.value = (resp.data.data || []) as ProductItem[]
}

const openDialog = (row?: ProductItem) => {
  editingId.value = row?.id || null
  const variants = row?.variants ? JSON.parse(JSON.stringify(row.variants)) : [{ label: '周卡', price: 29, cardType: 'week' }]
  Object.assign(form, {
    name: row?.name || '',
    projectId: row?.projectId || projects.value[0]?.id || '',
    summary: row?.summary || '',
    allowAnonymous: row?.allowAnonymous ?? true,
    minBuy: row?.minBuy ?? 1,
    maxBuy: row?.maxBuy ?? 5,
    variants: (variants as VariantItem[]).map(normalizeVariantCardType)
  })
  dialogVisible.value = true
}

const addVariant = () => {
  form.variants.push({ label: '', price: 0, cardType: 'week' })
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
    variants: form.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: Number(v.price || 0),
      cardType: v.cardType
    }))
  }

  if (editingId.value) {
    await request.put(`/api/products/${editingId.value}`, payload)
    ElMessage.success('更新成功')
  } else {
    await request.post('/api/products', payload)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  fetchProducts()
}

const removeProduct = async (row: ProductItem) => {
  await ElMessageBox.confirm(`删除商品 ${row.name} 吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/products/${row.id}`)
  ElMessage.success('已删除')
  fetchProducts()
}

const copyLink = async (row: ProductItem) => {
  const resp = await request.get('/api/products/' + row.id + '/link')
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
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>商品管理</div>
        <el-button type="primary" @click="openDialog()">新增商品</el-button>
      </div>
    </template>

    <el-table :data="list" style="width: 100%">
      <el-table-column label="项目名称">
        <template #default="{ row }">{{ projectNameMap[row.projectId] || row.projectId }}</template>
      </el-table-column>
      <el-table-column prop="name" label="商品名称" width="160" />
      <el-table-column label="购买数最小/最大" width="160">
        <template #default="{ row }">{{ row.minBuy }} ~ {{ row.maxBuy }}</template>
      </el-table-column>
      <el-table-column label="允许匿名购买" width="120">
        <template #default="{ row }">
          <el-tag :type="row.allowAnonymous ? 'success' : 'info'">{{ row.allowAnonymous ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="商品链接" width="140">
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
  </el-card>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑商品' : '新增商品'" width="820px">
    <el-form :model="form" label-width="120px">
      <el-form-item label="项目名称">
        <el-select v-model="form.projectId" filterable style="width: 320px">
          <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
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
                  <el-option v-for="t in cardTypes" :key="t" :label="t" :value="cardTypeKeyMap[t]" />
                </el-select>
                <!-- <span class="muted" v-if="row.cardType && cardTypeLabelMap[row.cardType]">
                  {{ cardTypeLabelMap[row.cardType] }}
                </span> -->
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ $index }">
                <el-button type="danger" :icon="Delete" @click="form.variants.splice($index, 1)" />
              </template>
            </el-table-column>
          </el-table>

          <el-button type="primary" style="margin-top: 10px" @click="addVariant">增加</el-button>
        </div>
      </el-form-item>

      <el-form-item label="商品数量">
        <el-table :data="cacheLabels" style="width: 100%" border>
            <el-table-column label="单次最少购买">
              <template #default="{ row }">
                <el-input-number v-model="form.minBuy" :placeholder="row.label1" :min="1" :max="1000" :controls="false" align="left" :precision="0" />
              </template>
            </el-table-column>
            <el-table-column label="单次最多购买">
              <template #default="{ row }">
                <el-input-number v-model="form.maxBuy" :placeholder="row.label2" :min="1" :max="1000" :controls="false" align="left" :precision="0" />
              </template>
            </el-table-column>
        </el-table>

        <!-- <div class="inline">
          <span>单次最少</span>
          <el-input-number v-model="form.minBuy" :min="1" :max="1000" :controls="false" align="left" :precision="0" />
          <span>单次最多</span>
          <el-input-number v-model="form.maxBuy" :min="1" :max="1000" :controls="false" align="left" :precision="0" />
        </div> -->
        <div class="hint">商品单次购买数量最少为 1，最大为 1000</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveProduct">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.variants {
  flex: 1;
}
.inline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.hint {
  margin-top: 6px;
  color: #666;
  font-size: 12px;
}
.muted {
  margin-left: 8px;
  color: #999;
  font-size: 12px;
}
</style>
