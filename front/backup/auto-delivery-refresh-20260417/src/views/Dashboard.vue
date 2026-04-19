<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

const statItems = computed(() => [
  { label: '用户数', value: stats.value?.users, tone: 'blue' },
  { label: '项目数', value: stats.value?.projects, tone: 'cyan' },
  { label: '注册码数', value: stats.value?.codes, tone: 'indigo' },
  { label: '商品数', value: stats.value?.products, tone: 'amber' },
  { label: '订单数', value: stats.value?.orders, tone: 'emerald' },
])

const maxChartValue = computed(() => Math.max(...chart.value.map((item) => item.value), 1))
const latestChartDate = computed(() => {
  if (!chart.value.length) return '--'
  return chart.value[chart.value.length - 1]?.date || '--'
})

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
  <div class="dashboard vs-page-shell" v-loading="loading">
    <section class="vs-page-header hero">
      <div>
        <h2 class="vs-page-title">统一视图监控注册码和业务运行状态</h2>
        <p class="vs-page-subtitle">
          在不改动现有数据接口的前提下，聚合统计、趋势和最近操作信息，整体视觉与后台其它页面保持一致。
        </p>
      </div>
      <div class="hero-aside">
        <div class="hero-card">
          <span>System Status</span>
          <strong>Healthy</strong>
        </div>
        <div class="hero-card">
          <span>Recent Sync</span>
          <strong>{{ latestChartDate }}</strong>
        </div>
      </div>
    </section>

    <div class="cards">
      <el-card
        v-for="item in statItems"
        :key="item.label"
        class="stat-card"
        :class="`tone-${item.tone}`"
        shadow="hover"
      >
        <div class="stat-label">{{ item.label }}</div>
        <div class="stat-value">{{ item.value ?? '--' }}</div>
        <div class="stat-meta">实时概览</div>
      </el-card>
    </div>

    <div class="dashboard-grid">
      <el-card class="chart-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <div>
              <div class="card-title">近7日趋势</div>
              <div class="card-caption">按天查看核心数据波动</div>
            </div>
            <span class="vs-pill">7D Snapshot</span>
          </div>
        </template>

        <div class="chart">
          <div v-for="item in chart" :key="item.date" class="bar">
            <div class="bar-track">
              <div
                class="bar-inner"
                :style="{ height: `${Math.max((item.value / maxChartValue) * 220, 16)}px` }"
              />
            </div>
            <span class="bar-value">{{ item.value }}</span>
            <span class="bar-label">{{ item.date }}</span>
          </div>
        </div>
      </el-card>

      <div class="side-panels">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header compact">
              <div>
                <div class="card-title">最近操作</div>
                <div class="card-caption">关键操作追踪</div>
              </div>
            </div>
          </template>
          <el-table :data="recentLogs" size="small" style="width: 100%">
            <el-table-column prop="action" label="动作" />
            <el-table-column prop="user" label="用户" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>
        </el-card>

        <el-card shadow="hover">
          <template #header>
            <div class="card-header compact">
              <div>
                <div class="card-title">最近订单</div>
                <div class="card-caption">最新交易活动</div>
              </div>
            </div>
          </template>
          <el-table :data="recentOrders" size="small" style="width: 100%">
            <el-table-column prop="productId" label="商品" />
            <el-table-column prop="amount" label="金额" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  gap: 18px;
}

.hero {
  align-items: stretch;
  padding-top: 16px;
  padding-bottom: 16px;
}

.hero-aside {
  display: grid;
  grid-template-columns: repeat(2, minmax(140px, 1fr));
  gap: 12px;
  min-width: 300px;
}

.hero-card {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.hero-card span {
  display: block;
  color: #7a8aa2;
  font-size: 12px;
  font-weight: 600;
}

.hero-card strong {
  display: block;
  margin-top: 8px;
  font-size: 22px;
  line-height: 1;
  color: #172033;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.stat-card {
  position: relative;
  overflow: hidden;
}

.stat-card::after {
  content: '';
  position: absolute;
  inset: auto -20% -60% auto;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.34);
}

.stat-label {
  color: #607089;
  font-size: 13px;
  font-weight: 600;
}

.stat-value {
  margin-top: 18px;
  font-size: 34px;
  line-height: 1;
  font-weight: 800;
  color: #172033;
}

.stat-meta {
  margin-top: 14px;
  color: #7a8aa2;
  font-size: 12px;
}

.tone-blue {
  background: linear-gradient(135deg, rgba(240, 246, 255, 0.98), rgba(229, 238, 255, 0.9));
}

.tone-cyan {
  background: linear-gradient(135deg, rgba(236, 251, 255, 0.98), rgba(226, 245, 255, 0.9));
}

.tone-indigo {
  background: linear-gradient(135deg, rgba(241, 241, 255, 0.98), rgba(232, 236, 255, 0.9));
}

.tone-amber {
  background: linear-gradient(135deg, rgba(255, 248, 235, 0.98), rgba(255, 242, 220, 0.9));
}

.tone-emerald {
  background: linear-gradient(135deg, rgba(236, 253, 245, 0.98), rgba(223, 250, 238, 0.9));
}

.dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.9fr);
  gap: 16px;
}

.chart-card {
  min-width: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-header.compact {
  justify-content: flex-start;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: #172033;
}

.card-caption {
  margin-top: 4px;
  color: #7a8aa2;
  font-size: 12px;
}

.chart {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
  gap: 14px;
  align-items: end;
  min-height: 320px;
}

.bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.bar-track {
  width: 100%;
  min-height: 220px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 12px 8px 0;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(247, 250, 255, 0.9), rgba(239, 244, 252, 0.9));
}

.bar-inner {
  width: 100%;
  max-width: 44px;
  border-radius: 18px 18px 10px 10px;
  background: linear-gradient(180deg, #7db4ff 0%, #2f6bff 70%, #1748cf 100%);
  box-shadow: 0 16px 24px rgba(47, 107, 255, 0.22);
}

.bar-value {
  font-size: 12px;
  font-weight: 700;
  color: #172033;
}

.bar-label {
  color: #7a8aa2;
  font-size: 12px;
}

.side-panels {
  display: grid;
  gap: 16px;
}

@media (max-width: 1100px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .hero {
    flex-direction: column;
  }

  .hero-aside {
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .hero-aside {
    grid-template-columns: 1fr;
  }

  .chart {
    grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
  }
}
</style>
