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
  <div class="page">
    <el-card shadow="never">
      <div class="filters">
        <el-select v-model="filters.keyword" clearable placeholder="-所有项目-" style="width: 180px">
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

      <!-- 分页 -->
      <!-- <div class="pagination-wrap">
        <el-pagination v-model:current-page="filters.currentPage" v-model:page-size="filters.pageSize"
          :page-sizes="20" :total="total" layout="total, sizes, prev, pager, next, jumper" prev-text="上一页" next-text="下一页"
          @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div> -->
    </el-card>
  </div>
</template>

<style scoped>
.page {
  padding: 8px;
  background: #fff;
}
.filters {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.pager {
  margin-top: 8px;
  color: #666;
}
</style>
