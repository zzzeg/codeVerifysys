<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Upload, Delete } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import request from '../../utils/request'
import { formatDateTime } from '../../utils/datetime'

interface CodeItem {
  id: string
  code: string
  cardType: string
  projectId: string
  projectName?: string
  status: string
  isOnline: boolean
  isBound: boolean
  machineCode?: string
  lastLoginIp?: string
  lastLoginAt?: number
  activatedAt?: number
  expireAt?: number
  unbindPassword?: string
  userMsg?: string
  remark?: string
  saleType?: string
  createdBy?: string
  createdAt?: number
}

// 筛选条件
const filters = reactive({
  timeType: 'activated', // 时间类型：activated, expired, lastLogin
  startTime: '',
  endTime: '',
  code: '',
  machineCode: '',
  // 使用状态（checkbox-group）
  usageStatuses: [] as Array<'unused' | 'in_use' | 'expired' | 'deleted'>,
  // 操作状态（checkbox-group）
  operationFlags: [] as Array<'frozen' | 'bound'>,
  // 卡类型（checkbox-group）
  cardTypes: [] as Array<'trial' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'half_year' | 'year' | 'permanent'>,
  // 其他
  projectId: '',
  onlineStatus: '', // all, online, offline
  saleType: '', // all, author_generated, auto_issue
  pageSize: 20,
  currentPage: 1,
})

const list = ref<CodeItem[]>([])
const loading = ref(false)
const total = ref(0)
const selectedRows = ref<CodeItem[]>([])
const currentRow = ref<CodeItem | null>(null)
const showDetail = ref(false)
const projects = ref<any[]>([])
const tableRef = ref<any>()
const route = useRoute()
const batchProjectDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const importDialogVisible = ref(false)
const importSubmitting = ref(false)
const importFileInputRef = ref<HTMLInputElement | null>(null)
const batchProjectForm = reactive({
  projectId: '',
})
const exportForm = reactive({
  scope: 'selected',
  linesPerGroup: 1,
  onlyCode: true,
  saveAsExcel: false,
})
const importForm = reactive({
  projectId: '',
  delimiter: ',',
  fileName: '',
  fileContent: '',
})

const tableheight = 'calc(100vh - 480px)'
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedProjectIds = computed(() =>
  Array.from(new Set(selectedRows.value.map((row) => row.projectId).filter(Boolean)))
)

const relayoutTable = () => {
  nextTick(() => {
    tableRef.value?.doLayout?.()
  })
}

const getDelimiterLabel = (delimiter: string) => {
  if (delimiter === '\t') return 'Tab'
  if (delimiter === ';') return '分号(;)'
  return '逗号(,)'
}

const getExportTimestamp = () => {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

const buildQueryParams = (page = filters.currentPage, pageSize = filters.pageSize) => {
  const params: any = {
    page,
    pageSize,
  }

  if (filters.startTime) params.startTime = filters.startTime
  if (filters.endTime) params.endTime = filters.endTime
  if (filters.timeType) params.timeType = filters.timeType
  if (filters.code) params.keyword = filters.code
  if (filters.machineCode) params.machineCode = filters.machineCode

  const statuses = new Set<string>()
  filters.usageStatuses.forEach((s) => statuses.add(s))
  if (filters.operationFlags.includes('frozen')) statuses.add('frozen')
  if (statuses.size) params.status = Array.from(statuses).join(',')

  if (filters.operationFlags.includes('bound')) params.isBound = true
  if (filters.cardTypes.length) params.cardType = filters.cardTypes.join(',')
  if (filters.projectId) params.projectId = filters.projectId
  if (filters.onlineStatus && filters.onlineStatus !== 'all') params.isOnline = filters.onlineStatus === 'online'
  if (filters.saleType && filters.saleType !== 'all') params.saleType = filters.saleType

  return params
}

// 获取项目列表
const fetchProjects = async () => {
  try {
    const resp = await request.get('/api/projects')
    projects.value = resp.data.data.list || resp.data.data || []
  } catch (err) {
    console.error('获取项目列表失败', err)
  }
}

// 获取注册码列表
const fetchList = async () => {
  loading.value = true
  try {
    const params = buildQueryParams()

    // 时间筛选
    if (filters.startTime) params.startTime = filters.startTime
    if (filters.endTime) params.endTime = filters.endTime
    if (filters.timeType) params.timeType = filters.timeType

    // 关键词搜索
    if (filters.code) params.keyword = filters.code
    if (filters.machineCode) params.machineCode = filters.machineCode

    // 状态筛选（使用状态 + 操作状态）
    const statuses = new Set<string>()
    filters.usageStatuses.forEach((s) => statuses.add(s))
    if (filters.operationFlags.includes('frozen')) statuses.add('frozen')
    if (statuses.size) params.status = Array.from(statuses).join(',')

    // 操作状态：绑定
    if (filters.operationFlags.includes('bound')) params.isBound = true

    // 卡类型筛选
    if (filters.cardTypes.length) params.cardType = filters.cardTypes.join(',')

    // 其他筛选
    if (filters.projectId) params.projectId = filters.projectId
    if (filters.onlineStatus && filters.onlineStatus !== 'all') params.isOnline = filters.onlineStatus === 'online'
    if (filters.saleType && filters.saleType !== 'all') params.saleType = filters.saleType

    const resp = await request.get('/api/codes', { params })
  
    const rows = (resp.data.data.list || resp.data.data || []) as any[]
    list.value = rows.map((r) => ({
      ...r,
      // 兼容字段命名（历史：expiredAt/expireAt）
      expireAt: typeof r.expireAt === 'undefined' ? r.expiredAt : r.expireAt,
      userMsg: typeof r.userMsg === 'undefined' ? r.customerInfo : r.userMsg,
    }))
    total.value = resp.data.data.total || list.value.length


    

    if (!currentRow.value && list.value.length > 0) {
      currentRow.value = list.value[0] || null
      //showDetail.value = true
    }
    relayoutTable()
  } catch (err: any) {
    console.log("err is",err)
    ElMessage.error(err?.message || '获取列表失败')
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  filters.currentPage = 1
  fetchList()
}

// 重置筛选
const resetFilters = () => {
  Object.assign(filters, {
    timeType: 'activated',
    startTime: '',
    endTime: '',
    code: '',
    machineCode: '',
    usageStatuses: [],
    operationFlags: [],
    cardTypes: [],
    projectId: '',
    onlineStatus: '',
    saleType: '',
    pageSize: 20,
    currentPage: 1,
  })
  fetchList()
}

let searchTimer: number | undefined
const triggerSearch = () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    handleSearch()
  }, 150)
}

