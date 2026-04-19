<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'

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

const fetchDetail = async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const resp = await request.get('/api/roles')
    const target = (resp.data.data as RoleItem[]).find((item) => item.id === editingId.value)
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
      <el-form-item label="描述"><el-input v-model="form.description" /></el-form-item>
      <el-form-item label="权限标识">
        <el-select v-model="form.permissions" multiple filterable allow-create default-first-option style="width: 100%">
          <el-option label="users" value="users" />
          <el-option label="roles" value="roles" />
          <el-option label="codes" value="codes" />
          <el-option label="projects" value="projects" />
          <el-option label="products" value="products" />
          <el-option label="custom-data" value="custom-data" />
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
</style>
