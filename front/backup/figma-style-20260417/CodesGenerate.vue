<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import request from '../../utils/request'

interface ProjectItem {
  name: string
}

const projects = ref<ProjectItem[]>([])
const router = useRouter()

const form = reactive({
  projectName: '',
  cardType: '月卡',
  count: 1,
  remark: '',
})
type GeneratedItem = { code: string; cardType: string; projectName: string; remark?: string }
const generated = ref<GeneratedItem[]>([])
const loading = ref(false)

const cardTypes = ['小时卡', '天卡', '周卡', '月卡', '季卡', '半年卡', '年卡', '永久卡']
const cardTypeKeyMap: Record<string, string> = {
  小时卡: 'hour',
  天卡: 'day',
  周卡: 'week',
  月卡: 'month',
  季卡: 'quarter',
  半年卡: 'half_year',
  年卡: 'year',
  永久卡: 'permanent',
}

const fetchProjects = async (bool=false) => {
  const resp = await request.get('/api/projects/names')
  
  if (resp.data.code == 200){
    projects.value = resp.data.data || []
    form.projectName = ''
    if(bool) {
      ElMessage.success("已刷新项目列表")
    }
  } else {
    ElMessage.error("获取项目列表失败")
  }

}

const refreshProjects = async (bool=false) => {
  await fetchProjects(bool)
}

const handleGenerate = async () => {
  loading.value = true

  if(form.projectName == '') {
    ElMessage.error('请先选择项目')
    loading.value = false
    return
  }

  try {
    const resp = await request.post('/api/codes/generate', {
      count: form.count,
      projectName: form.projectName,
      cardType: cardTypeKeyMap[form.cardType] || 'month',
      remark: form.remark,
      saletype: 'author_generated' //作者生成 author_generated，自助发卡：auto_issue
    })
    const items = resp.data.data.items as any[] | undefined
    if (Array.isArray(items) && items.length) {
      generated.value = items.map((it) => ({
        code: it.code,
        cardType: form.cardType,
        projectName: it.projectName || '',
        remark: it.remark,
      }))
    } else {
      const codes = (resp.data.data.generated || []) as string[]
      generated.value = codes.map((c) => ({
        code: c,
        cardType: form.cardType,
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
    ElMessage.info('无数据可导出')
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
  <div class="page">
    <div class="header">注册码生成</div>
    <el-card class="form-card" shadow="never">
      <div class="row">
        <span class="label">项目类型：</span>
        <el-select v-model="form.projectName" style="width: 180px">
          <el-option v-for="p in projects" :key="p.name" :label="p.name" :value="p.name" />
        </el-select>
        <el-link style="margin-left: 12px" type="primary" @click="router.push('/projects/create')">新建项目</el-link>
        <el-link style="margin-left: 8px" type="primary" @click="refreshProjects(true)">刷新项目列表</el-link>
      </div>
      <div class="row card-types">
        <span class="label">卡类型：</span>
        <el-radio-group v-model="form.cardType">
          <el-radio v-for="type in cardTypes" :key="type" :label="type">{{ type }}</el-radio>
        </el-radio-group>
      </div>
      <div class="row">
        <span class="label">购买条数：</span>
        <el-input-number v-model="form.count" :min="1" />
        <span style="margin-left: 6px">条</span>
      </div>
      <div class="row">
        <span class="label">备注：</span>
        <el-input v-model="form.remark" style="width: 240px" />
        <span class="muted">可选：注册码备注信息</span>
      </div>
      <div class="btn-row">
        <el-button type="warning" @click="handleGenerate" :loading="loading">生成注册码</el-button>
        <el-button v-if="generated.length" type="success" @click="handleExport">导出注册码</el-button>
      </div>
    </el-card>

    <el-table
      v-if="generated.length"
      :data="generated"
      border
    >
      <el-table-column prop="code" label="注册码" />
      <el-table-column prop="cardType" label="卡类型" width="120" />
      <el-table-column prop="projectName" label="项目类型" />
      <el-table-column prop="remark" label="备注" />
    </el-table>
  </div>
</template>

<style scoped>
.page {
  background: #fff;
  padding: 12px;
}
.header {
  font-weight: 700;
  color: #333;
  margin-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 8px;
}
.form-card {
  margin-bottom: 12px;
}
.row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.label {
  width: 80px;
  color: #444;
}
.muted {
  margin-left: 10px;
  color: #666;
  font-size: 12px;
}
.btn-row {
  display: flex;
  gap: 16px;
  margin-top: 10px;
}
.card-types{
  align-items: baseline;
  & :deep(.el-radio-group) {
  flex-direction: column;
  align-items: flex-start;
}
}
</style>
