<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import request from '../../utils/request'

interface ProjectItem {
  id: string
  name: string
  description?: string
  remark?: string
}

const filters = reactive({ keyword: '', notice: '' })
const list = ref<ProjectItem[]>([])
const loading = ref(false)

const fetchList = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/projects', { params: { keyword: filters.keyword } })
    list.value = resp.data.data
  } finally {
    loading.value = false
  }
}

onMounted(fetchList)
</script>

<template>
  <div class="page vs-page-shell">
    <section class="vs-page-header">
      <div>
        <h2 class="vs-page-title">项目管理</h2>
        <p class="vs-page-subtitle">延续统一后台视觉，强化筛选区、表格层级和操作入口的可读性。</p>
      </div>
      <div class="header-indicator">Total {{ list.length }}</div>
    </section>

    <el-card shadow="hover">
      <div class="filters">
        <el-select v-model="filters.keyword" clearable placeholder="全部项目" style="width: 180px">
          <el-option v-for="p in list" :key="p.id" :label="p.name" :value="p.name" />
        </el-select>
        <el-input v-model="filters.notice" placeholder="备注" style="width: 180px" />
        <el-button type="primary" @click="fetchList">查询</el-button>
      </div>

      <el-table :data="list" border v-loading="loading">
        <el-table-column prop="name" label="项目名称" />
        <el-table-column prop="description" label="公告" />
        <el-table-column prop="remark" label="备注" />
        <el-table-column label="操作" width="160">
          <template #default>
            <el-link type="primary">编辑</el-link>
            <el-link type="danger" style="margin-left: 8px">删除</el-link>
          </template>
        </el-table-column>
        <el-table-column label="管理" width="200">
          <template #default>
            <el-link type="primary">注册码</el-link>
            <el-link type="primary" style="margin-left: 8px">文件</el-link>
            <el-link type="primary" style="margin-left: 8px">数据</el-link>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">共 {{ list.length }} 条数据</div>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  gap: 18px;
}

.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.pager {
  margin-top: 12px;
  color: #607089;
  font-size: 13px;
}

.header-indicator {
  padding: 10px 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #172033;
  font-size: 18px;
  font-weight: 800;
}
</style>
