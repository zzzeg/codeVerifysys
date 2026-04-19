<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../utils/request'
import type { ApiResp } from '../utils/request'
import { formatDateTimeCell } from '../utils/datetime'

const stats = ref<{ users: number; projects: number; codes: number; products: number; orders: number } | null>(null)
const chart = ref<{ date: string; value: number }[]>([])
const recentLogs = ref<any[]>([])
const recentOrders = ref<any[]>([])
const loading = ref(false)
const formatDate = formatDateTimeCell

const fetchData = async () => {
  loading.value = true
  try {
    const [s, c, r] = await Promise.all([
      request.get<ApiResp<typeof stats.value>>('/api/dashboard/stats'),
      request.get<ApiResp<{ series: { date: string; value: number }[] }>>('/api/dashboard/charts'),
      request.get<ApiResp<{ logs: any[]; orders: any[] }>>('/api/dashboard/recent'),
    ])
    stats.value = s.data.data
    chart.value = c.data.data.series
    recentLogs.value = r.data.data.logs
    recentOrders.value = r.data.data.orders
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '获取仪表盘数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)
</script>

<template>
  <div class="dashboard" v-loading="loading">
    <div class="cards">
      <el-card v-for="item in [
        { label: '用户数', value: stats?.users },
        { label: '项目数', value: stats?.projects },
        { label: '注册码', value: stats?.codes },
        { label: '商品数', value: stats?.products },
        { label: '订单数', value: stats?.orders },
      ]" :key="item.label" class="stat">
        <div class="label">{{ item.label }}</div>
        <div class="value">{{ item.value ?? '--' }}</div>
      </el-card>
    </div>

    <el-card>
      <template #header>近7日趋势</template>
      <div class="chart">
        <div v-for="item in chart" :key="item.date" class="bar">
          <div class="bar-inner" :style="{ height: `${item.value * 4}px` }"></div>
          <span class="bar-label">{{ item.date }}</span>
        </div>
      </div>
    </el-card>

    <div class="lists">
      <el-card>
        <template #header>最近操作</template>
        <el-table :data="recentLogs" size="small" style="width: 100%">
          <el-table-column prop="action" label="动作" />
          <el-table-column prop="user" label="用户" />
          <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
        </el-table>
      </el-card>
      <el-card>
        <template #header>最近订单</template>
        <el-table :data="recentOrders" size="small" style="width: 100%">
          <el-table-column prop="productId" label="商品" />
          <el-table-column prop="amount" label="金额" />
          <el-table-column prop="status" label="状态" />
          <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
}
.stat .label {
  color: #6b7280;
  margin-bottom: 6px;
}
.stat .value {
  font-size: 24px;
  font-weight: 700;
}
.chart {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  min-height: 140px;
}
.bar {
  text-align: center;
  flex: 1;
}
.bar-inner {
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
  border-radius: 6px 6px 2px 2px;
  transition: height 0.3s;
}
.bar-label {
  display: block;
  margin-top: 6px;
  color: #6b7280;
  font-size: 12px;
}
.lists {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}
</style>
