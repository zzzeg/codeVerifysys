<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import request from '../../utils/request'

interface ProjectItem {
  name: string
}

type GeneratedItem = { code: string; cardType: string; projectName: string; remark?: string }

const projects = ref<ProjectItem[]>([])
const generated = ref<GeneratedItem[]>([])
const loading = ref(false)
const router = useRouter()

const form = reactive({
  projectName: '',
  cardType: 'month',
  count: 1,
  remark: '',
})

const cardTypeOptions = [
  { label: '小时卡', value: 'hour' },
  { label: '天卡', value: 'day' },
  { label: '周卡', value: 'week' },
  { label: '月卡', value: 'month' },
  { label: '季卡', value: 'quarter' },
  { label: '半年卡', value: 'half_year' },
  { label: '年卡', value: 'year' },
  { label: '永久卡', value: 'permanent' },
]

const fetchProjects = async (showMessage = false) => {
  const resp = await request.get('/api/projects/names')
  if (resp.data.code === 200) {
    projects.value = resp.data.data || []
    form.projectName = ''
    if (showMessage) ElMessage.success('已刷新项目列表')
  } else {
    ElMessage.error('获取项目列表失败')
  }
}

const refreshProjects = async (showMessage = false) => {
  await fetchProjects(showMessage)
}

const handleGenerate = async () => {
  loading.value = true

  if (form.projectName === '') {
    ElMessage.error('请先选择项目')
    loading.value = false
    return
  }

  try {
    const resp = await request.post('/api/codes/generate', {
      count: form.count,
      projectName: form.projectName,
      cardType: form.cardType || 'month',
      remark: form.remark,
      saletype: 'author_generated',
    })
    const items = resp.data.data.items as any[] | undefined
    if (Array.isArray(items) && items.length) {
      generated.value = items.map((it) => ({
        code: it.code,
        cardType: cardTypeOptions.find((item) => item.value === form.cardType)?.label || form.cardType,
        projectName: it.projectName || '',
        remark: it.remark,
      }))
    } else {
      const codes = (resp.data.data.generated || []) as string[]
      generated.value = codes.map((code) => ({
        code,
        cardType: cardTypeOptions.find((item) => item.value === form.cardType)?.label || form.cardType,
        projectName: form.projectName,
        remark: form.remark,
      }))
    }
    ElMessage.success('已生成注册码')
  } finally {
    loading.value = false
  }
}

const handleExport = () => {
  if (!generated.value.length) {
    ElMessage.info('没有可导出的数据')
    return
  }
  const blob = new Blob([generated.value.map((g) => g.code).join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'register-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(fetchProjects)
</script>

<template>
  <div class="page vs-page-shell">
    <section class="vs-page-header">
      <div>
        <h2 class="vs-page-title">注册码生成</h2>
        <p class="vs-page-subtitle">保留现有表单和导出流程，只重构层级、间距和视觉节奏。</p>
      </div>
      <div class="summary-box">
        <span>Generated</span>
        <strong>{{ generated.length }}</strong>
      </div>
    </section>

    <el-card class="form-card" shadow="hover">
      <div class="row">
        <span class="label">项目类型</span>
        <el-select v-model="form.projectName" style="width: 220px">
          <el-option v-for="p in projects" :key="p.name" :label="p.name" :value="p.name" />
        </el-select>
        <el-link style="margin-left: 12px" type="primary" @click="router.push('/projects/create')">新建项目</el-link>
        <el-link style="margin-left: 8px" type="primary" @click="refreshProjects(true)">刷新项目列表</el-link>
      </div>

      <div class="row card-types">
        <span class="label">卡类型</span>
        <el-radio-group v-model="form.cardType">
          <el-radio v-for="type in cardTypeOptions" :key="type.value" :label="type.value">{{ type.label }}</el-radio>
        </el-radio-group>
      </div>

      <div class="row">
        <span class="label">购买数量</span>
        <el-input-number v-model="form.count" :min="1" />
        <span class="hint">条</span>
      </div>

      <div class="row">
        <span class="label">备注</span>
        <el-input v-model="form.remark" style="width: 320px" />
        <span class="muted">可选：注册码备注信息</span>
      </div>

      <div class="btn-row">
        <el-button type="primary" @click="handleGenerate" :loading="loading">生成注册码</el-button>
        <el-button v-if="generated.length" plain @click="handleExport">导出注册码</el-button>
      </div>
    </el-card>

    <el-card v-if="generated.length" shadow="hover">
      <el-table :data="generated" border>
        <el-table-column prop="code" label="注册码" />
        <el-table-column prop="cardType" label="卡类型" width="120" />
        <el-table-column prop="projectName" label="项目类型" />
        <el-table-column prop="remark" label="备注" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  gap: 18px;
}

.summary-box {
  min-width: 136px;
  padding: 12px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.summary-box span {
  display: block;
  font-size: 12px;
  color: #7a8aa2;
  font-weight: 600;
}

.summary-box strong {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  line-height: 1;
  color: #172033;
}

.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.label {
  min-width: 84px;
  color: #506176;
  font-weight: 700;
}

.hint,
.muted {
  color: #7a8aa2;
  font-size: 12px;
}

.btn-row {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.card-types {
  align-items: flex-start;
}

.card-types :deep(.el-radio-group) {
  display: flex;
  gap: 10px 18px;
  flex-wrap: wrap;
}
</style>
