<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'
import { useUnsavedChangesGuard } from '../../composables/useUnsavedChangesGuard'
import SimpleEditor from '../../components/SimpleEditor.vue'

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
  addonMode?: boolean
  minBuy: number
  maxBuy: number
  variants: VariantItem[]
  description?: string
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const formRef = ref<FormInstance>()
const projects = ref<ProjectItem[]>([])
const cardTypeOptions = ref<CardTypeOption[]>([])
const formLabelPosition = ref<'right' | 'top'>('right')
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => route.path.startsWith('/auto-delivery/edit/') && !!editingId.value)

const syncFormLabelPosition = () => {
  formLabelPosition.value = window.innerWidth <= 720 ? 'top' : 'right'
}

const form = reactive({
  projectId: '',
  name: '',
  status: 'published' as 'draft' | 'published',
  coverUrl: '',
  allowAnonymous: true,
  addonMode: false,
  summary: '',
  description: '',
  minBuy: 1,
  maxBuy: 10,
  variants: [] as VariantItem[],
})
const { resetBaseline, markSaved } = useUnsavedChangesGuard({
  getSnapshot: () => form,
})

const validateVariants = (_rule: unknown, value: VariantItem[], callback: (error?: Error) => void) => {
  if (!value.length) {
    callback(new Error('请至少添加一种商品类型'))
    return
  }
  if (value.some((item) => !item.label.trim() || !item.cardType)) {
    callback(new Error('请完善商品类型与卡类型'))
    return
  }
  if (value.some((item) => Number(item.price) < 0 || Number.isNaN(Number(item.price)))) {
    callback(new Error('商品价格必须为非负数'))
    return
  }
  callback()
}

const validateBuyRange = (_rule: unknown, _value: number, callback: (error?: Error) => void) => {
  const minBuy = Number(form.minBuy)
  const maxBuy = Number(form.maxBuy)
  if (!Number.isFinite(minBuy) || minBuy < 1) {
    callback(new Error('最少购买数量不能小于 1'))
    return
  }
  if (!Number.isFinite(maxBuy) || maxBuy < 1) {
    callback(new Error('最多购买数量不能小于 1'))
    return
  }
  if (minBuy > maxBuy) {
    callback(new Error('最少购买数量不能大于最大购买数量'))
    return
  }
  callback()
}

/**
 * 校验商品描述是否包含有效内容
 * @param _rule 校验规则
 * @param value 商品描述HTML
 * @param callback 校验回调
 * @returns 无
 */
const validateDescription = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  // 1. 统一兜底空值，避免 replace 调用异常
  const html = String(value || '')
  // 2. 移除图片标签后提取纯文本，用于判断文本内容是否为空
  const textContent = html
    .replace(/<img[\s\S]*?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, '')
  // 3. 同时保留图片场景，允许仅上传图片也通过校验
  const hasImage = /<img[\s\S]*?>/i.test(html)

  if (!textContent && !hasImage) {
    callback(new Error('请输入商品描述'))
    return
  }
  callback()
}

const rules: FormRules<typeof form> = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  name: [{ required: true, whitespace: true, message: '请输入商品名称', trigger: 'blur' }],
  summary: [
    { required: true, whitespace: true, message: '请输入商品简介', trigger: 'blur' },
    { max: 200, message: '商品简介不能超过 200 个字符', trigger: 'blur' },
  ],
  description: [{ validator: validateDescription, trigger: 'blur' }],
  variants: [{ validator: validateVariants, trigger: 'change' }],
  minBuy: [{ validator: validateBuyRange, trigger: 'change' }],
  maxBuy: [{ validator: validateBuyRange, trigger: 'change' }],
}

const validateBuyQuantity = () => {
  formRef.value?.validateField('minBuy')
}

const resetForm = () => {
  form.projectId = projects.value[0]?.id || ''
  form.name = ''
  form.status = 'published'
  form.coverUrl = ''
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
  const resp = await request.get('/api/projects', { params: { page: 1, pageSize: 200 } })
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
  if (!form.projectId) form.projectId = projects.value[0]?.id || ''
}

const fetchCardTypes = async () => {
  const resp = await request.get('/api/system/dict/cardType')
  cardTypeOptions.value = resp.data.data || []
}

