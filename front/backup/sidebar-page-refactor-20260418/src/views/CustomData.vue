<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../utils/request'

interface ProjectOption {
  id: string
  name: string
}

interface CustomDataItem {
  id: string
  projectId: string
  projectName?: string
  key: string
  value: string
  remark?: string
}

const activeTab = ref<'list' | 'help'>('list')
const list = ref<CustomDataItem[]>([])
const loading = ref(false)
const total = ref(0)
const projects = ref<ProjectOption[]>([])

const currentTitle = computed(() => (activeTab.value === 'list' ? '自定义数据管理' : '使用说明'))

const query = reactive({ projectId: '', key: '', remark: '', page: 1, pageSize: 10 })
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<Partial<CustomDataItem>>({ projectId: '', key: '', value: '', remark: '' })
const tableHeight = 'calc(100vh - 360px)'

const fetchProjects = async () => {
  const resp = await request.get('/api/projects')
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
  if (!form.projectId && projects.value.length) form.projectId = projects.value[0]?.id || ''
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: Record<string, string | number> = { page: query.page, pageSize: query.pageSize }
    if (query.projectId) params.projectId = query.projectId
    if (query.key) params.key = query.key
    if (query.remark) params.remark = query.remark

    const resp = await request.get('/api/custom-data', { params })
    list.value = resp.data.data.list || []
    total.value = resp.data.data.total || 0
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  query.page = 1
  fetchData()
}

const resetSearch = () => {
  query.projectId = ''
  query.key = ''
  query.remark = ''
  query.page = 1
  query.pageSize = 10
  fetchData()
}

const handlePageChange = (page: number) => {
  query.page = page
  fetchData()
}

const handleSizeChange = (size: number) => {
  query.pageSize = size
  query.page = 1
  fetchData()
}

const openDialog = (row?: CustomDataItem) => {
  editingId.value = row?.id || null
  Object.assign(form, row || { projectId: projects.value[0]?.id || '', key: '', value: '', remark: '' })
  dialogVisible.value = true
}

const saveData = async () => {
  if (!form.projectId) return ElMessage.warning('请选择项目')
  if (!form.key) return ElMessage.warning('请输入 Key')

  const payload = {
    projectId: form.projectId,
    key: form.key,
    value: form.value,
    remark: form.remark,
  }

  if (editingId.value) {
    await request.put(`/api/custom-data/${editingId.value}`, payload)
  } else {
    await request.post('/api/custom-data', payload)
  }

  ElMessage.success('保存成功')
  dialogVisible.value = false
  fetchData()
}

const removeData = async (row: CustomDataItem) => {
  await ElMessageBox.confirm(`确认删除键“${row.key}”吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/custom-data/${row.id}`)
  ElMessage.success('已删除')
  fetchData()
}

onMounted(async () => {
  await fetchProjects()
  await fetchData()
})
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <section class="vs-ref-main">
        <div class="vs-ref-main-head">
          <div class="head-row">
            <h2 class="vs-ref-main-title">{{ currentTitle }}</h2>
            <div class="head-actions">
              <el-button @click="activeTab = activeTab === 'list' ? 'help' : 'list'">
                {{ activeTab === 'list' ? '使用说明' : '返回列表' }}
              </el-button>
              <el-button v-if="activeTab === 'list'" type="primary" @click="openDialog()">添加自定义数据</el-button>
            </div>
          </div>
        </div>

        <div class="vs-ref-main-body">
          <div v-if="activeTab === 'list'">
            <div class="vs-ref-toolbar">
              <span class="label">项目名称：</span>
              <el-select v-model="query.projectId" filterable style="width: 200px">
                <el-option label="全部项目" value="" />
                <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
              </el-select>
              <span class="label">Key 值：</span>
              <el-input v-model="query.key" style="width: 220px" clearable />
              <span class="label">备注：</span>
              <el-input v-model="query.remark" style="width: 220px" clearable />
              <el-button type="primary" class="vs-ref-button" @click="handleSearch">查询</el-button>
              <el-button @click="resetSearch">重置</el-button>
            </div>

            <el-table :data="list" :max-height="tableHeight" v-loading="loading" style="width: 100%">
              <el-table-column prop="projectName" label="项目名称" width="160" />
              <el-table-column prop="key" label="Key 值" />
              <el-table-column prop="value" label="Value 值" />
              <el-table-column prop="remark" label="备注" />
              <el-table-column label="操作" width="180">
                <template #default="{ row }">
                  <el-button size="small" type="primary" @click="openDialog(row)">编辑</el-button>
                  <el-button size="small" type="danger" @click="removeData(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pager">
              <el-pagination
                v-model:current-page="query.page"
                v-model:page-size="query.pageSize"
                :page-sizes="[10, 20, 50, 100]"
                :total="total"
                layout="total, sizes, prev, pager, next, jumper"
                @current-change="handlePageChange"
                @size-change="handleSizeChange"
              />
            </div>
          </div>

          <div v-else class="help-block">自定义数据使用说明暂未调整内容，仅保留页内占位。</div>
        </div>
      </section>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑数据' : '新增数据'"
      width="520px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form :model="form" label-width="90px">
        <el-form-item label="项目名称">
          <el-select v-model="form.projectId" filterable style="width: 100%">
            <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="Key">
          <el-input v-model="form.key" />
        </el-form-item>
        <el-form-item label="Value">
          <el-input v-model="form.value" type="textarea" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveData">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.head-row,
.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.head-row {
  justify-content: space-between;
}

.label {
  color: #303133;
  font-size: 13px;
  white-space: nowrap;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}

.help-block {
  padding: 24px;
  color: #6b7280;
}
</style>
