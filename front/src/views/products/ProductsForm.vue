<script setup lang="ts">
import { reactive, ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'

const route = useRoute()
const router = useRouter()

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
}

interface ProjectItem {
  id: string
  name: string
}

const cacheLabels = reactive([{ label1: '单次最少购买数量', label2: '单次最多购买数量' }])
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!editingId.value)
const loading = ref(false)
const projects = ref<ProjectItem[]>([])
const projectsRequestId = ref(0)
const detailRequestId = ref(0)

const form = reactive({
  name: '',
  projectId: '',
  summary: '',
  allowAnonymous: true,
  minBuy: 1,
  maxBuy: 5,
  variants: [{ label: '周卡', price: 29, cardType: 'week' }] as VariantItem[],
})

const fetchProjects = async () => {
  const requestId = ++projectsRequestId.value
  const resp = await request.get('/api/projects')
  if (requestId !== projectsRequestId.value) return
  const rows = (resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
  if (!form.projectId) form.projectId = projects.value[0]?.id || ''
}

const fillForm = (row: ProductItem) => {
  const variants = row.variants?.length ? JSON.parse(JSON.stringify(row.variants)) : [{ label: '周卡', price: 29, cardType: 'week' }]
  Object.assign(form, {
    name: row.name,
    projectId: row.projectId,
    summary: row.summary || '',
    allowAnonymous: row.allowAnonymous,
    minBuy: row.minBuy,
    maxBuy: row.maxBuy,
    variants,
  })
}

const fetchProductDetail = async () => {
  if (!isEdit.value) return
  const requestId = ++detailRequestId.value
  loading.value = true
  try {
    const resp = await request.get(`/api/products/${editingId.value}`)
    if (requestId !== detailRequestId.value) return
    if (resp.data.data) fillForm(resp.data.data as ProductItem)
  } finally {
    if (requestId === detailRequestId.value) {
      loading.value = false
    }
  }
}

const addVariant = () => {
  form.variants.push({ label: '', price: 0, cardType: 'week' })
}

const saveProduct = async () => {
  if (!form.projectId) return ElMessage.warning('请选择项目')
  if (!form.name.trim()) return ElMessage.warning('请输入商品名称')
  if (!form.variants.length) return ElMessage.warning('请至少添加一种商品类型')
  if (form.summary.length > 200) return ElMessage.warning('商品简介不能超过 200 个字符')
  if (form.minBuy > form.maxBuy) return ElMessage.warning('最少购买数量不能大于最大购买数量')
  if (form.variants.some((variant) => !variant.label.trim() || !variant.cardType)) return ElMessage.warning('请完善商品类型与卡类型')
  if (form.variants.some((variant) => Number(variant.price) < 0 || Number.isNaN(Number(variant.price)))) return ElMessage.warning('商品价格必须为非负数')

  const payload = {
    name: form.name.trim(),
    projectId: form.projectId,
    summary: form.summary.trim(),
    allowAnonymous: form.allowAnonymous,
    minBuy: form.minBuy,
    maxBuy: form.maxBuy,
    variants: form.variants.map((variant) => ({
      id: variant.id,
      label: variant.label.trim(),
      price: Number(variant.price || 0),
      cardType: variant.cardType,
    })),
  }

  if (isEdit.value) {
    await request.put(`/api/products/${editingId.value}`, payload)
    ElMessage.success('商品更新成功')
  } else {
    await request.post('/api/products', payload)
    ElMessage.success('商品创建成功')
  }

  router.push('/products/list')
}

onMounted(async () => {
  await fetchProjects()
  await fetchProductDetail()
})
</script>

<template>
  <div class="form-shell" v-loading="loading">
    <el-form label-width="110px" class="edit-form">
      <el-form-item label="项目名称">
        <el-select v-model="form.projectId" filterable style="width: 320px">
          <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="商品名称">
        <el-input v-model="form.name" style="width: 320px" />
      </el-form-item>

      <el-form-item label="匿名购买">
        <el-switch v-model="form.allowAnonymous" />
        <span class="switch-status-text">{{ form.allowAnonymous ? '启用' : '禁用' }}</span>
      </el-form-item>

      <el-form-item label="商品简介">
        <div class="field-block">
          <el-input v-model="form.summary" type="textarea" :rows="4" />
        </div>
      </el-form-item>

      <el-form-item label="商品类型/价格">
        <div class="field-block wide-field">
          <el-table :data="form.variants" border style="width: 100%">
            <el-table-column label="类型">
              <template #default="{ row }">
                <el-input v-model="row.label" placeholder="名称" />
              </template>
            </el-table-column>
            <el-table-column label="价格" width="180">
              <template #default="{ row }">
                <el-input-number v-model="row.price" :min="0" :controls="false" :precision="2" />
              </template>
            </el-table-column>
            <el-table-column label="卡类型" width="180">
              <template #default="{ row }">
                <el-select v-model="row.cardType" style="width: 140px">
                  <el-option
                    v-for="cardType in cardTypes"
                    :key="cardType"
                    :label="cardType"
                    :value="cardTypeKeyMap[cardType]"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="88" align="center">
              <template #default="{ $index }">
                <el-button type="danger" :icon="Delete" @click="form.variants.splice($index, 1)" />
              </template>
            </el-table-column>
          </el-table>
          <el-button type="primary" class="append-btn" @click="addVariant">增加</el-button>
        </div>
      </el-form-item>

      <el-form-item label="商品数量">
        <div class="field-block wide-field">
          <el-table :data="cacheLabels" border style="width: 100%">
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
          <div class="hint">商品单次购买数量最少为 1，最大为 1000。</div>
        </div>
      </el-form-item>

      <el-form-item>
        <el-button @click="router.push('/products/list')">返回列表</el-button>
        <el-button type="primary" @click="saveProduct">确认保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.form-shell {
  max-width: 920px;
}

.edit-form :deep(.el-form-item) {
  align-items: flex-start;
  margin-bottom: 20px;
}

.field-block {
  width: 100%;
  max-width: 720px;
}

.wide-field {
  max-width: 840px;
}

.append-btn {
  margin-top: 12px;
}

.hint {
  margin-top: 8px;
  color: #6b7280;
  font-size: 12px;
}
</style>
