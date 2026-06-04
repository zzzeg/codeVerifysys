<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useAuthStore } from '../store/auth'
import request from '../utils/request'

interface NotificationItem {
  id: string
  title: string
  content: string
  category: string
  read: boolean
  createdAt: number
}

const auth = useAuthStore()
const loading = ref(false)
const list = ref<NotificationItem[]>([])
const publishDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const form = reactive({ title: '', content: '', category: 'system' })
const rules: FormRules<typeof form> = {
  title: [{ required: true, whitespace: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, whitespace: true, message: '请输入内容', trigger: 'blur' }],
}
const isAdmin = computed(() => {
  const user = auth.currentUser
  return user?.username === 'admin' || user?.roles?.includes('role-admin') || user?.permissions?.includes('*')
})
const normalizePage = () => {
  const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
}

const fetchList = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/notifications', { params: { page: page.value, pageSize: pageSize.value } })
    const data = resp.data.data || {}
    list.value = data.list || []
    total.value = Number(data.total || 0)
    const beforePage = page.value
    normalizePage()
    if (page.value !== beforePage) await fetchList()
  } finally {
    loading.value = false
  }
}

const markRead = async (row: NotificationItem) => {
  await request.put(`/api/notifications/${row.id}/read`)
  row.read = true
}

const readAll = async () => {
  await request.post('/api/notifications/read-all')
  list.value = list.value.map((item) => ({ ...item, read: true }))
}

const remove = async (row: NotificationItem) => {
  await request.delete(`/api/notifications/${row.id}`)
  await fetchList()
}

const handlePageChange = (value: number) => {
  page.value = value
  fetchList()
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchList()
}

const publish = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  await request.post('/api/notifications', form)
  ElMessage.success('通知已发布')
  publishDialogVisible.value = false
  form.title = ''
  form.content = ''
  await fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <el-button type="primary" @click="readAll">全部已读</el-button>
        <el-button v-if="isAdmin" @click="publishDialogVisible = true">发布通知</el-button>
      </div>
    </div>

    <el-table :data="list" v-loading="loading">
      <el-table-column label="状态" width="88">
        <template #default="{ row }">
          <el-tag :type="row.read ? 'info' : 'warning'">{{ row.read ? '已读' : '未读' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="content" label="内容" min-width="280" show-overflow-tooltip />
      <el-table-column prop="category" label="类型" width="110" />
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.read" size="small" type="primary" @click="markRead(row)">已读</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-dialog v-model="publishDialogVisible" title="发布通知" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="类型">
          <el-select v-model="form.category">
            <el-option label="系统公告" value="system" />
            <el-option label="待办提醒" value="todo" />
            <el-option label="订单提醒" value="order" />
            <el-option label="结算提醒" value="settlement" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题" prop="title">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="publish">发布</el-button>
      </template>
    </el-dialog>
  </div>
</template>
