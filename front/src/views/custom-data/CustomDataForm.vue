<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'

interface ProjectOption {
  id: string
  name: string
}

interface CustomDataItem {
  id: string
  projectId: string
  key: string
  value: string
  remark?: string
}

const route = useRoute()
const router = useRouter()
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!editingId.value)
const loading = ref(false)
const formRef = ref<FormInstance>()
const projects = ref<ProjectOption[]>([])

const form = reactive<Partial<CustomDataItem>>({ projectId: '', key: '', value: '', remark: '' })

const rules: FormRules<typeof form> = {
  projectId: [{ required: true, message: '请选择项目', trigger: 'change' }],
  key: [{ required: true, whitespace: true, message: '请输入 Key', trigger: 'blur' }],
}

const fetchProjects = async () => {
  const resp = await request.get('/api/projects', { params: { page: 1, pageSize: 200 } })
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
  if (!form.projectId) form.projectId = projects.value[0]?.id || ''
}

const fetchDetail = async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const resp = await request.get(`/api/custom-data/${editingId.value}`)
    const target = resp.data.data as CustomDataItem | undefined
    if (target) Object.assign(form, target)
  } finally {
    loading.value = false
  }
}

const saveData = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    projectId: form.projectId,
    key: form.key,
    value: form.value,
    remark: form.remark,
  }

  if (isEdit.value) {
    await request.put(`/api/custom-data/${editingId.value}`, payload)
  } else {
    await request.post('/api/custom-data', payload)
  }

  ElMessage.success('保存成功')
  router.push('/custom-data/list')
}

onMounted(async () => {
  await fetchProjects()
  await fetchDetail()
})
</script>

<template>
  <div class="form-shell" v-loading="loading">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" class="data-form">
      <el-form-item label="项目名称" prop="projectId">
        <el-select v-model="form.projectId" filterable style="width: 100%">
          <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="Key" prop="key">
        <el-input v-model="form.key" />
      </el-form-item>
      <el-form-item label="Value">
        <el-input v-model="form.value" type="textarea" :rows="5" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="4" />
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/custom-data/list')">返回列表</el-button>
        <el-button type="primary" @click="saveData">确认保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.form-shell {
  max-width: 760px;
}
</style>
