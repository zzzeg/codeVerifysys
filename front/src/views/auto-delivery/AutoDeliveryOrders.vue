<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import request from '../../utils/request'

interface ProductItem {
  id: string
  name: string
}

interface SoldOrderItem {
  id: string
  productId: string
  productName?: string
  buyer: string
  buyerEmail?: string
  variantId?: string
  variantLabel?: string
  quantity: number
  amount: number
  status: string
  settlementStatus?: string
  deliveryPayload?: string[]
  createdAt: number
}

const loading = ref(false)
const filterDrawerOpen = ref(false)
const products = ref<ProductItem[]>([])
const orders = ref<SoldOrderItem[]>([])
const orderDetailDialogVisible = ref(false)
const currentOrder = ref<SoldOrderItem | null>(null)
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const filterForm = reactive({
  productName: '',
  orderStartTime: '',
  orderEndTime: '',
})

const fetchProducts = async () => {
  const resp = await request.get('/api/products')
  products.value = resp.data.data || []
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: page.value, pageSize: pageSize.value }
    if (filterForm.productName.trim()) params.productName = filterForm.productName.trim()
    if (filterForm.orderStartTime) params.startTime = String(new Date(filterForm.orderStartTime).getTime())
    if (filterForm.orderEndTime) params.endTime = String(new Date(`${filterForm.orderEndTime}T23:59:59.999`).getTime())
    const resp = await request.get('/api/products/orders', { params })
    const data = resp.data.data || {}
    orders.value = data.list || []
    total.value = Number(data.total || 0)
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (page.value > maxPage) {
      page.value = maxPage
      await fetchOrders()
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  if (filterForm.orderStartTime && filterForm.orderEndTime) {
    const start = new Date(filterForm.orderStartTime).getTime()
    const end = new Date(`${filterForm.orderEndTime}T23:59:59.999`).getTime()
    if (end < start) {
      ElMessage.warning('结束时间不能早于开始时间')
      return
    }
    if (end - start > 31 * 24 * 60 * 60 * 1000) {
      ElMessage.warning('购买时间区间最长不能超过1个月')
      return
    }
  }
  page.value = 1
  filterDrawerOpen.value = false
  fetchOrders()
}

const resetSearch = () => {
  filterForm.productName = ''
  filterForm.orderStartTime = ''
  filterForm.orderEndTime = ''
  page.value = 1
  filterDrawerOpen.value = false
  fetchOrders()
}

const handlePageChange = (value: number) => {
  page.value = value
  fetchOrders()
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchOrders()
}

const openOrderDetail = async (row: SoldOrderItem) => {
  const resp = await request.get(`/api/products/orders/${row.id}`)
  currentOrder.value = resp.data.data
  orderDetailDialogVisible.value = true
}

const openMobileFilter = () => {
  filterDrawerOpen.value = true
}

onMounted(async () => {
  window.addEventListener('vs-open-auto-delivery-filter', openMobileFilter)
  await Promise.all([fetchProducts(), fetchOrders()])
})

onBeforeUnmount(() => {
  window.removeEventListener('vs-open-auto-delivery-filter', openMobileFilter)
})
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <span class="label">商品名称：</span>
        <el-input v-model="filterForm.productName" class="filter-input" clearable />
        <span class="label">购买时间：</span>
        <el-date-picker v-model="filterForm.orderStartTime" type="date" value-format="YYYY-MM-DD" placeholder="开始时间" />
        <span>至</span>
        <el-date-picker v-model="filterForm.orderEndTime" type="date" value-format="YYYY-MM-DD" placeholder="结束时间" />
        <el-button type="primary" class="vs-ref-button" @click="handleSearch">查询</el-button>
      </div>
    </div>

    <el-drawer v-model="filterDrawerOpen" title="筛选条件" direction="rtl" size="86%" class="mobile-filter-drawer" append-to-body>
      <div class="mobile-filter-body">
        <div class="mobile-filter-scroll">
          <label>商品名称</label>
          <el-input v-model="filterForm.productName" clearable />
          <label>开始时间</label>
          <el-date-picker v-model="filterForm.orderStartTime" type="date" value-format="YYYY-MM-DD" placeholder="开始时间" />
          <label>结束时间</label>
          <el-date-picker v-model="filterForm.orderEndTime" type="date" value-format="YYYY-MM-DD" placeholder="结束时间" />
        </div>
        <div class="mobile-filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="resetSearch">重置</el-button>
        </div>
      </div>
    </el-drawer>

    <el-table :data="orders" v-loading="loading" style="width: 100%">
      <el-table-column prop="id" label="订单号" min-width="210" />
      <el-table-column label="商品名称" min-width="140">
        <template #default="{ row }">
          {{ row.productName || products.find((item) => item.id === row.productId)?.name || row.productId }}
        </template>
      </el-table-column>
      <el-table-column prop="variantLabel" label="类型" min-width="120" />
      <el-table-column label="单价*数量=金额" min-width="160" align="center">
        <template #default="{ row }">
          {{ (Number(row.amount) / Math.max(Number(row.quantity) || 1, 1)).toFixed(2) }} * {{ row.quantity }} = {{ Number(row.amount).toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column label="购买时间" min-width="160" align="center">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
        </template>
      </el-table-column>
      <el-table-column label="结算" width="100" align="center">
        <template #default="{ row }">
          {{ row.settlementStatus === 'settled' ? '已结算' : '未结算' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="openOrderDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>

    <el-dialog v-model="orderDetailDialogVisible" title="订单详情" width="720px">
      <template v-if="currentOrder">
        <div class="order-detail-list">
          <div><strong>商品名称：</strong>{{ currentOrder.productName || products.find((item) => item.id === currentOrder?.productId)?.name || currentOrder.productId }}</div>
          <div><strong>订单号：</strong>{{ currentOrder.id }}</div>
          <div><strong>类型：</strong>{{ currentOrder.variantLabel || '-' }}</div>
          <div><strong>数量：</strong>{{ currentOrder.quantity }}</div>
          <div><strong>购买时间：</strong>{{ new Date(currentOrder.createdAt).toLocaleString('zh-CN') }}</div>
          <div><strong>结算状态：</strong>{{ currentOrder.settlementStatus === 'settled' ? '已结算' : '未结算' }}</div>
          <div><strong>商品信息：</strong></div>
          <div class="order-card-list">
            <div v-for="card in currentOrder.deliveryPayload || []" :key="card" class="order-card-item">{{ card }}</div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.label {
  color: #374151;
  font-size: 14px;
}

.filter-input {
  width: 192px;
}

.order-detail-list {
  display: grid;
  gap: 10px;
  color: #374151;
  line-height: 1.7;
}

.order-card-list {
  display: grid;
  gap: 8px;
}

.order-card-item {
  padding: 10px 12px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #ebeef5;
  color: #111827;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}
</style>
