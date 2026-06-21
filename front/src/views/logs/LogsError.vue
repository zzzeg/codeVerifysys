<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppPagination from '../../components/common/AppPagination.vue'
import request from '../../utils/request'
import { formatDateTimeCell } from '../../utils/datetime'

const list = ref<any[]>([])
const page = ref(1)
const pageSize = ref(30)
const total = ref(0)

const fetchLogs = async () => {
  const resp = await request.get('/api/logs/error', { params: { page: page.value, pageSize: pageSize.value } })
  list.value = resp.data.data.list || []
  total.value = Number(resp.data.data.total || 0)
}

const handlePageChange = (value: number) => {
  page.value = value
  fetchLogs()
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchLogs()
}

onMounted(fetchLogs)
</script>

<template>
  <div class="log-page">
    <el-table :data="list" height="100%" style="width: 100%" size="small">
      <el-table-column prop="message" label="消息" min-width="100" />
      <el-table-column prop="stack" label="堆栈" min-width="100" />
      <el-table-column prop="createdAt" label="时间" :formatter="formatDateTimeCell" min-width="150" />
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <AppPagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[20, 30, 50, 100]"
        :total="total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
        @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<style scoped>
.pager {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}

:deep(.el-table .cell) {
  padding: 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
