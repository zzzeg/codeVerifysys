<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import request from '../../utils/request'

interface RoleItem {
  id: string
  name: string
  description?: string
  permissions: string[]
}

const router = useRouter()
const list = ref<RoleItem[]>([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const tableHeight = 'calc(100vh - 280px)'

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

const removeRole = async (row: RoleItem) => {
  await ElMessageBox.confirm(`确定删除角色“${row.name}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/roles/${row.id}`)
  ElMessage.success('已删除')
  await fetchRoles()
}

const handlePageChange = (value: number) => {
  page.value = value
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
}

onMounted(fetchRoles)
</script>

<template>
  <div>
    <el-table :data="pagedList" :max-height="tableHeight" v-loading="loading" style="width: 100%">
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
          <el-button size="small" type="primary" @click="router.push(`/roles/edit/${row.id}`)">编辑</el-button>
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
</template>

<style scoped>
.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}
</style>