const fillForm = (row: ProductItem) => {
  form.projectId = row.projectId
  form.name = row.name
  form.status = row.status || 'published'
  form.coverUrl = row.coverUrl || ''
  form.allowAnonymous = row.allowAnonymous
  form.addonMode = Boolean(row.addonMode)
  form.summary = row.summary || ''
  form.description = row.description || ''
  form.minBuy = row.minBuy
  form.maxBuy = row.maxBuy
  form.variants = row.variants?.length ? JSON.parse(JSON.stringify(row.variants)) : []
  if (!form.variants.length) addVariantRow()
}

const fetchProductDetail = async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const resp = await request.get(`/api/products/${editingId.value}`)
    fillForm(resp.data.data)
  } finally {
    loading.value = false
  }
}

const saveProduct = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    projectId: form.projectId,
    name: form.name.trim(),
    status: form.status,
    summary: form.summary.trim(),
    allowAnonymous: form.allowAnonymous,
    addonMode: form.addonMode,
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

  markSaved()
  await router.push('/auto-delivery/list')
}

onMounted(async () => {
  syncFormLabelPosition()
  window.addEventListener('resize', syncFormLabelPosition)

  await Promise.all([fetchProjects(), fetchCardTypes()])

  if (isEdit.value) {
    await fetchProductDetail()
    resetBaseline()
    return
  }

  resetForm()
  addVariantRow()
  resetBaseline()
})

onUnmounted(() => {
  window.removeEventListener('resize', syncFormLabelPosition)
})
</script>

<template>
  <div class="form-shell" v-loading="loading">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" class="edit-form"
      :label-position="formLabelPosition">
      <el-form-item label="项目名称：" prop="projectId">
        <el-select v-model="form.projectId" filterable style="width: 320px">
          <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="商品名称：" prop="name">
        <el-input v-model="form.name" style="width: 320px" />
      </el-form-item>

      <el-form-item label="商品状态：">
        <div class="form-field">
          <el-radio-group v-model="form.status">
            <el-radio label="published">发布</el-radio>
            <el-radio label="draft">保存草稿</el-radio>
          </el-radio-group>
          <p class="hint-text">草稿商品不会对公开购买页开放，可用于编辑未完成的商品。</p>
        </div>
      </el-form-item>

      <!-- 封面图功能暂时关闭：公开购买页统一使用默认商品图，避免引入上传、检测、存储和清理成本。 -->

      <el-form-item label="匿名购买：">
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
            +卡类型，例如：tianka+abcdefghijg
          </p>
        </div>
      </el-form-item>

      <el-form-item label="商品简介：" prop="summary">
        <div class="form-field">
          <el-input v-model="form.summary" type="textarea" :rows="4" />
          <p class="hint-text">商品简介不能超过200个字符</p>
        </div>
      </el-form-item>

      <el-form-item label="商品类型/价格：" prop="variants">
        <div class="form-field wide-field">
          <el-table :data="form.variants" size="small" border style="width: 100%">
            <el-table-column label="类型" min-width="260">
              <template #default="{ row }">
                <el-input v-model="row.label" placeholder="请输入类型名称" />
              </template>
            </el-table-column>
            <el-table-column label="价格" width="160">
              <template #default="{ row }">
                <el-input-number v-model="row.price" :min="0" :controls="false" :precision="2" style="width: 120px" />
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

      <el-form-item label="商品数量：" prop="minBuy">
        <div class="form-field wide-field">
          <el-table :data="[form]" size="small" border style="width: 100%">
            <el-table-column label="单次最少购买数量">
              <template #default>
                <el-input-number v-model="form.minBuy" :min="1" :max="1000" :controls="false"
                  @change="validateBuyQuantity" />
              </template>
            </el-table-column>
            <el-table-column label="单次最多购买数量">
              <template #default>
                <el-input-number v-model="form.maxBuy" :min="1" :max="1000" :controls="false"
                  @change="validateBuyQuantity" />
              </template>
            </el-table-column>
          </el-table>
          <p class="hint-text">商品单次购买数量最少为1，最大为1000</p>
        </div>
      </el-form-item>

      <el-form-item label="商品描述：" prop="description">
        <div class="form-field wide-field">
          <SimpleEditor v-model="form.description" placeholder="请输入商品描述" min-height="320px" />
          <p class="hint-text">商品描述支持富文本格式，购买页会按图文内容展示</p>
        </div>
      </el-form-item>

      <el-form-item label=" ">
        <el-button type="primary" @click="saveProduct">确认</el-button>
        <el-button type="default" @click="router.push('/auto-delivery/list')">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.form-shell {}

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
  max-width: 920px;
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
</style>
