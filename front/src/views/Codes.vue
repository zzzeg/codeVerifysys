<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../utils/request'
import { formatDateTime } from '../utils/datetime'

interface CodeItem {
  id: string
  code: string
  status: string
  projectId: string
  expireAt?: number
  remark?: string
}

const query = reactive({ keyword: '' })
const list = ref<CodeItem[]>([])
const loading = ref(false)

const fetchCodes = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/codes', { params: query })
    list.value = resp.data.data.list || resp.data.data
  } finally {
    loading.value = false
  }
}

const handleGenerate = async () => {
  const count = 10
  await request.post('/api/codes/generate', { count })
  ElMessage.success(`已生成 ${count} 条注册码`)
  fetchCodes()
}

const updateStatus = async (row: CodeItem, action: 'freeze' | 'unfreeze') => {
  await request.patch(`/api/codes/${row.id}/${action}`)
  ElMessage.success('状态已更新')
  fetchCodes()
}

const removeCode = async (row: CodeItem) => {
  await ElMessageBox.confirm(`确认删除注册码 ${row.code} 吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/codes/${row.id}`)
  ElMessage.success('已删除')
  fetchCodes()
}

onMounted(fetchCodes)
</script>

<template>
  <el-card>
    <template #header>
      <div class="toolbar">
        <el-input v-model="query.keyword" placeholder="按注册码搜索" style="width: 240px" clearable @keyup.enter="fetchCodes" />
        <div class="actions">
          <el-button type="primary" @click="fetchCodes">查询</el-button>
          <el-button type="success" @click="handleGenerate">快速生成10条</el-button>
        </div>
      </div>
    </template>
    <el-table :data="list" v-loading="loading" style="width: 100%">
      <el-table-column prop="code" label="注册码" />
      <el-table-column prop="projectId" label="项目" />
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : row.status === 'frozen' ? 'warning' : 'info'">{{ row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="expireAt" label="过期时间">
        <template #default="{ row }">
          {{ row.expireAt ? formatDateTime(row.expireAt) : '永久' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button size="small" @click="updateStatus(row, row.status === 'frozen' ? 'unfreeze' : 'freeze')">
            {{ row.status === 'frozen' ? '解冻' : '冻结' }}
          </el-button>
          <el-button size="small" type="danger" @click="removeCode(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.actions {
  display: flex;
  gap: 10px;
}
</style>
