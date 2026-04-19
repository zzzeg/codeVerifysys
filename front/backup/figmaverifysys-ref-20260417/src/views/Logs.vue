<script setup lang="ts">
import { onMounted, ref } from 'vue'
import request from '../utils/request'
import { formatDateTimeCell } from '../utils/datetime'

const operationLogs = ref<any[]>([])
const loginLogs = ref<any[]>([])
const errorLogs = ref<any[]>([])
const activeTab = ref('operation')
const formatDate = formatDateTimeCell

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

onMounted(fetchLogs)
</script>

<template>
  <div class="vs-app-page vs-page-shell">
    <section class="vs-page-header vs-page-header--ops">
      <div class="vs-page-copy">
        <h2 class="vs-page-title">系统日志</h2>
        <p class="vs-page-subtitle">保留操作、登录和错误三类日志，只重排成更接近运营看板的页面结构。</p>
      </div>
      <div class="vs-meta-strip">
        <div class="vs-meta-card">
          <span>操作日志</span>
          <strong>{{ operationLogs.length }}</strong>
        </div>
        <div class="vs-meta-card">
          <span>登录日志</span>
          <strong>{{ loginLogs.length }}</strong>
        </div>
        <div class="vs-meta-card">
          <span>错误日志</span>
          <strong>{{ errorLogs.length }}</strong>
        </div>
      </div>
    </section>

    <el-card class="vs-panel">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="操作日志" name="operation">
          <el-table :data="operationLogs" style="width: 100%" size="small">
            <el-table-column prop="action" label="动作" />
            <el-table-column prop="user" label="用户" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="登录日志" name="login">
          <el-table :data="loginLogs" style="width: 100%" size="small">
            <el-table-column prop="user" label="用户" />
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="ip" label="IP" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="错误日志" name="error">
          <el-table :data="errorLogs" style="width: 100%" size="small">
            <el-table-column prop="message" label="消息" />
            <el-table-column prop="stack" label="堆栈" />
            <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>