watch(
  () => [filters.usageStatuses.slice(), filters.operationFlags.slice(), filters.cardTypes.slice(), filters.onlineStatus.slice(), filters.projectId.slice(), filters.saleType.slice()],
  () => triggerSearch(),
  { deep: true },
)

//批量选中 点击全选
const handleSelectAllColumn = (val: any) => {
  if (val) {
    list.value.forEach((row) => {
      tableRef.value?.toggleRowSelection(row, true)
    })
  } else {
    tableRef.value?.clearSelection()
  }

  //console.log("selectedRows.value", selectedRows.value)
}
// 选择变化
const handleSelectionChange = (rows: CodeItem[]) => {
  selectedRows.value = rows

}

// 点击行
const handleRowClick = (row: CodeItem) => {
  currentRow.value = row
  showDetail.value = true
}

// 冻结
const handleFreeze = async (row: CodeItem) => {
  try {
    await ElMessageBox.confirm('确定要冻结该注册码吗？', '提示', {
      type: 'warning',
    })
    await request.patch(`/api/codes/${row.id}/freeze`)
    ElMessage.success('冻结成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || '冻结失败')
    }
  }
}

// 解冻
const handleUnfreeze = async (row: CodeItem) => {
  try {
    await request.patch(`/api/codes/${row.id}/unfreeze`)
    ElMessage.success('解冻成功')
    fetchList()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || '解冻失败')
  }
}

// 解绑
const handleUnbind = async (row: CodeItem) => {
  try {
    await ElMessageBox.confirm('确定要解绑该注册码吗？', '提示', {
      type: 'warning',
    })
    await request.patch(`/api/codes/${row.id}/unbind`)
    ElMessage.success('解绑成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || '解绑失败')
    }
  }
}

// 续费
const handleRenew = async (row: CodeItem) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入续费天数', '续费', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入有效的天数',
    })
    await request.patch(`/api/codes/${row.id}/renew`, { days: parseInt(value, 10) })
    ElMessage.success('续费成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || '续费失败')
    }
  }
}

//下线
const handleOffline = async (row: CodeItem) => {
  try {
    await ElMessageBox.confirm('确定要下线该注册码吗？', '提示', {
      type: 'warning',
    })
    await request.patch(`/api/codes/${row.id}/offline`)
    ElMessage.success('下线成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || '下线失败')
    }
  }
}

// 删除
const handleDelete = async (row: CodeItem) => {
  try {
    await ElMessageBox.confirm('确定要删除该注册码吗？删除后无法恢复！', '警告', {
      type: 'error',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
    })
    await request.delete(`/api/codes/${row.id}`)
    ElMessage.success('删除成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || '删除失败')
    }
  }
}

// 批量冻结
const handleBatchFreeze = async () => {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先选择要冻结的注册码')
    return
  }
  try {
    await ElMessageBox.confirm(`确定要冻结选中的 ${selectedRows.value.length} 个注册码吗？`, '提示', {
      type: 'warning',
    })
    const ids = selectedRows.value.map((r) => r.id)
    await request.post('/api/codes/batch/freeze', { ids })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '冻结成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || (selectedRows.value.length > 1 ? '批量' : '') + '冻结失败')
    }
  }
}

