<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../utils/request'

interface SettlementOrder {
  id: string
  productName: string
  creatorUsername: string
  buyerEmail: string
  amount: number
  settlementStatus: string
  settleAt?: number
  paidAt?: number
  deliveredAt?: number
}

const loading = ref(false)
const saving = ref(false)
const selectedRows = ref<SettlementOrder[]>([])
const orders = ref<SettlementOrder[]>([])
const config = reactive({ settlementDays: 1 })
const filters = reactive({ status: 'unsettled', keyword: '' })
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const normalizePage = () => {
  const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
}

const formatTime = (value?: number) => (value ? new Date(value).toLocaleString('zh-CN') : '-')

const fetchConfig = async () => {
  const resp = await request.get('/api/settlements/config')
  config.settlementDays = Number(resp.data.data?.settlementDays ?? 1)
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/settlements/orders', { params: { ...filters, page: page.value, pageSize: pageSize.value } })
    const data = resp.data.data || {}
    orders.value = data.list || []
    total.value = Number(data.total || 0)
    const beforePage = page.value
    normalizePage()
    if (page.value !== beforePage) await fetchOrders()
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  page.value = 1
  fetchOrders()
}

const saveConfig = async () => {
  saving.value = true
  try {
    await request.put('/api/settlements/config', { settlementDays: config.settlementDays })
    ElMessage.success('结算配置已保存')
  } finally {
    saving.value = false
  }
}

const runAutoSettlement = async () => {
  const resp = await request.post('/api/settlements/auto-run')
  ElMessage.success(`自动结算完成：${resp.data.data?.count || 0} 笔`)
  await fetchOrders()
}

const markSelectedSettled = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择订单')
  const ids = selectedRows.value.map((item) => item.id)
  const resp = await request.post('/api/settlements/mark-settled', { ids })
  ElMessage.success(`已标记 ${resp.data.data?.count || 0} 笔订单`)
  await fetchOrders()
}

const handlePageChange = (value: number) => {
  page.value = value
  selectedRows.value = []
  fetchOrders()
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
  selectedRows.value = []
  fetchOrders()
}

onMounted(async () => {
  await Promise.all([fetchConfig(), fetchOrders()])
})
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <span class="label">结算周期：</span>
        <el-input-number v-model="config.settlementDays" :min="0" :max="30" :controls="false" />
        <span class="hint">N+{{ config.settlementDays }} 自动结算</span>
        <el-button type="primary" :loading="saving" @click="saveConfig">保存配置</el-button>
        <el-button @click="runAutoSettlement">立即自动结算</el-button>
      </div>
    </div>

    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <span class="label">结算状态：</span>
        <el-select v-model="filters.status" class="filter-select">
          <el-option label="未结算" value="unsettled" />
          <el-option label="已结算" value="settled" />
          <el-option label="全部" value="" />
        </el-select>
        <span class="label">关键词：</span>
        <el-input v-model="filters.keyword" class="filter-input" clearable placeholder="订单号/邮箱/商品/开发者" />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="markSelectedSettled">标记已结算</el-button>
      </div>
    </div>

    <el-table :data="orders" v-loading="loading" @selection-change="(rows: SettlementOrder[]) => selectedRows = rows">
      <el-table-column type="selection" width="40" />
      <el-table-column prop="id" label="订单号" min-width="220" align="center" />
      <el-table-column prop="productName" label="商品" min-width="140" align="center" />
      <el-table-column prop="creatorUsername" label="开发者" min-width="120" align="center" />
      <el-table-column prop="buyerEmail" label="买家邮箱" min-width="180" align="center" />
      <el-table-column label="金额" min-width="110" align="center">
        <template #default="{ row }">￥{{ Number(row.amount || 0).toFixed(2) }}</template>
      </el-table-column>
      <el-table-column label="结算状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.settlementStatus === 'settled' ? 'success' : 'warning'">
            {{ row.settlementStatus === 'settled' ? '已结算' : '未结算' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="应结算时间" min-width="170" align="center">
        <template #default="{ row }">{{ formatTime(row.settleAt) }}</template>
      </el-table-column>
      <el-table-column label="发货时间" min-width="170" align="center">
        <template #default="{ row }">{{ formatTime(row.deliveredAt) }}</template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
        :total="total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
        @size-change="handleSizeChange" />
    </div>
  </div>
</template>

<style scoped>
.label {
  color: #374151;
  font-size: 14px;
}

.hint {
  color: #6b7280;
  font-size: 12px;
}

.filter-select,
.filter-input {
  width: 200px;
}

:deep(.el-table .cell) {
  padding: 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
