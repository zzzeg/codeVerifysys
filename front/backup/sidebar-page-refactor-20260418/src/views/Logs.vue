<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import request from '../utils/request'
import { formatDateTimeCell } from '../utils/datetime'

const operationLogs = ref<any[]>([])
const loginLogs = ref<any[]>([])
const errorLogs = ref<any[]>([])
const activeTab = ref<'operation' | 'login' | 'error'>('operation')
const formatDate = formatDateTimeCell
const tableHeight = 'calc(100vh - 260px)'
const page = ref(1)
const pageSize = ref(20)

const currentTitle = computed(() => {
  if (activeTab.value === 'login') return '登录日志'
  if (activeTab.value === 'error') return '错误日志'
  return '系统日志'
})

const currentList = computed(() => {
  if (activeTab.value === 'login') return loginLogs.value
  if (activeTab.value === 'error') return errorLogs.value
  return operationLogs.value
})

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return currentList.value.slice(start, start + pageSize.value)
})

const fetchLogs = async () => {
  const [op, lg, er] = await Promise.all([
    request.get('/api/logs/operation'),
    request.get('/api/logs/login'),
    request.get('/api/logs/error'),
  ])
  operationLogs.value = op.data.data
  loginLogs.value = lg.data.data
  errorLogs.value = er.data.data
}

const switchTab = (tab: 'operation' | 'login' | 'error') => {
  activeTab.value = tab
  page.value = 1
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
}

const handleSizeChange = (nextSize: number) => {
  pageSize.value = nextSize
  page.value = 1
}

onMounted(fetchLogs)
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <section class="vs-ref-main">
        <div class="vs-ref-main-head">
          <div class="head-row">
            <h2 class="vs-ref-main-title">{{ currentTitle }}</h2>
            <div class="head-actions">
              <el-button :type="activeTab === 'operation' ? 'primary' : 'default'" @click="switchTab('operation')">操作日志</el-button>
              <el-button :type="activeTab === 'login' ? 'primary' : 'default'" @click="switchTab('login')">登录日志</el-button>
              <el-button :type="activeTab === 'error' ? 'primary' : 'default'" @click="switchTab('error')">错误日志</el-button>
            </div>
          </div>
        </div>

        <div class="vs-ref-main-body">
          <el-table v-if="activeTab === 'operation'" :data="pagedList" :max-height="tableHeight" style="width: 100%" size="small">
            <el-table-column prop="action" label="动作" />
            <el-table-column prop="user" label="用户" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>

          <el-table v-else-if="activeTab === 'login'" :data="pagedList" :max-height="tableHeight" style="width: 100%" size="small">
            <el-table-column prop="user" label="用户" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="ip" label="IP" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>

          <el-table v-else :data="pagedList" :max-height="tableHeight" style="width: 100%" size="small">
            <el-table-column prop="message" label="消息" />
            <el-table-column prop="stack" label="堆栈" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>

          <div class="pager">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              :total="currentList.length"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="handlePageChange"
              @size-change="handleSizeChange"
            />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.head-row,
.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.head-row {
  justify-content: space-between;
}

.pager {
  display: flex;
  justify-content: center;
  padding-top: 16px;
}

@media (max-width: 900px) {
  .head-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .head-actions {
    flex-wrap: wrap;
  }
}
</style>
