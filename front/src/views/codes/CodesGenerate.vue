<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
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
const taskId = ref('')
const taskStatus = ref('')
const taskProgress = ref(0)
const taskTotal = ref(0)
let taskTimer: number | undefined
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

const progressPercentage = computed(() => (taskTotal.value ? Math.round((taskProgress.value / taskTotal.value) * 100) : 0))

const clearTaskTimer = () => {
  if (taskTimer) window.clearInterval(taskTimer)
  taskTimer = undefined
}

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
  clearTaskTimer()
  taskId.value = ''
  taskStatus.value = ''
  taskProgress.value = 0
  taskTotal.value = 0

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
    if (resp.data.data?.async) {
      taskId.value = resp.data.data.taskId
      taskStatus.value = 'running'
      taskTotal.value = Number(resp.data.data.total || form.count)
      ElMessage.success('生成任务已创建，请等待完成')
      pollGenerateTask()
      taskTimer = window.setInterval(pollGenerateTask, 1200)
      return
    }
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

const pollGenerateTask = async () => {
  if (!taskId.value) return
  const resp = await request.get(`/api/codes/generate/tasks/${taskId.value}`)
  const data = resp.data.data || {}
  taskStatus.value = data.status || ''
  taskProgress.value = Number(data.progress || 0)
  taskTotal.value = Number(data.total || taskTotal.value || 0)
  if (data.status === 'failed') {
    clearTaskTimer()
    loading.value = false
    ElMessage.error(data.error || '生成失败')
    return
  }
  if (data.status === 'done') {
    clearTaskTimer()
    const items = Array.isArray(data.items) ? data.items : []
    generated.value = items.map((it: any) => ({
      code: it.code,
      cardType: cardTypeOptions.find((item) => item.value === form.cardType)?.label || form.cardType,
      projectName: it.projectName || '',
      remark: it.remark,
    }))
    loading.value = false
    ElMessage.success('注册码生成完成')
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

onBeforeUnmount(clearTaskTimer)
</script>

<template>
  <div class="form-shell">
    <!-- <h3 class="vs-ref-section-title">注册码生成</h3> -->

    <el-form class="generate-form" label-width="auto">
      <el-form-item label="项目类型">
        <el-select v-model="form.projectName" style="width: 220px">
          <el-option v-for="p in projects" :key="p.name" :label="p.name" :value="p.name" />
        </el-select>
        <el-link style="margin-left: 12px" type="primary" @click="router.push('/projects/create')">新建项目</el-link>
        <el-link style="margin-left: 8px" type="primary" @click="refreshProjects(true)">刷新项目列表</el-link>
      </el-form-item>

      <el-form-item label="卡类型">
        <el-radio-group v-model="form.cardType" class="radio-wrap">
          <el-radio v-for="type in cardTypeOptions" :key="type.value" :label="type.value">{{ type.label }}</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="购买数量">
        <el-input-number v-model="form.count" :min="1" :max="5000" />
        <span class="hint">张</span>
        <span class="hint">超过 1000 张将进入后台任务，完成后可下载结果</span>
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="form.remark" style="width: 320px" />
        <span class="hint">可选：注册码备注信息</span>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" class="vs-ref-button action-btn" @click="handleGenerate" :loading="loading">生成注册码</el-button>
        <el-button v-if="generated.length" plain @click="handleExport">导出注册码</el-button>
      </el-form-item>
    </el-form>

    <div v-if="taskStatus === 'running'" class="task-progress">
      <div class="task-progress-head">
        <span>正在生成注册码</span>
        <strong>{{ taskProgress }} / {{ taskTotal }}</strong>
      </div>
      <el-progress :percentage="progressPercentage" />
    </div>

    <el-table v-if="generated.length" :data="generated" border>
      <el-table-column prop="code" label="注册码" />
      <el-table-column prop="cardType" label="卡类型" width="120" />
      <el-table-column prop="projectName" label="项目类型" />
      <el-table-column prop="remark" label="备注" />
    </el-table>
  </div>
</template>

<style scoped>
.generate-form {
  max-width: 920px;
  margin-bottom: 20px;
}

.radio-wrap {
  display: flex;
  gap: 10px 18px;
  flex-wrap: wrap;
}

.hint {
  margin-left: 8px;
  color: #7a8aa2;
  font-size: 12px;
}

.action-btn {
  box-shadow: none;
}

.task-progress {
  max-width: 720px;
  margin-bottom: 18px;
  padding: 14px;
  border: 1px solid #dbeafe;
  border-radius: 6px;
  background: #f8fbff;
}

.task-progress-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  color: #374151;
  font-size: 14px;
}
</style>
