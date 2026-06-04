<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'
import { permissionOptions } from '../../utils/permissions'

interface RoleItem {
  id: string
  name: string
  description?: string
  permissions: string[]
}

const route = useRoute()
const router = useRouter()
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!editingId.value)
const loading = ref(false)
const form = reactive<Partial<RoleItem>>({ name: '', description: '', permissions: [] })
const assignablePermissionOptions = permissionOptions.filter(
  (item) => !['*', 'dashboard', 'users', 'roles', 'logs'].includes(item.value),
)

const fetchDetail = async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const resp = await request.get(`/api/roles/${editingId.value}`)
    const target = resp.data.data as RoleItem | undefined
    if (target) {
      Object.assign(form, {
        name: target.name,
        description: target.description || '',
        permissions: target.permissions || [],
      })
    }
  } finally {
    loading.value = false
  }
}

const saveRole = async () => {
  const payload = { ...form, permissions: (form.permissions as string[] | undefined) || [] }
  if (typeof payload.permissions === 'string') {
    payload.permissions = (payload.permissions as unknown as string).split(',').map((value) => value.trim())
  }

  if (isEdit.value) {
    await request.put(`/api/roles/${editingId.value}`, payload)
    ElMessage.success('更新成功')
  } else {
    await request.post('/api/roles', payload)
    ElMessage.success('创建成功')
  }

  router.push('/roles/list')
}

onMounted(fetchDetail)
</script>

<template>
  <div class="form-shell" v-loading="loading">
    <el-form :model="form" label-width="90px">
      <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="角色"><el-input v-model="form.description" /></el-form-item>
      <el-form-item label="权限范围">
        <el-select
          v-model="form.permissions"
          multiple
          filterable
          placeholder="请选择权限范围"
          style="width: 100%"
        >
          <el-option
            v-for="item in assignablePermissionOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
            <div class="permission-option">
              <span>{{ item.label }}</span>
              <small>{{ item.value }}</small>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/roles/list')">返回列表</el-button>
        <el-button type="primary" @click="saveRole">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.form-shell {
  max-width: 520px;
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
</style>
