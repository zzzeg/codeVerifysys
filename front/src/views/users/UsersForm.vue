<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'
import type { ApiResp } from '../../utils/request'

interface UserItem {
  id: string
  username: string
  email?: string
  phone?: string
  status: string
  roleIds: string[]
}

const route = useRoute()
const router = useRouter()
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!editingId.value)
const loading = ref(false)

const form = reactive<Partial<UserItem & { password: string }>>({
  username: '',
  email: '',
  phone: '',
  password: '',
  status: 'active',
  roleIds: [],
})

const fetchDetail = async () => {
  if (!isEdit.value) return
  loading.value = true
  try {
    const resp = await request.get<ApiResp<{ list: UserItem[] }>>('/api/users')
    const list = resp?.data?.data?.list ?? []
    const target = list.find((item) => item.id === editingId.value)
    if (target) {
      Object.assign(form, {
        username: target.username,
        email: target.email || '',
        phone: target.phone || '',
        status: target.status,
        roleIds: target.roleIds || [],
        password: '',
      })
    }
  } finally {
    loading.value = false
  }
}

const saveUser = async () => {
  try {
    if (isEdit.value) {
      await request.put(`/api/users/${editingId.value}`, form)
      ElMessage.success('更新成功')
    } else {
      await request.post('/api/users', form)
      ElMessage.success('创建成功')
    }
    router.push('/users/list')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '保存失败')
  }
}

onMounted(fetchDetail)
</script>

<template>
  <div class="form-shell" v-loading="loading">
    <el-form :model="form" label-width="90px">
      <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
      <el-form-item label="邮箱"><el-input v-model="form.email" /></el-form-item>
      <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
      <el-form-item v-if="!isEdit" label="密码"><el-input v-model="form.password" type="password" show-password /></el-form-item>
      <el-form-item label="状态">
        <el-select v-model="form.status" style="width: 200px">
          <el-option label="启用" value="active" />
          <el-option label="禁用" value="disabled" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button @click="router.push('/users/list')">返回列表</el-button>
        <el-button type="primary" @click="saveUser">保存</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.form-shell {
  max-width: 520px;
}
</style>
