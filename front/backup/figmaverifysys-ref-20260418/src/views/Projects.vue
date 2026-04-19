<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../utils/request'

interface ProjectItem {
  id: string
  name: string
  description?: string
  stats?: { totalCodes: number; activeCodes: number }
}

const list = ref<ProjectItem[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<Partial<ProjectItem>>({
  name: '',
  description: '',
})

const fetchProjects = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/projects')
    list.value = resp.data.data
  } finally {
    loading.value = false
  }
}

const openDialog = (row?: ProjectItem) => {
  editingId.value = row?.id || null
  Object.assign(form, { name: row?.name || '', description: row?.description || '' })
  dialogVisible.value = true
}

const saveProject = async () => {
  if (editingId.value) {
    await request.put(`/api/projects/${editingId.value}`, form)
  } else {
    await request.post('/api/projects', form)
  }
  ElMessage.success('保存成功')
  dialogVisible.value = false
  fetchProjects()
}

const removeProject = async (row: ProjectItem) => {
  await ElMessageBox.confirm(`删除项目 ${row.name} 将无法恢复，确认吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/projects/${row.id}`)
  ElMessage.success('已删除')
  fetchProjects()
}

onMounted(fetchProjects)
</script>

<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <div>项目管理</div>
        <el-button type="primary" @click="openDialog()">新增项目</el-button>
      </div>
    </template>
    <el-table :data="list" v-loading="loading" style="width: 100%">
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="description" label="简介" />
      <el-table-column label="注册码统计" width="180">
        <template #default="{ row }">
          <div>总数：{{ row.stats?.totalCodes ?? '--' }}</div>
          <div>可用：{{ row.stats?.activeCodes ?? '--' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button size="small" @click="openDialog(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="removeProject(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑项目' : '新增项目'" width="480px">
    <el-form :model="form" label-width="90px">
      <el-form-item label="名称">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="简介">
        <el-input v-model="form.description" type="textarea" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="saveProject">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
