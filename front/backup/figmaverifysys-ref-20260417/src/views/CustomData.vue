<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
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

const list = ref<CustomDataItem[]>([])
const loading = ref(false)
const total = ref(0)
const projects = ref<ProjectOption[]>([])

const query = reactive({
  projectId: '',
  key: '',
  remark: '',
  page: 1,
  pageSize: 10,
})

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<Partial<CustomDataItem>>({
  projectId: '',
  key: '',
  value: '',
  remark: '',
})

const fetchProjects = async () => {
  try {
    const resp = await request.get('/api/projects')
    const rows = (resp.data.data.list || resp.data.data || []) as any[]
    projects.value = rows.map((r) => ({ id: r.id, name: r.name }))
    if (!query.projectId && projects.value.length) query.projectId = ''
    if (!form.projectId && projects.value.length) form.projectId = projects.value[0]?.id || ''
  } catch (e) {
    console.error(e)
  }
}

const fetchData = async () => {
  loading.value = true
  try {
    const params: any = {
      page: query.page,
      pageSize: query.pageSize,
    }
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

  if (editingId.value) {
    await request.put(`/api/custom-data/${editingId.value}`, {
      projectId: form.projectId,
      key: form.key,
      value: form.value,
      remark: form.remark,
    })
  } else {
    await request.post('/api/custom-data', {
      projectId: form.projectId,
      key: form.key,
      value: form.value,
      remark: form.remark,
    })
  }
  ElMessage.success('保存成功')
  dialogVisible.value = false
  fetchData()
}

const removeData = async (row: CustomDataItem) => {
  await ElMessageBox.confirm(`删除键 ${row.key} 吗？`, '提示', { type: 'warning' })
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
  <div class="page vs-app-page vs-page-shell">
    <section class="vs-page-header vs-page-header--ops">
      <div class="vs-page-copy">
        <h2 class="vs-page-title">自定义数据</h2>
        <p class="vs-page-subtitle">保留现有项目、Key、备注筛选和分页逻辑，只调整布局和信息组织方式。</p>
      </div>
      <div class="vs-meta-strip">
        <div class="vs-meta-card">
          <span>总记录数</span>
          <strong>{{ total }}</strong>
        </div>
      </div>
    </section>

    <el-card class="vs-panel">
      <div class="vs-page-toolbar">
        <div class="vs-toolbar-group vs-toolbar-group--end">
          <el-button type="primary" @click="openDialog()">新增数据</el-button>
        </div>
      </div>

      <div class="search-bar vs-search-row">
        <span class="label">项目名称：</span>
        <el-select v-model="query.projectId" filterable style="width: 200px">
          <el-option label="-所有项目-" value="" />
          <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <span class="label">key 值：</span>
        <el-input v-model="query.key" style="width: 220px" clearable />
        <span class="label">备注：</span>
        <el-input v-model="query.remark" style="width: 220px" clearable />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="resetSearch">重置</el-button>
      </div>

      <el-table :data="list" v-loading="loading" style="width: 100%" border>
        <el-table-column prop="projectName" label="项目名称" width="160" />
        <el-table-column prop="key" label="Key" />
        <el-table-column prop="value" label="Value" />
        <el-table-column prop="remark" label="备注" width="200" />
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
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
          prev-text="上一页"
          next-text="下一页"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑数据' : '新增数据'" width="520px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="项目名称">
          <el-select v-model="form.projectId" filterable style="width: 100%">
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
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
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.search-bar {
  margin-bottom: 20px;
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

.vs-page-toolbar {
  margin-bottom: 18px;
}
</style>
