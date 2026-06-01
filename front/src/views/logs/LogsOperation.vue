<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import request from '../../utils/request'
import { formatDateTimeCell } from '../../utils/datetime'

const list = ref<any[]>([])
const page = ref(1)
const pageSize = ref(30)

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const fetchLogs = async () => {
  const resp = await request.get('/api/logs/operation')
  list.value = resp.data.data
}

const handlePageChange = (value: number) => {
  page.value = value
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
}

onMounted(fetchLogs)
</script>

<template>
  <div class="log-page">
    <el-table :data="pagedList" height="100%" style="width: 100%" size="small">
      <el-table-column prop="action" label="动作" />
      <el-table-column prop="user" label="用户" />
      <el-table-column prop="createdAt" label="时间" :formatter="formatDateTimeCell" />
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[20, 30, 50, 100]"
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
  padding-top: 16px;
}
</style>
