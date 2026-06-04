<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { CreditCard } from '@element-plus/icons-vue'
import request from '../../utils/request'

type DashboardData = {
  orderCount: number
  orderAmount: number
  todayOrderCount: number
  todayOrderAmount: number
  unsettledAmount: number
  settledAmount: number
  productCount: number
  codeStats: Array<{ status: string; count: number }>
}

const dashboard = reactive<DashboardData>({
  orderCount: 0,
  orderAmount: 0,
  todayOrderCount: 0,
  todayOrderAmount: 0,
  unsettledAmount: 0,
  settledAmount: 0,
  productCount: 0,
  codeStats: [],
})

const codeStatusLabel = (status: string) => {
  const map: Record<string, string> = {
    unused: '未使用',
    in_use: '使用中',
    expired: '已过期',
    frozen: '已冻结',
    deleted: '已删除',
  }
  return map[status] || status
}

const fetchDashboard = async () => {
  const resp = await request.get('/api/profile/dashboard')
  Object.assign(dashboard, resp.data.data || {})
}

onMounted(fetchDashboard)
</script>

<template>
  <div>
    <div class="dashboard-grid">
      <div class="dashboard-card">
        <span>今日订单</span>
        <strong>{{ dashboard.todayOrderCount }}</strong>
        <small>￥{{ Number(dashboard.todayOrderAmount || 0).toFixed(2) }}</small>
      </div>
      <div class="dashboard-card">
        <span>累计订单</span>
        <strong>{{ dashboard.orderCount }}</strong>
        <small>￥{{ Number(dashboard.orderAmount || 0).toFixed(2) }}</small>
      </div>
      <div class="dashboard-card">
        <span>未结算金额</span>
        <strong>￥{{ Number(dashboard.unsettledAmount || 0).toFixed(2) }}</strong>
        <small>已结算 ￥{{ Number(dashboard.settledAmount || 0).toFixed(2) }}</small>
      </div>
      <div class="dashboard-card">
        <span>商品数量</span>
        <strong>{{ dashboard.productCount }}</strong>
        <small>自动发卡商品</small>
      </div>
    </div>

    <div class="profile-block">
      <div class="block-title">
        <el-icon><CreditCard /></el-icon>
        <span>注册码状态分布</span>
      </div>
      <el-table :data="dashboard.codeStats">
        <el-table-column label="状态">
          <template #default="{ row }">{{ codeStatusLabel(row.status) }}</template>
        </el-table-column>
        <el-table-column prop="count" label="数量" />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

.dashboard-card {
  padding: 18px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}

.dashboard-card span,
.dashboard-card small {
  display: block;
  color: #6b7280;
  font-size: 13px;
}

.dashboard-card strong {
  display: block;
  margin: 10px 0 6px;
  color: #2563eb;
  font-size: 26px;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.block-title .el-icon {
  color: #3d97f9;
}

@media (max-width: 980px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
