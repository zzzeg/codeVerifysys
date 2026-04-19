<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
const page = ref(1)
const pageSize = ref(10)
const form = reactive<Partial<RoleItem>>({ name: '', description: '', permissions: [] })

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const fetchRoles = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/roles')
    list.value = resp.data.data
    const maxPage = Math.max(1, Math.ceil(list.value.length / pageSize.value))
    if (page.value > maxPage) page.value = maxPage
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
    payload.permissions = (payload.permissions as unknown as string).split(',').map((value) => value.trim())
  }

  if (editingId.value) {
    await request.put(`/api/roles/${editingId.value}`, payload)
    ElMessage.success('更新成功')
  } else {
    await request.post('/api/roles', payload)
    ElMessage.success('创建成功')
  }

  dialogVisible.value = false
  await fetchRoles()
}

const removeRole = async (row: RoleItem) => {
  await ElMessageBox.confirm(`确定删除角色“${row.name}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/roles/${row.id}`)
  ElMessage.success('已删除')
  await fetchRoles()
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
}

const handleSizeChange = (nextSize: number) => {
  pageSize.value = nextSize
  page.value = 1
}

onMounted(fetchRoles)
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <section class="vs-ref-main">
        <div class="vs-ref-main-head">
          <div class="head-row">
            <h2 class="vs-ref-main-title">角色管理</h2>
            <el-button type="primary" @click="openDialog()">新增角色</el-button>
          </div>
        </div>

        <div class="vs-ref-main-body">
          <el-table :data="pagedList" v-loading="loading" style="width: 100%">
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="description" label="描述" />
            <el-table-column label="权限">
              <template #default="{ row }">
                <el-tag v-for="permission in row.permissions" :key="permission" type="info" style="margin-right: 4px">
                  {{ permission }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button size="small" @click="openDialog(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="removeRole(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑角色' : '新增角色'" width="460px">
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
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveRole">保存</el-button>
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
