<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'
import type { ApiResp } from '../../utils/request'
import { useUnsavedChangesGuard } from '../../composables/useUnsavedChangesGuard'

interface UserItem {
  id: string
  username: string
  email?: string
  phone?: string
  status: string
  roleIds: string[]
}

interface RoleItem {
  id: string
  name: string
  description?: string
}

const route = useRoute()
const router = useRouter()
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!editingId.value)
const loading = ref(false)
const formRef = ref<FormInstance>()
const roles = ref<RoleItem[]>([])
const rolesRequestId = ref(0)
const detailRequestId = ref(0)

const form = reactive<Partial<UserItem & { password: string }>>({
  username: '',
  email: '',
  phone: '',
  password: '',
  status: 'active',
  roleIds: [],
})
const selectedRoleId = ref('role-developer')
const { resetBaseline, markSaved } = useUnsavedChangesGuard({
  getSnapshot: () => ({ form, selectedRoleId: selectedRoleId.value }),
})

const validateEmail = (_rule: unknown, value: string | undefined, callback: (error?: Error) => void) => {
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    callback(new Error('邮箱格式不正确'))
    return
  }
  callback()
}

const rules: FormRules<typeof form> = {
  username: [{ required: true, whitespace: true, message: '请输入用户名', trigger: 'blur' }],
  email: [{ validator: validateEmail, trigger: 'blur' }],
}

const fetchRoles = async () => {
  const requestId = ++rolesRequestId.value
  const resp = await request.get<ApiResp<{ list: RoleItem[]; total: number }>>('/api/roles', { params: { page: 1, pageSize: 200 } })
  if (requestId !== rolesRequestId.value) return
  roles.value = resp?.data?.data?.list ?? []
  if (!isEdit.value && !selectedRoleId.value && roles.value.some((role) => role.id === 'role-developer')) {
    selectedRoleId.value = 'role-developer'
  }
}

const fetchDetail = async () => {
  if (!isEdit.value) return
  const requestId = ++detailRequestId.value
  loading.value = true
  try {
    const resp = await request.get<ApiResp<UserItem>>(`/api/users/${editingId.value}`)
    if (requestId !== detailRequestId.value) return
    const target = resp?.data?.data
    if (target) {
      Object.assign(form, {
        username: target.username,
        email: target.email || '',
        phone: target.phone || '',
        status: target.status,
        password: '',
      })
      selectedRoleId.value = target.roleIds?.[0] || 'role-developer'
    }
  } finally {
    if (requestId === detailRequestId.value) {
      loading.value = false
    }
  }
}

/**
 * 重置用户表单
 * @returns 无返回值，内部恢复新增用户默认状态
 */
const resetForm = () => {
  Object.assign(form, {
    username: '',
    email: '',
    phone: '',
    password: '',
    status: 'active',
    roleIds: [],
  })
  selectedRoleId.value = roles.value.some((role) => role.id === 'role-developer') ? 'role-developer' : roles.value[0]?.id || ''
  formRef.value?.clearValidate()
}

const saveUser = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    const payload = {
      ...form,
      username: (form.username || '').trim(),
      email: form.email?.trim() || '',
      phone: form.phone?.trim() || '',
      roleIds: selectedRoleId.value ? [selectedRoleId.value] : [],
    }
    if (isEdit.value && !payload.password) delete payload.password

    if (isEdit.value) {
      await request.put(`/api/users/${editingId.value}`, payload)
      ElMessage.success('更新成功')
    } else {
      await request.post('/api/users', payload)
      ElMessage.success('创建成功')
    }
    markSaved()
    router.push('/users/list')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '保存失败')
  }
}

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([fetchRoles(), fetchDetail()])
    if (!isEdit.value) resetForm()
    resetBaseline()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="form-shell pure-form-shell" v-loading="loading">
    <div class="pure-form-card">
      <div class="pure-form-title">基础信息</div>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="auto">
        <el-form-item label="用户名:" prop="username"><el-input v-model="form.username"
            placeholder="请输入用户名" /></el-form-item>
        <el-form-item label="邮箱:" prop="email"><el-input v-model="form.email" placeholder="请输入邮箱" /></el-form-item>
        <el-form-item label="电话:"><el-input v-model="form.phone" placeholder="请输入电话" /></el-form-item>
        <el-form-item v-if="!isEdit" label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="默认可填写初始密码" />
        </el-form-item>
        <el-form-item label="状态:">
          <el-switch v-model="form.status" active-value="active" inactive-value="disabled" />
          <span class="switch-status-text">{{ form.status === 'active' ? '启用' : '禁用' }}</span>
        </el-form-item>
        <el-form-item label="所属角色:">
          <el-select v-model="selectedRoleId" filterable placeholder="请选择用户所属角色" style="width: 100%">
            <el-option v-for="role in roles" :key="role.id" :label="role.name" :value="role.id">
              <div class="role-option">
                <span>{{ role.name }}</span>
                <small>{{ role.description || role.id }}</small>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="form-actions" label=" ">
          <el-button type="primary" @click="saveUser">保存</el-button>
          <el-button @click="router.push('/users/list')">取消</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.form-shell {
  max-width: 720px;
}

.pure-form-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}

.pure-form-title {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  color: #303133;
  font-size: 15px;
  font-weight: 700;
}

.pure-form-card :deep(.el-form) {
  padding: 18px 18px 4px;
}

.role-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.role-option small {
  color: #909399;
  font-size: 12px;
}

.form-actions {
  margin-top: 6px;
}
</style>