// 批量解冻
const handleBatchUnfreeze = async () => {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先选择要解冻的注册码')
    return
  }
  try {
    const ids = selectedRows.value.map((r) => r.id)
    await request.post('/api/codes/batch/unfreeze', { ids })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '解冻成功')
    fetchList()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || (selectedRows.value.length > 1 ? '批量' : '') + '解冻失败')
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (!selectedRows.value.length) {
    ElMessage.warning('请先选择要删除的注册码')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedRows.value.length} 个注册码吗？删除后无法恢复！`,
      '警告',
      {
        type: 'error',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
      }
    )
    const ids = selectedRows.value.map((r) => r.id)
    await request.post('/api/codes/batch/delete', { ids })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '删除成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || (selectedRows.value.length > 1 ? '批量' : '') + '删除失败')
    }
  }
}

const openExportDialog = () => {
  exportForm.scope = hasSelection.value ? 'selected' : 'page'
  exportForm.linesPerGroup = 1
  exportForm.onlyCode = true
  exportForm.saveAsExcel = false
  exportDialogVisible.value = true
}

const openImportDialog = () => {
  importForm.projectId = filters.projectId || ''
  importForm.delimiter = ','
  importForm.fileName = ''
  importForm.fileContent = ''
  importDialogVisible.value = true
}

const loadAllCodesForExport = async () => {
  const pageSize = 200
  let page = 1
  let allRows: CodeItem[] = []
  let totalCount = 0

  do {
    const resp = await request.get('/api/codes', {
      params: buildQueryParams(page, pageSize),
    })
    const data = resp.data.data || {}
    const rows = (data.list || data || []) as any[]
    const normalized = rows.map((r) => ({
      ...r,
      expireAt: typeof r.expireAt === 'undefined' ? r.expiredAt : r.expireAt,
      userMsg: typeof r.userMsg === 'undefined' ? r.customerInfo : r.userMsg,
    }))
    allRows = allRows.concat(normalized)
    totalCount = Number(data.total || normalized.length || 0)
    page += 1
    if (!rows.length) break
  } while (allRows.length < totalCount)

  return allRows
}

const getExportRows = async () => {
  if (exportForm.scope === 'selected') return selectedRows.value
  if (exportForm.scope === 'page') return list.value
  return await loadAllCodesForExport()
}

const buildExportLine = (row: CodeItem) => {
  if (exportForm.onlyCode) return row.code

  const fields = [
    row.code,
    cardTypeMap[row.cardType] || row.cardType || '',
    row.projectName || row.projectId || '',
    formatDateTime(row.createdAt) || '',
    formatDateTime(row.activatedAt) || '',
    row.remark || '',
    row.unbindPassword || '',
  ]

  return exportForm.saveAsExcel
    ? fields.map((item) => `${item ?? ''}`.replace(/\t/g, ' ')).join('\t')
    : fields.map((item) => `${item ?? ''}`).join(',')
}

const submitExport = async () => {
  try {
    const rows = await getExportRows()
    if (!rows.length) {
      ElMessage.warning('没有可导出的数据')
      return
    }

    const chunkSize = Math.max(Number(exportForm.linesPerGroup) || 1, 1)
    const lines = rows.map(buildExportLine)
    const contentLines: string[] = []
    lines.forEach((line, index) => {
      contentLines.push(line)
      if ((index + 1) % chunkSize === 0 && index !== lines.length - 1) {
        contentLines.push('')
      }
    })

    const content = contentLines.join('\r\n')
    const blob = new Blob([content], {
      type: exportForm.saveAsExcel
        ? 'application/vnd.ms-excel;charset=utf-8'
        : 'text/plain;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `注册码导出_${getExportTimestamp()}.${exportForm.saveAsExcel ? 'xls' : 'txt'}`
    a.click()
    URL.revokeObjectURL(url)
    exportDialogVisible.value = false
    ElMessage.success('导出成功')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '导出失败')
  }
}

const triggerImportFile = () => {
  importFileInputRef.value?.click()
}

const handleImportFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!/\.txt$/i.test(file.name)) {
    ElMessage.warning('仅支持导入 .txt 文件')
    input.value = ''
    return
  }

  importForm.fileName = file.name
  importForm.fileContent = await file.text()
  input.value = ''
}

const submitImport = async () => {
  if (!importForm.projectId) {
    ElMessage.warning('请选择项目名称')
    return
  }
  if (!importForm.fileContent.trim()) {
    ElMessage.warning('请先选择要导入的 .txt 文件')
    return
  }

  importSubmitting.value = true
  try {
    await request.post('/api/codes/import', {
      projectId: importForm.projectId,
      delimiter: importForm.delimiter,
      content: importForm.fileContent,
    })
    importDialogVisible.value = false
    ElMessage.success('导入成功')
    fetchList()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || err?.message || '导入失败')
  } finally {
    importSubmitting.value = false
  }
}

// 清理已过期
const handleCleanupExpired = async () => {
  try {
    await ElMessageBox.confirm('确定要清理所有已过期的注册码吗？', '警告', {
      type: 'error',
    })
    await request.delete('/api/codes/cleanup-expired')
    ElMessage.success('清理成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || '清理失败')
    }
  }
}

// 卡类型映射
const cardTypeMap: Record<string, string> = {
  trial: '试用卡',
  hour: '小时卡',
  day: '天卡',
  week: '周卡',
  month: '月卡',
  quarter: '季卡',
  half_year: '半年卡',
  year: '年卡',
  permanent: '永久卡',
}

// 状态映射
const statusMap: Record<string, { text: string; color: string }> = {
  unused: { text: '未使用', color: '#909399' },
  in_use: { text: '使用中', color: '#67c23a' },
  expired: { text: '已过期', color: '#f56c6c' },
  frozen: { text: '已冻结', color: '#e6a23c' },
}



// 分页变化
const handlePageChange = (page: number) => {
  filters.currentPage = page
  fetchList()
  relayoutTable()
}

const handleSizeChange = (size: number) => {
  filters.pageSize = size
  filters.currentPage = 1
  fetchList()
  relayoutTable()
}

const readProjectContext = () => {
  const raw = sessionStorage.getItem('codesListProjectContext')
  if (!raw) return ''

  sessionStorage.removeItem('codesListProjectContext')

  try {
    const parsed = JSON.parse(raw) as { projectId?: string; from?: string; at?: number }
    if (parsed?.from !== 'projects-list') return ''
    if (!parsed?.projectId) return ''
    if (parsed?.at && Date.now() - parsed.at > 5 * 60 * 1000) return ''
    return parsed.projectId
  } catch {
    return ''
  }
}

const applyRouteProjectFilter = () => {
  const projectId = readProjectContext()
  if (!projectId) return
  filters.projectId = projectId
  filters.currentPage = 1
}

// 批量解绑
const handleBatchUnbind = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择注册码')
  try {
    await ElMessageBox.confirm(`确定要解绑选中的 ${selectedRows.value.length} 个注册码吗？`, '提示', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.id)
    await request.post('/api/codes/batch/unbind', { ids })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '解绑成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((selectedRows.value.length > 1 ? '批量' : '') + '解绑失败')
  }
}

// 批量改项目类型
const handleBatchChangeProject = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择注册码')
  batchProjectForm.projectId = ''
  batchProjectDialogVisible.value = true
}

const submitBatchChangeProject = async () => {
  if (!batchProjectForm.projectId) {
    ElMessage.warning('请选择新的项目名称')
    return
  }

  try {
    const ids = selectedRows.value.map(r => r.id)
    await request.post('/api/codes/batch/project', { ids, projectId: batchProjectForm.projectId })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '修改项目成功')
    batchProjectDialogVisible.value = false
    fetchList()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || (selectedRows.value.length > 1 ? '批量' : '') + '修改项目失败')
  }
}

// 批量改备注
const handleBatchChangeNote = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择注册码')
  try {
    const { value } = await ElMessageBox.prompt('请输入新的备注', '批量修改备注')
    const ids = selectedRows.value.map(r => r.id)
    await request.post('/api/codes/batch/remark', { ids, remark: value })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '修改备注成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((selectedRows.value.length > 1 ? '批量' : '') + '修改备注失败')
  }
}

// 批量恢复
const handleBatchRecover = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择注册码')
  try {
    await ElMessageBox.confirm(`确定要恢复选中的 ${selectedRows.value.length} 个注册码吗？`, '提示', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.id)
    await request.post('/api/codes/batch/recover', { ids })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '恢复成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((selectedRows.value.length > 1 ? '批量' : '') + '恢复失败')
  }
}

// 批量续费
const handleBatchRecharge = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择注册码')
  try {
    const { value } = await ElMessageBox.prompt('请输入续费天数', '批量续费', {
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入数字'
    })
    const ids = selectedRows.value.map(r => r.id)
    await request.post('/api/codes/batch/renew', { ids, days: parseInt(value) })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '续费成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error((selectedRows.value.length > 1 ? '批量' : '') + '续费失败')
  }
}

// 批量重置解绑密码
const handleBatchChangePassword = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择注册码')
  try {
    const { value } = await ElMessageBox.prompt('请输入新的解绑密码', '重置解绑密码', {
      inputType: 'password'
    })
    const ids = selectedRows.value.map(r => r.id)
    await request.post('/api/codes/batch/unbind-password', { ids, password: value })
    ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '重置密码成功')
    fetchList()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败')
  }
}

// 批量添加IP黑名单
const handleBatchAddIP = async () => {
  if (!selectedRows.value.length) return ElMessage.warning('请先选择注册码')
  try {
    await ElMessageBox.confirm(`确定将选中注册码的登录IP加入黑名单吗？`, '提示', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.id)
    await request.post('/api/codes/batch/blacklist-ip', { ids })
    ElMessage.success('已加入黑名单')
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('操作失败')
  }
}

// 保存客户信息（示例：调用后端接口）
const saveUserMsg = async () => {
  if (!currentRow.value) return

  try {
    await request.patch(`/api/codes/${currentRow.value.id}/customer-info`, {
      customerInfo: currentRow.value.userMsg,
    })
    ElMessage.success('客户信息保存成功')
    fetchList()
  } catch (err: any) {
    ElMessage.error(err.response?.data?.message || '保存失败')
  }
}

onMounted(() => {
  fetchProjects()
  applyRouteProjectFilter()
  fetchList()
  relayoutTable()
})

watch(
  () => route.query.projectId,
  (projectId) => {
    const nextProjectId = typeof projectId === 'string' ? projectId : ''
    if (!nextProjectId || nextProjectId === filters.projectId) return
    filters.projectId = nextProjectId
    filters.currentPage = 1
    fetchList()
  },
)
</script>

<template>
  <div class="codes-list-page vs-page-shell">
    <section class="vs-page-header">
      <div>
        <h2 class="vs-page-title">注册码列表</h2>
        <p class="vs-page-subtitle">聚合筛选、批量操作和详情查看，维持统一的后台信息密度和交互节奏。</p>
      </div>
      <div class="header-summary">
        <div class="summary-box">
          <span>Current Page</span>
          <strong>{{ filters.currentPage }}</strong>
        </div>
        <div class="summary-box">
          <span>Total Items</span>
          <strong>{{ total }}</strong>
        </div>
      </div>
    </section>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <!-- 第一行 -->
      <div class="filter-row">
        <span class="filter-label">选择时间：</span>
        <el-select v-model="filters.timeType" size="small" style="width: 110px">
          <el-option label="激活时间" value="activated" />
          <el-option label="到期时间" value="expired" />
          <el-option label="最后登录" value="lastLogin" />
        </el-select>
        <el-date-picker v-model="filters.startTime" type="date" placeholder="" size="small" style="width: 140px" />
        <span>至</span>
        <el-date-picker v-model="filters.endTime" type="date" placeholder="" size="small" style="width: 140px" />
        <span class="filter-label">注册码：</span>
        <el-input v-model="filters.code" size="small" style="width: 180px" clearable />
        <span class="filter-label">机器码：</span>
        <el-input v-model="filters.machineCode" size="small" style="width: 180px" clearable />
      </div>

      <!-- 第二行 -->
      <div class="filter-row tableuse">
        <span class="filter-label">使用状态：</span>
        <el-checkbox-group v-model="filters.usageStatuses">
          <el-checkbox label="unused">未使用</el-checkbox>
          <el-checkbox label="in_use">使用中</el-checkbox>
          <el-checkbox label="expired">已过期</el-checkbox>
          <el-checkbox label="deleted">已删除</el-checkbox>
        </el-checkbox-group>

        <span class="filter-label ml-20">操作状态：</span>
        <el-checkbox-group v-model="filters.operationFlags">
          <el-checkbox label="bound">已绑定</el-checkbox>
          <el-checkbox label="frozen">已冻结</el-checkbox>
        </el-checkbox-group>

        <span class="filter-label ml-20">卡类型：</span>
        <el-checkbox-group v-model="filters.cardTypes">
          <el-checkbox label="hour">小时卡</el-checkbox>
          <el-checkbox label="day">天卡</el-checkbox>
          <el-checkbox label="week">周卡</el-checkbox>
          <el-checkbox label="month">月卡</el-checkbox>
          <el-checkbox label="quarter">季卡</el-checkbox>
          <el-checkbox label="half_year">半年卡</el-checkbox>
          <el-checkbox label="year">年卡</el-checkbox>
          <el-checkbox label="permanent">永久卡</el-checkbox>
        </el-checkbox-group>
      </div>

      <!-- 第三行 -->
      <div class="filter-row">
        <span class="filter-label">项目名称：</span>
        <el-select v-model="filters.projectId" size="small" style="width: 150px">
          <el-option label="所有项目" value="" />
          <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>

        <span class="filter-label">在线状态：</span>
        <el-select v-model="filters.onlineStatus" size="small" style="width: 100px">
          <el-option label="所有" value="all" />
          <el-option label="在线" value="online" />
          <el-option label="离线" value="offline" />
        </el-select>

        <span class="filter-label">销售状态：</span>
        <el-select v-model="filters.saleType" size="small" style="width: 120px">
          <el-option label="所有" value="all" />
          <el-option label="作者生成" value="author_generated" />
          <el-option label="自动发卡" value="auto_issue" />
        </el-select>

        <el-button type="primary" size="small" :icon="Search" @click="handleSearch">查询</el-button>
        <el-button size="small" :icon="Refresh" @click="resetFilters">重置</el-button>
      </div>
    </div>

    <div class="tableColums">

      <!-- 第四行 - 统计和跳转 -->
      <div class="filter-row table_flexrow">
        <el-checkbox label="" size="large" @change="handleSelectAllColumn" />
        <el-button link type="primary" size="small" @click="handleBatchFreeze">冻结</el-button>
        <el-button link type="primary" size="small" @click="handleBatchUnfreeze">解冻</el-button>
        <el-button link type="primary" size="small" @click="handleBatchUnbind">解绑</el-button>
        <el-button link type="primary" size="small" @click="handleBatchChangeProject">改项目类型</el-button>
        <el-button link type="primary" size="small" @click="handleBatchChangeNote">改备注</el-button>
        <el-button link type="primary" size="small" @click="handleBatchDelete">删除</el-button>
        <el-button link type="primary" size="small" @click="handleBatchRecover">恢复</el-button>
        <el-button link type="primary" size="small" @click="handleBatchRecharge">续费</el-button>
        <el-button link type="primary" size="small" @click="handleBatchChangePassword">重置解绑密码</el-button>
        <el-button link type="primary" size="small" @click="handleBatchAddIP">添加IP到黑名单</el-button>
        <el-button link type="primary" size="small" :icon="Download" @click="openExportDialog">导出注册码</el-button>
        <el-button link type="primary" size="small" :icon="Upload" @click="openImportDialog">导入注册码</el-button>
        <el-button link type="primary" :icon="Delete" @click="handleCleanupExpired">清理已过期</el-button>
      </div>
      <!-- 表格 -->
      <div class="table-main">
        <el-table ref="tableRef" :data="list" height="767" :max-height="tableheight" stripe v-loading="loading" :cell-style="{ textAlign: 'center' }" :header-cell-style="{ 'text-align': 'center' }"
          @row-click="handleRowClick" @selection-change="handleSelectionChange" style="width: 100%">
          <el-table-column type="selection" width="40" />
          <!-- <el-table-column type="index" width="40" /> -->
          <el-table-column prop="code" label="注册码" width="280" />
          <el-table-column label="卡类型" width="60">
            <template #default="{ row }">
              {{ cardTypeMap[row.cardType] || row.cardType }}
            </template>
          </el-table-column>
          <el-table-column prop="projectName" label="项目类型" width="100" />
          <el-table-column label="状态" width="60">
            <template #default="{ row }">
              <span :style="{ color: statusMap[row.status]?.color || '#909399' }">
                {{ statusMap[row.status]?.text || row.status }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="激活时间/到期时间/最后访问时间" width="240">
            <template #default="{ row }">
              <div class="time-info">
                <div>{{ formatDateTime(row.activatedAt, 'yyyy-MM-dd') || '未使用' }} / {{ formatDateTime(row.expireAt, 'yyyy-MM-dd') || '未使用' }} / {{ formatDateTime(row.lastLoginAt, 'yyyy-MM-dd') || '未使用' }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="在线" width="60">
            <template #default="{ row }">
              <span :style="{ color: row.isOnline ? '#67c23a' : '#909399' }">
                {{ row.isOnline ? '在线' : '离线' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注">
			  <template #default="{ row }">
			    <div class="time-info" :title="row.remark">
			      <div>{{ row.remark }}</div>
			    </div>
			  </template>
		  </el-table-column>
          <el-table-column label="解绑密码" width="80">
            <template #default="{ row }">
              {{ row.unbindPassword || '未设置' }}
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <div class="time-info">
				<el-link v-if="!row.isBound" type="info" disabled>未绑</el-link> 
                <el-link v-else type="primary" size="small" @click.stop="handleUnbind(row)">解绑</el-link>
				
                <el-link :type="row.status === 'frozen' ? 'success' : 'warning'" size="small"
                  @click.stop="row.status === 'frozen' ? handleUnfreeze(row) : handleFreeze(row)">
                  {{ row.status === 'frozen' ? '解冻' : '冻结' }}
                </el-link>
                <el-link type="primary" size="small" @click.stop="handleRenew(row)">续费</el-link>
				
				<el-link v-if="!row.isOnline" type="info" disabled>离线</el-link>
                <el-link v-else type="primary" size="small" @click.stop="handleOffline(row)">下线</el-link>
                <el-link type="danger" size="small" @click.stop="handleDelete(row)">删除</el-link>
              </div>
            </template>
          </el-table-column>
          <!-- <el-table-column label="卡卡—卡类型">
            <template #default="{ row }">
              {{ row.saleType ? saleTypeMap[row.saleType] : '-' }}
            </template>
          </el-table-column> -->
        </el-table>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination v-model:current-page="filters.currentPage" v-model:page-size="filters.pageSize"
          :page-sizes="[20, 50, 80, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper" prev-text="上一页" next-text="下一页"
          @current-change="handlePageChange" @size-change="handleSizeChange" />
      </div>
    </div>

    <!-- 详情弹窗（底部，无遮罩） -->
    <div v-show="showDetail" class="codes-detail">
      <p style="text-align: right;"><el-button type="primary" link style="margin-right:10px;" @click="showDetail = false">【关闭】</el-button></p>
      <table class="detail-table" v-if="currentRow">
        <tbody>
        <tr>
          <td class="label-cell">注册码</td>
          <td class="value-cell">{{ currentRow.code }}</td>
          <td class="label-cell">项目名称</td>
          <td class="value-cell">{{ currentRow.projectName || currentRow.projectId }}</td>
          <td class="label-cell">解绑密码</td>
          <td class="value-cell">{{ currentRow.unbindPassword || '未设置' }}</td>
          <td class="label-cell">卡类型</td>
          <td class="value-cell">{{ cardTypeMap[currentRow.cardType] || currentRow.cardType }}</td>
        </tr>
        <tr>
          <td class="label-cell">创建时间</td>
          <td class="value-cell">{{ formatDateTime(currentRow.createdAt) || '-' }}</td>
          <td class="label-cell">激活时间</td>
          <td class="value-cell">{{ formatDateTime(currentRow.activatedAt) || '未激活' }}</td>
          <td class="label-cell">到期时间</td>
          <td class="value-cell">{{ formatDateTime(currentRow.expireAt) || '未设置' }}</td>
          <td class="label-cell">最后登录</td>
          <td class="value-cell">{{ formatDateTime(currentRow.lastLoginAt) || '-' }}</td>
        </tr>
        <tr>
          <td class="label-cell">使用状态</td>
          <td class="value-cell">
            <span :style="{ color: statusMap[currentRow.status]?.color }">
              {{ statusMap[currentRow.status]?.text }}
            </span>
          </td>
          <td class="label-cell">在线状态</td>
          <td class="value-cell">
            <span :style="{ color: currentRow.isOnline ? '#67c23a' : '#909399' }">
              {{ currentRow.isOnline ? '在线' : '离线' }}
            </span>
          </td>
          <td class="label-cell">登录IP地址</td>
          <td class="value-cell">{{ currentRow.lastLoginIp || '-' }}</td>
          <td class="label-cell">是否绑定</td>
          <td class="value-cell">{{ currentRow.isBound ? '已绑定' : '未绑定' }}</td>
        </tr>
        <tr>
          <td class="label-cell">机器码</td>
          <td class="value-cell" colspan="3">{{ currentRow.machineCode || '未绑定' }}</td>
          <td class="label-cell">客户信息</td>
          <td class="value-cell" colspan="3">
            <div style="display: flex; gap: 8px; align-items: center;">
              <el-input v-model="currentRow.userMsg" size="small" placeholder="请输入客户信息" />
              <el-button size="small" type="primary" @click="saveUserMsg">保存</el-button>
            </div>
          </td>
        </tr>
        <tr>
          <td class="label-cell">备注</td>
          <td class="value-cell" colspan="7">
            <el-input v-model="currentRow.remark" size="small" readonly />
          </td>
        </tr>
        </tbody>
      </table>
    </div>

    <el-dialog
      v-model="exportDialogVisible"
      title="导出注册码"
      width="520px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="122px" class="dialog-form">
        <el-form-item label="导出内容：">
          <div class="dialog-static-text">注册码、卡类型、项目类型、生成时间、激活时间、备注信息、解绑密码</div>
        </el-form-item>
        <el-form-item label="每多少条分行符：">
          <el-input-number v-model="exportForm.linesPerGroup" :min="1" :step="1" controls-position="right" style="width: 180px" />
        </el-form-item>
        <el-form-item label="导出范围：">
          <el-radio-group v-model="exportForm.scope" class="export-radio-group">
            <el-radio label="selected" :disabled="!hasSelection">选中的注册码</el-radio>
            <el-radio label="page">本页注册码</el-radio>
            <el-radio label="all">全部注册码</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="只导出注册码：">
          <el-checkbox v-model="exportForm.onlyCode" />
        </el-form-item>
        <el-form-item label="保存为 excel：">
          <el-checkbox v-model="exportForm.saveAsExcel" />
          <span class="dialog-hint">默认保存为 txt 文件</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitExport">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="importDialogVisible"
      title="导入注册码"
      width="720px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="108px" class="dialog-form">
        <el-form-item label="项目名称：">
          <el-select v-model="importForm.projectId" placeholder="请选择项目名称" style="width: 240px">
            <el-option
              v-for="item in projects"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="上传文件：">
          <div class="export-file-row">
            <el-input :model-value="importForm.fileName" readonly placeholder="请选择 .txt 文件" style="width: 260px" />
            <el-button @click="triggerImportFile">选择文件</el-button>
            <input
              ref="importFileInputRef"
              type="file"
              accept=".txt,text/plain"
              class="hidden-file-input"
              @change="handleImportFileChange"
            />
          </div>
        </el-form-item>
        <el-form-item label="分割符：">
          <el-select v-model="importForm.delimiter" style="width: 180px">
            <el-option label="逗号(,)" value="," />
            <el-option label="分号(;)" value=";" />
            <el-option label="Tab" value="\t" />
          </el-select>
        </el-form-item>
        <el-form-item label="导入说明：">
          <div class="import-guide">
            <p>从其它系统导出的注册码数据，可直接按当前选择的分割符导入。</p>
            <p>导入格式支持：注册码{{ getDelimiterLabel(importForm.delimiter) }}激活时间{{ getDelimiterLabel(importForm.delimiter) }}到期时间{{ getDelimiterLabel(importForm.delimiter) }}卡类型。</p>
            <p>示例：AAAAAAA{{ importForm.delimiter === '\t' ? '    ' : importForm.delimiter }}2016-01-01 00:00:00{{ importForm.delimiter === '\t' ? '    ' : importForm.delimiter }}2016-02-01 00:00:00{{ importForm.delimiter === '\t' ? '    ' : importForm.delimiter }}月卡</p>
            <p class="import-warning">注意：文件编码必须为 UTF-8，当前只支持导入 .txt 文件。</p>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importSubmitting" @click="submitImport">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="batchProjectDialogVisible"
      title="批量修改项目"
      width="460px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="112px" class="dialog-form">
        <el-form-item label="新的项目：">
          <el-select v-model="batchProjectForm.projectId" placeholder="请选择项目名称" style="width: 100%">
            <el-option
              v-for="item in projects"
              :key="item.id"
              :label="item.name"
              :value="item.id"
              :disabled="selectedProjectIds.includes(item.id)"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="当前所属项目：">
          <div class="project-tip">
            {{ selectedRows.map((row) => row.projectName || row.projectId).filter((value, index, array) => array.indexOf(value) === index).join('、') }}
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="batchProjectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitBatchChangeProject">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped lang="scss">
.codes-list-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
  height: 100%;
  min-height: 0;
  //overflow: hidden;
  box-sizing: border-box;

  .header-summary {
    display: flex;
    gap: 12px;
  }

  .summary-box {
    min-width: 136px;
    padding: 12px 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(148, 163, 184, 0.16);

    span {
      display: block;
      font-size: 12px;
      color: #7a8aa2;
      font-weight: 600;
    }

    strong {
      display: block;
      margin-top: 6px;
      font-size: 20px;
      line-height: 1;
      color: #172033;
    }
  }

  .filter-section {
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.88);
    padding: 18px;
    border-radius: 14px;
    border: 1px solid rgba(148, 163, 184, 0.18);
    box-shadow: 0 16px 32px rgba(15, 23, 42, 0.06);

    .filter-label {
      color: #607089;
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }

    .ml-20 {
      margin-left: 20px;
    }
  }

  .tableColums {
    // flex: 1;
    // display: flex;
    // flex-direction: column;
    // min-height: 0;
    //overflow: hidden;
    //background: rgba(255, 255, 255, 0.88);
    //padding: 18px;
    //border-radius: 24px;
    //border: 1px solid rgba(148, 163, 184, 0.18);
    //box-shadow: 0 16px 32px rgba(15, 23, 42, 0.06);
    box-sizing: border-box;

    .filter-row {
      display: flex;
      align-items: center;
      //gap: 10px;
      margin-bottom: 0;
      flex-wrap: wrap;
    }

    .table-main {
      // flex: 1;
      // height: 0;
      // min-height: 0;
      // overflow: hidden;
      // display: flex;
      // flex-direction: column;
    }

    .pagination-wrap {
      flex-shrink: 0;
      padding: 24px 6px 0;
      display: flex;
      justify-content: center;
    }
  }

  .stats-text {
    color: #606266;
    font-size: 14px;
    flex: 1;
  }
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;

  &.table_flexrow {
    gap: 12px 16px;
    justify-content: flex-start;
    margin-bottom: 16px;
    padding: 0px 16px;
        border-radius: 4px;
        background: linear-gradient(135deg, rgba(189, 216, 249, 0.96), rgba(219, 247, 245, 0.92));
        box-shadow: 0 3px 6px rgb(210 221 253 / 96%);
    //border: 1px solid rgba(148, 163, 184, 0.16);
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.time-info {
  font-size: 12px;
  line-height: 1.6;
  display: flex;
  gap: 10px;
	justify-content: center;
  div {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

// Detail dialog styles
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  td {
    border: 1px solid rgba(148, 163, 184, 0.18);
    padding: 10px 12px;
  }

  .label-cell {
    background: #f7faff;
    font-weight: 500;
    color: #607089;
    width: 100px;
    text-align: right;
  }

  .value-cell {
    color: #172033;
  }
}

v-deep .el-checkbox {
  margin-right: 0;
}

.codes-detail {
  background: rgba(255, 255, 255, 0.94);
  padding: 8px 12px 12px;
  position: fixed;
  left: 50%;
  bottom: 16px;
  width: min(calc(100vw - 32px), 1400px);
  transform: translateX(-50%);
  z-index: 30;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.08);
  max-height: 45vh;
  overflow: auto;
  border-radius: 20px;
}

.dialog-form {
  .project-tip {
    color: #606266;
    line-height: 1.6;
    word-break: break-all;
  }

  .dialog-static-text {
    color: #334155;
    line-height: 1.7;
  }

  .dialog-hint {
    margin-left: 10px;
    color: #ef4444;
    font-size: 12px;
  }

  .export-radio-group {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }

  .export-file-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .hidden-file-input {
    display: none;
  }

  .import-guide {
    color: #ef4444;
    line-height: 1.9;
    word-break: break-all;

    p {
      margin: 0;
    }
  }

  .import-warning {
    font-weight: 700;
  }
}

:deep(.el-button.is-link) {
  font-weight: 700;
}

:deep(.el-table) {
  flex: 1;
  min-height: 0;
}
:deep(.el-table .cell) {
  padding:0 6px;
}
:deep(.el-table .el-table__cell) {
   padding: 6px 0;
}
:deep(.el-checkbox) {
	margin-right:5px;
}
:deep(.el-button.is-link:hover) {
	color:#f56c6c;
}
@media (max-width: 820px) {
  .codes-list-page {
    .header-summary {
      width: 100%;
    }

    .summary-box {
      flex: 1;
      min-width: 0;
    }
  }

  .codes-detail {
    width: calc(100vw - 32px);
  }
}
</style>
