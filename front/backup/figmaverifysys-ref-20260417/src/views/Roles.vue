<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../utils/request'

interface RoleItem {
  id: string
  name: string
  description?: string
  permissions: string[]
}

const list = ref<RoleItem[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<Partial<RoleItem>>({
  name: '',
  description: '',
  permissions: [],
})

const fetchRoles = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/roles')
    list.value = resp.data.data
  } finally {
    loading.value = false
  }
}

const openDialog = (row?: RoleItem) => {
  editingId.value = row?.id || null
  Object.assign(form, {
    name: row?.name || '',
    description: row?.description || '',
    permissions: row?.permissions || [],
  })
  dialogVisible.value = true
}

const saveRole = async () => {
  const payload = { ...form, permissions: (form.permissions as string[] | undefined) || [] }
  if (typeof payload.permissions === 'string') {
    payload.permissions = (payload.permissions as unknown as string).split(',').map((v) => v.trim())
  }
  if (editingId.value) {
    await request.put(`/api/roles/${editingId.value}`, payload)
    ElMessage.success('更新成功')
  } else {
    await request.post('/api/roles', payload)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
  fetchRoles()
}

const removeRole = async (row: RoleItem) => {
  await ElMessageBox.confirm(`确定删除角色 ${row.name} 吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/roles/${row.id}`)
  ElMessage.success('已删除')
  fetchRoles()
}

onMounted(fetchRoles)
</script>

<template>
  <div class="vs-app-page vs-page-shell">
    <section class="vs-page-header vs-page-header--ops">
      <div class="vs-page-copy">
        <h2 class="vs-page-title">角色管理</h2>
        <p class="vs-page-subtitle">保留现有权限模型和编辑方式，只调整管理页的区块、间距和信息层级。</p>
      </div>
      <div class="vs-meta-strip">
        <div class="vs-meta-card">
          <span>总角色数</span>
          <strong>{{ list.length }}</strong>
        </div>
      </div>
    </section>

    <el-card class="vs-panel">
      <div class="vs-page-toolbar">
        <div class="vs-toolbar-group vs-toolbar-group--end">
          <el-button type="primary" @click="openDialog()">新增角色</el-button>
        </div>
      </div>

      <el-table :data="list" v-loading="loading" style="width: 100%">
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="description" label="描述" />
        <el-table-column label="权限">
          <template #default="{ row }">
            <el-tag v-for="p in row.permissions" :key="p" type="info" style="margin-right: 4px">{{ p }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="removeRole(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑角色' : '新增角色'" width="460px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" />
        </el-form-item>
        <el-form-item label="权限标识">
          <el-select v-model="form.permissions" multiple filterable allow-create default-first-option style="width: 100%">
            <el-option label="dashboard" value="dashboard" />
            <el-option label="users" value="users" />
            <el-option label="codes" value="codes" />
            <el-option label="projects" value="projects" />
            <el-option label="products" value="products" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.vs-page-toolbar {
  margin-bottom: 18px;
}
</style>
