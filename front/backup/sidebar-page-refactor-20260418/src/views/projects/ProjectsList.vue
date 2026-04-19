<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
const page = ref(1)
const pageSize = ref(10)
const tableHeight = 'calc(100vh - 360px)'

const normalizeList = (payload: unknown): ProjectItem[] => {
  if (Array.isArray(payload)) return payload as ProjectItem[]
  if (payload && typeof payload === 'object') {
    const listValue = (payload as { list?: unknown }).list
    if (Array.isArray(listValue)) return listValue as ProjectItem[]
  }
  return []
}

const pagedList = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const fetchList = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/projects', { params: { keyword: filters.keyword } })
    list.value = normalizeList(resp?.data?.data)
    const maxPage = Math.max(1, Math.ceil(list.value.length / pageSize.value))
    if (page.value > maxPage) page.value = maxPage
  } finally {
    loading.value = false
  }
}

const handlePageChange = (nextPage: number) => {
  page.value = nextPage
}

const handleSizeChange = (nextSize: number) => {
  pageSize.value = nextSize
  page.value = 1
}

onMounted(fetchList)
</script>

<template>
  <div>
    <div class="vs-ref-toolbar">
      <span class="label">项目名称：</span>
      <el-select v-model="filters.keyword" clearable placeholder="全部项目" style="width: 180px">
        <el-option v-for="project in list" :key="project.id" :label="project.name" :value="project.name" />
      </el-select>
      <span class="label">项目备注：</span>
      <el-input v-model="filters.notice" style="width: 180px" />
      <el-button type="primary" class="vs-ref-button" @click="fetchList">查询</el-button>
    </div>

    <el-table :data="pagedList" :max-height="tableHeight" v-loading="loading">
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

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="list.length"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.label {
  color: #4b5563;
  font-size: 14px;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}
</style>
