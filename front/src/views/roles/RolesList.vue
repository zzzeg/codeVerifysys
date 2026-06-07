<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import request from '../../utils/request'
import { getPermissionLabel, permissionOptions } from '../../utils/permissions'
import { useAuthStore } from '../../store/auth'

interface RoleItem {
  id: string
  name: string
  description?: string
  permissions: string[]
  isSystem?: boolean
  isDefault?: boolean
  roleType?: 'system' | 'extension'
}

type DialogMode = 'create' | 'edit' | 'system' | 'view'

const list = ref<RoleItem[]>([])
const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const editingId = ref('')
const dialogMode = ref<DialogMode>('create')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const tableHeight = 'var(--vs-table-max-height)'
const auth = useAuthStore()

const form = reactive<Partial<RoleItem>>({
  name: '',
  description: '',
  permissions: [],
})
const rules: FormRules<typeof form> = {
  name: [{ required: true, whitespace: true, message: '请输入角色名称', trigger: 'blur' }],
}
const baseRoleId = ref('role-developer')

const isEdit = computed(() => Boolean(editingId.value))
const isReadonly = computed(() => dialogMode.value === 'view')
const isSuperAdmin = computed(() => {
  const roles = auth.currentUser?.roles || []
  const username = auth.currentUser?.username || ''
  return roles.includes('role-admin') || roles.includes('*') || username === 'admin'
})
const canEditSystemPermissions = computed(() => isSuperAdmin.value && dialogMode.value !== 'view')
const isSystemMode = computed(() => (dialogMode.value === 'system' && !canEditSystemPermissions.value) || dialogMode.value === 'view')
const dialogTitle = computed(() => {
  if (dialogMode.value === 'create') return '新增扩展角色'
  if (dialogMode.value === 'system') return canEditSystemPermissions.value ? '编辑系统角色' : '编辑角色说明'
  if (dialogMode.value === 'view') return '查看角色权限'
  return '编辑扩展角色'
})
const assignablePermissionOptions = computed(() =>
  permissionOptions.filter((item) => !['*', 'dashboard', 'users', 'roles', 'logs'].includes(item.value)),
)
const resetForm = () => {
  editingId.value = ''
  dialogMode.value = 'create'
  baseRoleId.value = 'role-developer'
  Object.assign(form, {
    name: '',
    description: '',
    permissions: [],
  })
}

const fetchRoles = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/roles', { params: { page: page.value, pageSize: pageSize.value } })
    const data = resp.data.data || {}
    list.value = data.list || []
    total.value = Number(data.total || 0)
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
      await fetchRoles()
    }
  } finally {
    loading.value = false
  }
}

const openEdit = (row: RoleItem) => {
  editingId.value = row.id
  dialogMode.value = row.isSystem ? 'system' : 'edit'
  Object.assign(form, {
    name: row.name,
    description: row.description || '',
    permissions: row.permissions || [],
  })
  dialogVisible.value = true
}

const openView = (row: RoleItem) => {
  editingId.value = row.id
  dialogMode.value = 'view'
  Object.assign(form, {
    name: row.name,
    description: row.description || '',
    permissions: row.permissions || [],
  })
  dialogVisible.value = true
}

const saveRole = async () => {
  if (isReadonly.value) {
    dialogVisible.value = false
    return
  }

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    name: (form.name || '').trim(),
    description: form.description || '',
    permissions: (form.permissions as string[] | undefined) || [],
    baseRoleId: baseRoleId.value,
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await request.put(`/api/roles/${editingId.value}`, payload)
      ElMessage.success('更新成功')
    } else {
      await request.post('/api/roles', payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    await fetchRoles()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

const removeRole = async (row: RoleItem) => {
  if (row.isSystem) {
    ElMessage.warning('系统内置角色不能删除')
    return
  }
  await ElMessageBox.confirm(`确定删除角色“${row.name}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/roles/${row.id}`)
  ElMessage.success('已删除')
  await fetchRoles()
}

const handlePageChange = (value: number) => {
  page.value = value
  fetchRoles()
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchRoles()
}

onMounted(fetchRoles)
</script>

<template>
  <div class="roles-page">
    <el-table :data="list" :max-height="tableHeight" v-loading="loading" style="width: 100%">
      <el-table-column prop="name" label="角色名称" min-width="130" />
      <el-table-column label="角色类型" width="120">
        <template #default="{ row }">
          <el-tag :type="row.isSystem ? 'success' : 'info'">
            {{ row.isSystem ? '系统内置' : '扩展角色' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="注册默认" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.isDefault" type="primary">是</el-tag>
          <span v-else class="muted-text">否</span>
        </template>
      </el-table-column>
      <el-table-column prop="description" label="角色说明" min-width="160" />
      <el-table-column label="权限范围" min-width="260">
        <template #default="{ row }">
          <div class="permission-tags">
            <el-tag v-for="permission in row.permissions" :key="permission" type="info">
              {{ getPermissionLabel(permission) }}
            </el-tag>
            <span v-if="!row.permissions?.length" class="muted-text">未配置</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button v-if="row.isSystem" link type="primary" size="small" @click="openView(row)">查看权限</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">
            {{ row.isSystem ? '编辑说明' : '编辑' }}
          </el-button>
          <el-button v-if="!row.isSystem" link type="danger" size="small" @click="removeRole(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
        :total="total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
        @size-change="handleSizeChange" />
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" transition="none" destroy-on-close
      append-to-body class="role-dialog" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="role-form">
        <el-alert v-if="isSystemMode" class="role-form-alert" type="info" :closable="false" show-icon
          :title="canEditSystemPermissions ? '当前账号为超级管理员，可维护系统角色的权限与说明。' : '系统内置角色受保护，只能查看权限或维护说明，不能删除或修改核心权限。'" />
        <el-form-item v-if="dialogMode === 'create'" label="创建模板">
          <el-select v-model="baseRoleId" disabled style="width: 100%">
            <el-option label="开发者模板（注册默认角色）" value="role-developer" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" :disabled="dialogMode === 'view'" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="角色说明">
          <el-input v-model="form.description" :disabled="isReadonly" placeholder="请输入角色说明" />
        </el-form-item>
        <el-form-item label="权限范围">
          <el-select v-model="form.permissions" multiple filterable
            :disabled="dialogMode === 'view' || (dialogMode === 'system' && !canEditSystemPermissions)"
            placeholder="请选择权限范围" style="width: 100%">
            <el-option v-for="item in isSystemMode ? permissionOptions : assignablePermissionOptions" :key="item.value"
              :label="item.label" :value="item.value">
              <div class="permission-option">
                <span>{{ item.label }}</span>
                <small>{{ item.value }}</small>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="!isReadonly" type="primary" :loading="submitting" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.roles-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.role-form-alert {
  margin-bottom: 16px;
}

.muted-text {
  color: #909399;
  font-size: 12px;
}

.permission-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.permission-option small {
  color: #9ca3af;
  font-size: 12px;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}

@media (max-width: 768px) {
  :global(.role-dialog) {
    width: calc(100vw - 28px) !important;
  }
}
</style>
