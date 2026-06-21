<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../api/notifications'
import AppPagination from '../components/common/AppPagination.vue'
import type { NotificationItem } from '../types/notification'

const loading = ref(false)
const list = ref<NotificationItem[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

/**
 * 校正通知列表页码
 * @returns 无返回值，内部根据总数和分页大小修正当前页
 */
const normalizePage = () => {
  const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
}

/**
 * 获取通知分页列表
 * @returns 无返回值，内部更新通知列表和分页总数
 */
const fetchList = async () => {
  loading.value = true
  try {
    const resp = await getNotifications({ page: page.value, pageSize: pageSize.value })
    const data = resp.data.data || {}
    list.value = data.list || []
    total.value = Number(data.total || 0)
    const beforePage = page.value
    normalizePage()
    if (page.value !== beforePage) await fetchList()
  } finally {
    loading.value = false
  }
}

/**
 * 标记单条通知为已读
 * @param row 通知行数据
 * @returns 无返回值，后端成功后同步行状态
 */
const markRead = async (row: NotificationItem) => {
  await markNotificationAsRead(row.id)
  row.read = true
}

/**
 * 标记全部通知为已读
 * @returns 无返回值，后端成功后同步当前列表状态
 */
const readAll = async () => {
  await markAllNotificationsAsRead()
  list.value = list.value.map((item) => ({ ...item, read: true }))
}

/**
 * 删除指定通知
 * @param row 通知行数据
 * @returns 无返回值，删除成功后刷新列表
 */
const remove = async (row: NotificationItem) => {
  await deleteNotification(row.id)
  await fetchList()
}

/**
 * 处理分页页码变化
 * @param value 最新页码
 * @returns 无返回值，更新页码后重新加载列表
 */
const handlePageChange = (value: number) => {
  page.value = value
  fetchList()
}

/**
 * 处理分页大小变化
 * @param value 最新每页数量
 * @returns 无返回值，重置到第一页并重新加载列表
 */
const handleSizeChange = (value: number) => {
  pageSize.value = value
  page.value = 1
  fetchList()
}

onMounted(fetchList)
</script>

<template>
  <div class="pure-table-page">
    <div class="vs-ref-toolbar pure-table-toolbar">
      <div class="toolbar-left">
        <el-button type="primary" @click="readAll">全部已读</el-button>
      </div>
    </div>

    <el-table :data="list" v-loading="loading">
      <el-table-column label="状态" width="88">
        <template #default="{ row }">
          <el-tag :type="row.read ? 'info' : 'warning'">{{ row.read ? '已读' : '未读' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="content" label="内容" min-width="280" show-overflow-tooltip />
      <el-table-column prop="category" label="类型" width="110" />
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button v-if="!row.read" size="small" type="primary" @click="markRead(row)">已读</el-button>
          <el-button size="small" type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > pageSize" class="pager">
      <AppPagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
        :total="total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
        @size-change="handleSizeChange" />
    </div>
  </div>
</template>
