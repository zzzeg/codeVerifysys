<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../utils/request'
import type { ApiResp } from '../utils/request'

interface UserItem {
  id: string
  username: string
  email?: string
  phone?: string
  status: string
  roleIds: string[]
}

const query = reactive({ keyword: '' })
const list = ref<UserItem[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const page = ref(1)
const pageSize = ref(10)

const form = reactive<Partial<UserItem & { password: string }>>({
  username: '',
  email: '',
  phone: '',
  password: '',
  status: 'active',
  roleIds: [],
})

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const fetchUsers = async () => {
  loading.value = true
  try {
    const resp = await request.get<ApiResp<{ list: UserItem[] }>>('/api/users', { params: query })
    list.value = resp.data.data.list
    const maxPage = Math.max(1, Math.ceil(list.value.length / pageSize.value))
    if (page.value > maxPage) page.value = maxPage
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '获取用户失败')
  } finally {
    loading.value = false
  }
}

const openDialog = (row?: UserItem) => {
  editingId.value = row?.id || null
  Object.assign(form, {
    username: row?.username || '',
    email: row?.email || '',
    phone: row?.phone || '',
    status: row?.status || 'active',
    roleIds: row?.roleIds || [],
    password: '',
  })
  dialogVisible.value = true
}

const saveUser = async () => {
  try {
    if (editingId.value) {
      await request.put(`/api/users/${editingId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await request.post('/api/users', form)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await fetchUsers()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '保存失败')
  }
}

const removeUser = async (row: UserItem) => {
  await ElMessageBox.confirm(`确定删除用户“${row.username}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/users/${row.id}`)
  ElMessage.success('已删除')
  await fetchUsers()
}

const toggleStatus = async (row: UserItem) => {
  const newStatus = row.status === 'active' ? 'disabled' : 'active'
  await request.patch(`/api/users/${row.id}/status`, { status: newStatus })
  ElMessage.success('状态已更新')
  await fetchUsers()
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
}

const handleSizeChange = (nextSize: number) => {
  pageSize.value = nextSize
  page.value = 1
}

onMounted(fetchUsers)
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <section class="vs-ref-main">
        <div class="vs-ref-main-head">
          <div class="head-row">
            <h2 class="vs-ref-main-title">用户管理</h2>
            <el-button type="primary" @click="openDialog()">新增用户</el-button>
          </div>
        </div>

        <div class="vs-ref-main-body">
          <div class="vs-ref-toolbar">
            <el-input
              v-model="query.keyword"
              placeholder="搜索用户名或邮箱"
              style="width: 240px"
              clearable
              @clear="fetchUsers"
              @keyup.enter="fetchUsers"
            />
            <el-button type="primary" class="vs-ref-button" @click="fetchUsers">查询</el-button>
          </div>

          <el-table :data="pagedList" v-loading="loading" style="width: 100%">
            <el-table-column prop="username" label="用户名" />
            <el-table-column prop="email" label="邮箱" />
            <el-table-column prop="phone" label="电话" />
            <el-table-column prop="status" label="状态">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                  {{ row.status === 'active' ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220">
              <template #default="{ row }">
                <el-button size="small" type="primary" @click="openDialog(row)">编辑</el-button>
                <el-button size="small" :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleStatus(row)">
                  {{ row.status === 'active' ? '禁用' : '启用' }}
                </el-button>
                <el-button size="small" type="danger" @click="removeUser(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pager">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              :total="list.length"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="handlePageChange"
              @size-change="handleSizeChange"
            />
          </div>
        </div>
      </section>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑用户' : '新增用户'" width="480px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item v-if="!editingId" label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
        <el-form-item label="状态">
          <el-select v-model="form.status" style="width: 200px">
            <el-option label="启用" value="active" />
            <el-option label="禁用" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}
</style>
