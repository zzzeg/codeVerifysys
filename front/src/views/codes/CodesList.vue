<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Download, Upload, Delete, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import request from '../../utils/request'
import { formatDateTime } from '../../utils/datetime'
import { useAuthStore } from '../../store/auth'
import { isAdminUser } from '../../utils/authScope'
import { copyText } from '../../utils/clipboard'

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
  developerId?: string
  developerUsername?: string
  developerCode?: string
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
  developerKeyword: '',
  onlineStatus: '', // all, online, offline
  saleType: '', // all, author_generated, auto_issue
  pageSize: 20,
  currentPage: 1,
})

const auth = useAuthStore()
const list = ref<CodeItem[]>([])
const loading = ref(false)
const total = ref(0)
const selectedRows = ref<CodeItem[]>([])
const currentRow = ref<CodeItem | null>(null)
const showDetail = ref(false)
const projects = ref<any[]>([])
const tableRef = ref<any>()
const route = useRoute()
const isMobile = ref(false)
const filterExpanded = ref(true)
const filterDrawerOpen = ref(false)
const batchActionSheetOpen = ref(false)
const batchProjectDialogVisible = ref(false)
const renewDialogVisible = ref(false)
const renewSubmitting = ref(false)
const renewMode = ref<'single' | 'batch'>('single')
const renewTarget = ref<CodeItem | null>(null)
const exportDialogVisible = ref(false)
const importDialogVisible = ref(false)
const importSubmitting = ref(false)
const importFileInputRef = ref<HTMLInputElement | null>(null)
const batchProjectForm = reactive({
  projectId: '',
})
const renewForm = reactive({
  unit: 'day',
  quantity: 1,
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
const listRequestId = ref(0)
const projectsRequestId = ref(0)

const hasSelection = computed(() => selectedRows.value.length > 0)
const canViewDeveloper = computed(() => isAdminUser(auth.currentUser))
const deletedSelectionCount = computed(() => selectedRows.value.filter((row) => row.status === 'deleted').length)
const hasDeletedSelection = computed(() => deletedSelectionCount.value > 0)
const hasOnlyDeletedSelection = computed(() => hasSelection.value && deletedSelectionCount.value === selectedRows.value.length)
const selectedProjectIds = computed(() =>
  Array.from(new Set(selectedRows.value.map((row) => row.projectId).filter(Boolean)))
)
const activeFilterCount = computed(() => {
  const scalarFilters = [
    filters.startTime,
    filters.endTime,
    filters.code,
    filters.machineCode,
    filters.projectId,
    canViewDeveloper.value ? filters.developerKeyword : '',
    filters.onlineStatus && filters.onlineStatus !== 'all' ? filters.onlineStatus : '',
    filters.saleType && filters.saleType !== 'all' ? filters.saleType : '',
  ].filter(Boolean).length

  return (
    scalarFilters +
    filters.usageStatuses.length +
    filters.operationFlags.length +
    filters.cardTypes.length
  )
})
const renewUnitOptions = [
  { label: '小时卡', shortLabel: '小时', value: 'hour', days: 1 / 24 },
  { label: '天卡', shortLabel: '天', value: 'day', days: 1 },
  { label: '周卡', shortLabel: '周', value: 'week', days: 7 },
  { label: '月卡', shortLabel: '月', value: 'month', days: 30 },
  { label: '季卡', shortLabel: '季', value: 'quarter', days: 90 },
  { label: '半年卡', shortLabel: '半年', value: 'half_year', days: 180 },
  { label: '年卡', shortLabel: '年', value: 'year', days: 365 },
]
const selectedRenewUnit = computed(
  () => renewUnitOptions.find((item) => item.value === renewForm.unit) || renewUnitOptions[1]!,
)
const renewQuantity = computed(() => {
  const value = Number(renewForm.quantity)
  return Number.isFinite(value) && value !== 0 ? value : 1
})
const renewDurationMs = computed(() => Math.round(selectedRenewUnit.value.days * renewQuantity.value * 86400000))
const renewTotalDays = computed(() => selectedRenewUnit.value.days * renewQuantity.value)
const renewTotalDaysText = computed(() => {
  const days = renewTotalDays.value
  const absDays = Math.abs(days)
  const prefix = days < 0 ? '-' : ''
  if (absDays < 1) return `${prefix}${Math.round(absDays * 24)} 小时`
  return `${prefix}${Number.isInteger(absDays) ? absDays : absDays.toFixed(2)} 天`
})
const renewBaseTime = computed(() => {
  if (renewMode.value !== 'single' || !renewTarget.value) return Date.now()
  const expireAt = Number(renewTarget.value.expireAt || 0)
  const now = Date.now()
  if (renewDurationMs.value > 0) return expireAt > now ? expireAt : now
  return expireAt || now
})
const renewPreviewExpireAt = computed(() => renewBaseTime.value + renewDurationMs.value)
const renewDialogTitle = computed(() => (renewMode.value === 'batch' ? '批量续费' : '续费'))
const renewActionText = computed(() => (renewDurationMs.value < 0 ? '扣除' : '续费'))
const paginationLayout = computed(() =>
  isMobile.value ? 'total, prev, pager, next' : 'total, sizes, prev, pager, next, jumper',
)

const relayoutTable = () => {
  nextTick(() => {
    tableRef.value?.doLayout?.()
  })
}

const updateViewportState = () => {
  const nextIsMobile = window.innerWidth <= 768
  if (nextIsMobile !== isMobile.value) {
    filterExpanded.value = !nextIsMobile
  }
  isMobile.value = nextIsMobile
  relayoutTable()
}

const operationColumnWidth = computed(() => (isMobile.value ? 180 : 190))

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
  if (canViewDeveloper.value && filters.developerKeyword) params.developerKeyword = filters.developerKeyword
  if (filters.onlineStatus && filters.onlineStatus !== 'all') params.isOnline = filters.onlineStatus === 'online'
  if (filters.saleType && filters.saleType !== 'all') params.saleType = filters.saleType

  return params
}

// 获取项目列表
const fetchProjects = async () => {
  const requestId = ++projectsRequestId.value
  try {
    const resp = await request.get('/api/projects', { params: { page: 1, pageSize: 200 } })
    if (requestId !== projectsRequestId.value) return
    projects.value = resp.data.data.list || resp.data.data || []
  } catch (err) {
    console.error('获取项目列表失败', err)
  }
}

// 获取注册码列表
const fetchList = async () => {
  const requestId = ++listRequestId.value
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
    if (requestId !== listRequestId.value) return

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
    if (requestId !== listRequestId.value) return
    console.log("err is", err)
    ElMessage.error(err?.message || '获取列表失败')
  } finally {
    if (requestId === listRequestId.value) {
      loading.value = false
    }
  }
}

const handleSearch = () => {
  filters.currentPage = 1
  fetchList()
  if (isMobile.value) filterDrawerOpen.value = false
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
    developerKeyword: '',
    onlineStatus: '',
    saleType: '',
    pageSize: 20,
    currentPage: 1,
  })
  fetchList()
}

const toggleFilterPanel = () => {
  if (isMobile.value) {
    filterDrawerOpen.value = true
    return
  }
  filterExpanded.value = !filterExpanded.value
  relayoutTable()
}

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
  renewMode.value = 'single'
  renewTarget.value = row
  renewForm.unit = row.cardType && renewUnitOptions.some((item) => item.value === row.cardType) ? row.cardType : 'day'
  renewForm.quantity = 1
  renewDialogVisible.value = true
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
    await ElMessageBox.confirm('确定要删除该注册码吗？', '警告', {
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

const handleRecover = async (row: CodeItem) => {
  try {
    await ElMessageBox.confirm('确定要恢复该注册码吗？', '提示', {
      type: 'warning',
    })
    await request.post('/api/codes/batch/recover', { ids: [row.id] })
    ElMessage.success('恢复成功')
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || '恢复失败')
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
  if (hasDeletedSelection.value && !hasOnlyDeletedSelection.value) {
    ElMessage.warning('彻底删除时请仅选择状态为已删除的注册码')
    return
  }
  try {
    const ids = selectedRows.value.map((r) => r.id)
    if (hasOnlyDeletedSelection.value) {
      await ElMessageBox.confirm(
        `确定要彻底删除选中的 ${selectedRows.value.length} 个注册码吗？`, //该操作会从数据库中移除，无法恢复！
        '警告',
        {
          type: 'error',
          confirmButtonText: '确定彻底删除',
          cancelButtonText: '取消',
        }
      )
      await request.post('/api/codes/batch/hard-delete', { ids })
      ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '删除成功') //彻底删除
    } else {
      await ElMessageBox.confirm(
        `确定要删除选中的 ${selectedRows.value.length} 个注册码吗？`,
        '提示',
        {
          type: 'warning',
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
        }
      )
      await request.post('/api/codes/batch/delete', { ids })
      ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '删除成功')
    }
    fetchList()
  } catch (err: any) {
    if (err !== 'cancel') {
      ElMessage.error(err.response?.data?.message || (selectedRows.value.length > 1 ? '批量' : '') + (hasOnlyDeletedSelection.value ? '彻底删除失败' : '删除失败'))
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
  deleted: { text: '已删除', color: '#c0c4cc' },
}

const getStatusText = (status?: string) => statusMap[status || '']?.text || '未知状态'
const getStatusColor = (status?: string) => statusMap[status || '']?.color || '#909399'

const copyToClipboard = async (text: string) => {
  const ok = await copyText(text)
  if (ok) {
    ElMessage.success('复制成功')
    return
  }
  ElMessage.error('复制失败，请长按文本手动复制')
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
  renewMode.value = 'batch'
  renewTarget.value = null
  renewForm.unit = 'day'
  renewForm.quantity = 1
  renewDialogVisible.value = true
}

const submitRenew = async () => {
  if (!Number.isFinite(Number(renewForm.quantity)) || Number(renewForm.quantity) === 0) {
    ElMessage.warning('请输入非 0 数量')
    return
  }

  const payload = {
    unit: renewForm.unit,
    quantity: renewQuantity.value,
    durationMs: renewDurationMs.value,
  }

  renewSubmitting.value = true
  try {
    if (renewMode.value === 'single') {
      if (!renewTarget.value) return
      await request.patch(`/api/codes/${renewTarget.value.id}/renew`, payload)
      ElMessage.success('续费成功')
    } else {
      const ids = selectedRows.value.map(r => r.id)
      await request.post('/api/codes/batch/renew', { ids, ...payload })
      ElMessage.success((selectedRows.value.length > 1 ? '批量' : '') + '续费成功')
    }
    renewDialogVisible.value = false
    fetchList()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || (renewMode.value === 'batch' ? '批量续费失败' : '续费失败'))
  } finally {
    renewSubmitting.value = false
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

onMounted(() => {
  updateViewportState()
  window.addEventListener('resize', updateViewportState)
  fetchProjects()
  applyRouteProjectFilter()
  fetchList()
  relayoutTable()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateViewportState)
  listRequestId.value += 1
  projectsRequestId.value += 1
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
      <div class="filter-section-head">
        <div>
          <strong>筛选条件</strong>
          <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }} 项已选</span>
        </div>
        <el-button link type="primary" :icon="isMobile ? Search : filterExpanded ? ArrowUp : ArrowDown"
          @click="toggleFilterPanel">
          {{ isMobile ? '筛选' : filterExpanded ? '收起' : '展开' }}
        </el-button>
      </div>

      <div v-show="!isMobile && filterExpanded" class="filter-section-body">
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

        <div class="filter-row">
          <span class="filter-label">项目名称：</span>
          <el-select v-model="filters.projectId" size="small" style="width: 150px">
            <el-option label="所有项目" value="" />
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>

          <span v-if="canViewDeveloper" class="filter-label">开发者：</span>
          <el-input v-if="canViewDeveloper" v-model="filters.developerKeyword" size="small" style="width: 150px"
            clearable />

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
    </div>

    <el-drawer v-model="filterDrawerOpen" title="筛选条件" direction="rtl" size="86%" class="codes-filter-drawer"
      append-to-body>
      <div class="filter-section-body drawer-filter-body">
        <div class="drawer-filter-scroll">
          <div class="filter-row">
            <span class="filter-label">选择时间：</span>
            <el-select v-model="filters.timeType" size="small">
              <el-option label="激活时间" value="activated" />
              <el-option label="到期时间" value="expired" />
              <el-option label="最后登录" value="lastLogin" />
            </el-select>
            <el-date-picker v-model="filters.startTime" type="date" placeholder="开始日期" size="small" />
            <el-date-picker v-model="filters.endTime" type="date" placeholder="结束日期" size="small" />
            <span class="filter-label">注册码：</span>
            <el-input v-model="filters.code" size="small" clearable />
            <span class="filter-label">机器码：</span>
            <el-input v-model="filters.machineCode" size="small" clearable />
          </div>

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

          <div class="filter-row">
            <span class="filter-label">项目名称：</span>
            <el-select v-model="filters.projectId" size="small">
              <el-option label="所有项目" value="" />
              <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>

            <span v-if="canViewDeveloper" class="filter-label">开发者：</span>
            <el-input v-if="canViewDeveloper" v-model="filters.developerKeyword" size="small" clearable />

            <span class="filter-label">在线状态：</span>
            <el-select v-model="filters.onlineStatus" size="small">
              <el-option label="所有" value="all" />
              <el-option label="在线" value="online" />
              <el-option label="离线" value="offline" />
            </el-select>

            <span class="filter-label">销售状态：</span>
            <el-select v-model="filters.saleType" size="small">
              <el-option label="所有" value="all" />
              <el-option label="作者生成" value="author_generated" />
              <el-option label="自动发卡" value="auto_issue" />
            </el-select>
          </div>
        </div>
        <div class="drawer-filter-actions">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </div>
      </div>
    </el-drawer>

    <div class="tableColums">

      <div class="mobile-table-actions">
        <el-button size="small" @click="batchActionSheetOpen = true">
          批量/操作<span v-if="selectedRows.length" class="mobile-action-badge">{{ selectedRows.length }}</span>
        </el-button>
        <el-button size="small" :icon="Search" @click="toggleFilterPanel">
          筛选<span v-if="activeFilterCount" class="mobile-action-badge">{{ activeFilterCount }}</span>
        </el-button>
      </div>

      <div class="filter-row table_flexrow">
        <el-checkbox label="" size="large" @change="handleSelectAllColumn" />
        <el-button link type="primary" size="small" @click="handleBatchFreeze">冻结</el-button>
        <el-button link type="primary" size="small" @click="handleBatchUnfreeze">解冻</el-button>
        <el-button link type="primary" size="small" @click="handleBatchUnbind">解绑</el-button>
        <el-button link type="primary" size="small" @click="handleBatchChangeProject">改项目类型</el-button>
        <el-button link type="primary" size="small" @click="handleBatchChangeNote">改备注</el-button>
        <el-button link type="primary" size="small" @click="handleBatchDelete">{{ hasDeletedSelection ? '彻底删除' : '删除'
        }}</el-button>
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
        <el-table ref="tableRef" :data="list" height="100%" stripe v-loading="loading"
          :cell-style="{ textAlign: 'center' }" :header-cell-style="{ 'text-align': 'center' }"
          @row-click="handleRowClick" @selection-change="handleSelectionChange" style="width: 100%">
          <el-table-column type="selection" width="40" />
          <!-- <el-table-column type="index" width="40" /> -->
          <el-table-column prop="code" label="注册码" min-width="260" />
          <el-table-column label="卡类型" min-width="74">
            <template #default="{ row }">
              {{ cardTypeMap[row.cardType] || row.cardType }}
            </template>
          </el-table-column>
          <el-table-column prop="projectName" label="项目类型" min-width="80" />
          <el-table-column v-if="canViewDeveloper" label="开发者" min-width="110">
            <template #default="{ row }">
              {{ row.developerUsername || row.developerCode || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="78">
            <template #default="{ row }">
              <span :style="{ color: getStatusColor(row.status) }">
                {{ getStatusText(row.status) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="激活时间/到期时间/最后访问时间" min-width="220" align="center">
            <template #default="{ row }">
              <div class="time-info">
                <div>{{ formatDateTime(row.activatedAt, 'yyyy-MM-dd') || '未使用' }} / {{ formatDateTime(row.expireAt,
                  'yyyy-MM-dd') || '未使用' }} / {{ formatDateTime(row.lastLoginAt, 'yyyy-MM-dd') || '未使用' }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="在线" min-width="60">
            <template #default="{ row }">
              <span :style="{ color: row.isOnline ? '#67c23a' : '#909399' }">
                {{ row.isOnline ? '在线' : '离线' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="100">
            <template #default="{ row }">
              <div class="time-info" :title="row.remark">
                <div>{{ row.remark }}</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="解绑密码" min-width="80">
            <template #default="{ row }">
              {{ row.unbindPassword || '未设置' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" :min-width="operationColumnWidth">
            <template #default="{ row }">
              <div class="action-links" @touchstart.stop>
                <el-link v-if="!row.isBound" type="info" disabled>未绑</el-link>
                <el-link v-else type="primary" size="small" @click.stop="handleUnbind(row)">解绑</el-link>

                <el-link :type="row.status === 'frozen' ? 'success' : 'warning'" size="small"
                  @click.stop="row.status === 'frozen' ? handleUnfreeze(row) : handleFreeze(row)">
                  {{ row.status === 'frozen' ? '解冻' : '冻结' }}
                </el-link>
                <el-link type="primary" size="small" @click.stop="handleRenew(row)">续费</el-link>

                <el-link v-if="!row.isOnline" type="info" disabled>离线</el-link>
                <el-link v-else type="primary" size="small" @click.stop="handleOffline(row)">下线</el-link>
                <el-link v-if="row.status === 'deleted'" type="primary" size="small"
                  @click.stop="handleRecover(row)">恢复</el-link>
                <el-link v-else type="danger" size="small" @click.stop="handleDelete(row)">删除</el-link>
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
      <div v-if="total > filters.pageSize" class="pagination-wrap">
        <el-pagination v-model:current-page="filters.currentPage" v-model:page-size="filters.pageSize"
          :page-sizes="[20, 50, 80, 100]" :total="total" :layout="paginationLayout" @current-change="handlePageChange"
          @size-change="handleSizeChange" />
      </div>
    </div>

    <div v-show="batchActionSheetOpen" class="batch-action-mask" @click="batchActionSheetOpen = false" />
    <div v-show="batchActionSheetOpen" class="batch-action-sheet">
      <div class="batch-action-head">
        <strong>批量操作</strong>
        <span>已选 {{ selectedRows.length }} 条</span>
      </div>
      <div class="batch-action-grid">
        <button type="button" @click="handleBatchFreeze(); batchActionSheetOpen = false">冻结</button>
        <button type="button" @click="handleBatchUnfreeze(); batchActionSheetOpen = false">解冻</button>
        <button type="button" @click="handleBatchUnbind(); batchActionSheetOpen = false">解绑</button>
        <button type="button" @click="handleBatchChangeProject(); batchActionSheetOpen = false">改项目</button>
        <button type="button" @click="handleBatchChangeNote(); batchActionSheetOpen = false">改备注</button>
        <button type="button" @click="handleBatchRecover(); batchActionSheetOpen = false">恢复</button>
        <button type="button" @click="handleBatchRecharge(); batchActionSheetOpen = false">续费</button>
        <button type="button" @click="handleBatchChangePassword(); batchActionSheetOpen = false">重置密码</button>
        <button type="button" @click="handleBatchAddIP(); batchActionSheetOpen = false">IP黑名单</button>
        <button type="button" @click="openExportDialog(); batchActionSheetOpen = false">导出</button>
        <button type="button" @click="openImportDialog(); batchActionSheetOpen = false">导入</button>
        <button type="button" class="danger" @click="handleBatchDelete(); batchActionSheetOpen = false">{{
          hasDeletedSelection ? '彻底删除' : '删除' }}</button>
        <button type="button" class="danger full"
          @click="handleCleanupExpired(); batchActionSheetOpen = false">清理已过期</button>
      </div>
      <button type="button" class="batch-action-cancel" @click="batchActionSheetOpen = false">取消</button>
    </div>

    <div v-show="showDetail" class="codes-detail-mask" @click="showDetail = false" />

    <!-- 详情弹窗（底部） -->
    <div v-show="showDetail" class="codes-detail">
      <div class="codes-detail-head">
        <div>
          <strong>注册码详情</strong>
          <span v-if="currentRow">{{ currentRow.projectName || currentRow.projectId || '-' }}</span>
        </div>
        <el-button type="primary" link @click="showDetail = false">关闭</el-button>
      </div>

      <div v-if="currentRow" class="codes-detail-body">
        <div class="detail-grid">
          <el-row class="detail-grid-row">
            <el-col :span="8" class="detail-field">
              <div class="label-cell">注册码</div>
              <div class="value-cell">
                {{ currentRow.code }}
                <el-button type="text" size="small" @click="copyToClipboard(currentRow.code)">复制</el-button>
              </div>
            </el-col>
            <el-col :span="6" class="detail-field">
              <div class="label-cell">项目名称</div>
              <div class="value-cell">{{ currentRow.projectName || currentRow.projectId }}</div>
            </el-col>
            <el-col :span="4" class="detail-field">
              <div class="label-cell">解绑密码</div>
              <div class="value-cell">{{ currentRow.unbindPassword || '未设置' }}</div>
            </el-col>
            <el-col :span="6" class="detail-field">
              <div class="label-cell">卡类型</div>
              <div class="value-cell">{{ cardTypeMap[currentRow.cardType] || currentRow.cardType }}</div>
            </el-col>
          </el-row>
          <el-row class="detail-grid-row">
            <el-col :span="8" class="detail-field">
              <div class="label-cell">创建时间</div>
              <div class="value-cell">{{ formatDateTime(currentRow.createdAt) || '-' }}</div>
            </el-col>
            <el-col :span="6" class="detail-field">
              <div class="label-cell">激活时间</div>
              <div class="value-cell">{{ formatDateTime(currentRow.activatedAt) || '未激活' }}</div>
            </el-col>
            <el-col :span="4" class="detail-field">
              <div class="label-cell">到期时间</div>
              <div class="value-cell">{{ formatDateTime(currentRow.expireAt) || '未设置' }}</div>
            </el-col>
            <el-col :span="6" class="detail-field">
              <div class="label-cell">最后登录</div>
              <div class="value-cell">{{ formatDateTime(currentRow.lastLoginAt) || '-' }}</div>
            </el-col>
          </el-row>
          <el-row class="detail-grid-row">
            <el-col :span="8" class="detail-field">
              <div class="label-cell">使用状态</div>
              <div class="value-cell">
                <span :style="{ color: getStatusColor(currentRow.status) }">
                  {{ getStatusText(currentRow.status) }}
                </span>
              </div>
            </el-col>
            <el-col :span="6" class="detail-field">
              <div class="label-cell">在线状态</div>
              <div class="value-cell">
                <span :style="{ color: currentRow.isOnline ? '#67c23a' : '#909399' }">
                  {{ currentRow.isOnline ? '在线' : '离线' }}
                </span>
              </div>
            </el-col>
            <el-col :span="4" class="detail-field">
              <div class="label-cell">登录IP地址</div>
              <div class="value-cell">{{ currentRow.lastLoginIp || '-' }}</div>
            </el-col>
            <el-col :span="6" class="detail-field">
              <div class="label-cell">是否绑定</div>
              <div class="value-cell">{{ currentRow.isBound ? '已绑定' : '未绑定' }}</div>
            </el-col>
          </el-row>
          <el-row class="detail-grid-row">
            <el-col :span="14" class="detail-field detail-field-wide">
              <div class="label-cell">机器码</div>
              <div class="value-cell">{{ currentRow.machineCode || '未绑定' }}</div>
            </el-col>
            <el-col :span="10" class="detail-field detail-field-wide">
              <div class="label-cell">客户信息</div>
              <div class="value-cell">
                <el-input v-model="currentRow.userMsg" readonly />
                <!-- <div class="detail-edit-row">
                  
                 <el-button size="small" type="primary" @click="saveUserMsg">保存</el-button> 
                </div>-->
              </div>
            </el-col>
          </el-row>
          <el-row class="detail-grid-row">
            <el-col :span="24" class="detail-field detail-field-full">
              <div class="label-cell">备注</div>
              <div class="value-cell">
                <el-input v-model="currentRow.remark" readonly />
              </div>
            </el-col>
          </el-row>
        </div>

        <div class="detail-card-list">
          <div class="detail-card-item full">
            <span>注册码</span>
            <strong>
              {{ currentRow.code }}
              <el-button type="text" size="small" @click="copyToClipboard(currentRow.code)">复制</el-button>
            </strong>
          </div>
          <div class="detail-card-item">
            <span>项目名称</span>
            <strong>{{ currentRow.projectName || currentRow.projectId || '-' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>卡类型</span>
            <strong>{{ cardTypeMap[currentRow.cardType] || currentRow.cardType || '-' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>使用状态</span>
            <strong :style="{ color: getStatusColor(currentRow.status) }">{{ getStatusText(currentRow.status)
            }}</strong>
          </div>
          <div class="detail-card-item">
            <span>在线状态</span>
            <strong :style="{ color: currentRow.isOnline ? '#67c23a' : '#909399' }">{{ currentRow.isOnline ? '在线' : '离线'
              }}</strong>
          </div>
          <div class="detail-card-item">
            <span>创建时间</span>
            <strong>{{ formatDateTime(currentRow.createdAt) || '-' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>激活时间</span>
            <strong>{{ formatDateTime(currentRow.activatedAt) || '未激活' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>到期时间</span>
            <strong>{{ formatDateTime(currentRow.expireAt) || '未设置' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>最后登录</span>
            <strong>{{ formatDateTime(currentRow.lastLoginAt) || '-' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>解绑密码</span>
            <strong>{{ currentRow.unbindPassword || '未设置' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>登录IP地址</span>
            <strong>{{ currentRow.lastLoginIp || '-' }}</strong>
          </div>
          <div class="detail-card-item">
            <span>是否绑定</span>
            <strong>{{ currentRow.isBound ? '已绑定' : '未绑定' }}</strong>
          </div>
          <div class="detail-card-item ">
            <span>机器码</span>
            <strong>{{ currentRow.machineCode || '未绑定' }}</strong>
          </div>
          <div class="detail-card-item ">
            <span>客户信息</span>
            <strong>{{ currentRow.userMsg || '-' }}</strong>
          </div>
          <div class="detail-card-item ">
            <span>备注</span>
            <strong>{{ currentRow.remark || '-' }}</strong>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-model="renewDialogVisible" :title="renewDialogTitle" width="460px" transition="none"
      :lock-scroll="false" destroy-on-close append-to-body class="renew-dialog">
      <el-form label-width="96px" class="dialog-form renew-form">
        <el-form-item label="卡类型：">
          <el-select v-model="renewForm.unit" style="width: 100%">
            <el-option v-for="item in renewUnitOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>

        <el-form-item label="数量：">
          <el-input-number v-model="renewForm.quantity" :step="1" :precision="0" controls-position="right"
            style="width: 180px" />
          <span class="renew-unit-text">{{ selectedRenewUnit.shortLabel }}</span>
        </el-form-item>

        <div class="renew-preview">
          <div class="renew-preview-row">
            <span>本次{{ renewActionText }}时长</span>
            <strong>{{ renewTotalDaysText }}</strong>
          </div>
          <div v-if="renewMode === 'single'" class="renew-preview-row">
            <span>{{ renewDurationMs > 0 && (!renewTarget?.expireAt || Number(renewTarget.expireAt) <= Date.now())
              ? '起始时间' : '当前到期时间' }}</span>
                <strong>{{ formatDateTime(renewBaseTime) }}</strong>
          </div>
          <div v-if="renewMode === 'single'" class="renew-preview-row primary">
            <span>{{ renewActionText }}后到期</span>
            <strong>{{ formatDateTime(renewPreviewExpireAt) }}</strong>
          </div>
          <div v-else class="renew-preview-note">
            正数会按每张注册码自己的到期时间延长；负数会从当前到期时间扣除。已过期且正数续费时，从当前时间开始计算。
          </div>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="renewDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="renewSubmitting" @click="submitRenew">确定{{ renewActionText }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="exportDialogVisible" title="导出注册码" width="520px" transition="none" :lock-scroll="false"
      destroy-on-close append-to-body>
      <el-form label-width="122px" class="dialog-form">
        <el-form-item label="导出内容：">
          <div class="dialog-static-text">注册码、卡类型、项目类型、生成时间、激活时间、备注信息、解绑密码</div>
        </el-form-item>
        <el-form-item label="每多少条分行符：">
          <el-input-number v-model="exportForm.linesPerGroup" :min="1" :step="1" controls-position="right"
            style="width: 180px" />
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

    <el-dialog v-model="importDialogVisible" title="导入注册码" width="720px" transition="none" :lock-scroll="false"
      destroy-on-close append-to-body>
      <el-form label-width="108px" class="dialog-form">
        <el-form-item label="项目名称：">
          <el-select v-model="importForm.projectId" placeholder="请选择项目名称" style="width: 240px">
            <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="上传文件：">
          <div class="export-file-row">
            <el-input :model-value="importForm.fileName" readonly placeholder="请选择 .txt 文件" style="width: 260px" />
            <el-button @click="triggerImportFile">选择文件</el-button>
            <input ref="importFileInputRef" type="file" accept=".txt,text/plain" class="hidden-file-input"
              @change="handleImportFileChange" />
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
            <p>导入格式支持：注册码{{ getDelimiterLabel(importForm.delimiter) }}激活时间{{ getDelimiterLabel(importForm.delimiter)
              }}到期时间{{ getDelimiterLabel(importForm.delimiter) }}卡类型。</p>
            <p>示例：AAAAAAA{{ importForm.delimiter === '\t' ? ' ' : importForm.delimiter }}2016-01-01 00:00:00{{
              importForm.delimiter === '\t' ? ' ' : importForm.delimiter }}2016-02-01 00:00:00{{ importForm.delimiter
                ===
                '\t' ? ' ' : importForm.delimiter }}月卡</p>
            <p class="import-warning">注意：文件编码必须为 UTF-8，当前只支持导入 .txt 文件。</p>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importSubmitting" @click="submitImport">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchProjectDialogVisible" title="批量修改项目" width="460px" transition="none" :lock-scroll="false"
      destroy-on-close append-to-body>
      <el-form label-width="112px" class="dialog-form">
        <el-form-item label="新的项目：">
          <el-select v-model="batchProjectForm.projectId" placeholder="请选择项目名称" style="width: 100%">
            <el-option v-for="item in projects" :key="item.id" :label="item.name" :value="item.id"
              :disabled="selectedProjectIds.includes(item.id)" />
          </el-select>
        </el-form-item>
        <el-form-item label="当前所属项目：">
          <div class="project-tip">
            {{selectedRows.map((row) => row.projectName || row.projectId).filter((value, index, array) =>
              array.indexOf(value) === index).join('、')}}
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
  gap: 14px;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;

  .header-summary {
    display: flex;
    gap: 12px;
  }

  .summary-box {
    min-width: 136px;
    padding: 10px 14px;
    border-radius: 8px;
    background: #fff;
    border: 1px solid #e5e7eb;

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
    background: #fff;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);

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

  .filter-section-head {
    display: none;
  }

  .filter-count {
    margin-left: 8px;
    color: #2563eb;
    font-size: 12px;
    font-weight: 600;
  }

  .tableColums {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    box-sizing: border-box;
    overflow: hidden;

    .filter-row {
      display: flex;
      align-items: center;
      //gap: 10px;
      margin-bottom: 0;
      flex-wrap: wrap;
    }

    .table-main {
      flex: 1;
      min-width: 0;
      min-height: 0;
      overflow: auto;
    }

    .pagination-wrap {
      flex-shrink: 0;
      padding: 14px;
      display: flex;
      justify-content: center;
      border-top: none;
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
  margin-bottom: 12px;
  flex-wrap: wrap;

  &.table_flexrow {
    gap: 12px 16px;
    justify-content: flex-start;
    margin-bottom: 16px;
    padding: 0 16px;
    border-radius: 4px;
    background: linear-gradient(135deg, #bdd8f9f5, #dbf7f5eb);
    box-shadow: 0 3px 6px #d2ddfdf5;
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.mobile-table-actions,
.batch-action-mask,
.batch-action-sheet {
  display: none;
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

.action-links {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
}

.action-links :deep(.el-link) {
  flex: 0 0 auto;
}

.action-links :deep(.el-link + .el-link) {
  margin-left: 0;
}

// Detail dialog styles
.codes-detail-head {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px 8px;
  border-bottom: 1px solid #eef2f7;

  strong {
    display: block;
    color: #303133;
    font-size: 14px;
    font-weight: 700;
  }

  span {
    display: block;
    margin-top: 2px;
    color: #909399;
    font-size: 12px;
  }
}

.codes-detail-body {
  min-height: 0;
  overflow: auto;
  padding-top: 10px;
}

.detail-edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-grid {
  width: 100%;
  font-size: 13px;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  border-left: 1px solid rgba(148, 163, 184, 0.18);

  .detail-grid-row {
    align-items: stretch;
  }

  .detail-field {
    min-width: 0;
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    border-right: 1px solid rgba(148, 163, 184, 0.18);
    border-bottom: 1px solid rgba(148, 163, 184, 0.18);
  }

  .detail-field-wide {
    grid-template-columns: 100px minmax(0, 1fr);
  }

  .detail-field-full {
    grid-template-columns: 100px minmax(0, 1fr);
  }

  .label-cell {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: 10px 12px;
    background: #f7faff;
    font-weight: 500;
    color: #607089;
    text-align: right;
  }

  .value-cell {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 12px;
    color: #172033;
    word-break: break-all;
    overflow-wrap: anywhere;
  }
}

.detail-card-list {
  display: none;
}

v-deep .el-checkbox {
  margin-right: 0;
}

.codes-detail {
  background: #fff;
  padding: 10px 12px 12px;
  position: fixed;
  left: 50%;
  bottom: 16px;
  width: min(calc(100vw - 32px), 1400px);
  transform: translateX(-50%);
  z-index: 30;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 -10px 30px rgba(15, 23, 42, 0.08);
  max-height: 45vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 8px;
}

.codes-detail-mask {
  display: none;
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

.renew-form {
  .renew-unit-text {
    margin-left: 10px;
    color: #606266;
    font-size: 13px;
  }

  .renew-preview {
    margin-top: 2px;
    padding: 10px 12px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #f8fafc;
  }

  .renew-preview-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #606266;
    font-size: 13px;
    line-height: 24px;
  }

  .renew-preview-row+.renew-preview-row {
    margin-top: 4px;
  }

  .renew-preview-row strong {
    color: #303133;
    font-weight: 700;
    text-align: right;
  }

  .renew-preview-row.primary strong {
    color: #2563eb;
  }

  .renew-preview-note {
    color: #606266;
    font-size: 13px;
    line-height: 1.7;
  }
}

:deep(.el-button.is-link) {
  font-weight: 700;
}

:deep(.el-table) {
  min-height: 0;
  height: 100%;
}

:deep(.el-table .cell) {
  padding: 0 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.el-table .el-table__cell) {
  padding: 6px 0;
}

:deep(.el-checkbox) {
  margin-right: 5px;
}

:deep(.el-button.is-link:hover) {
  color: #f56c6c;
}

@media (max-width: 820px) {
  .codes-list-page {
    gap: 12px;

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

@media (max-width: 768px) {
  .codes-list-page {
    height: 100%;
    min-height: 0;
    overflow: hidden;

    .filter-section {
      display: none;
    }

    .filter-section-head {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 12px;
      border-bottom: none;
      background: #fff;
      color: #303133;
      font-size: 14px;
    }

    .filter-section-body {
      padding: 10px 12px;
      background: #fff;
    }

    .filter-row {
      display: grid;
      grid-template-columns: 1fr;
      align-items: stretch;
      gap: 6px;
    }

    .filter-row :deep(.el-input__wrapper),
    .filter-row :deep(.el-select__wrapper) {
      min-height: 28px;
    }

    .filter-row :deep(.el-input__inner) {
      height: 28px;
      line-height: 28px;
    }

    .filter-row :deep(.el-checkbox) {
      height: 24px;
      margin-right: 8px;
    }

    .filter-row :deep(.el-checkbox__label) {
      font-size: 13px;
      padding-left: 5px;
    }

    .filter-row>span:not(.filter-label) {
      display: none;
    }

    .tableuse {
      display: block;
    }

    .tableuse .filter-label {
      display: block;
      margin: 8px 0 4px;
    }

    .tableuse .ml-20 {
      margin-left: 0;
    }

    .tableColums>.filter-row.table_flexrow {
      display: none !important;
    }

    .mobile-table-actions {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-height: 44px;
      padding: 7px 8px;
      border-bottom: 1px solid #eef2f7;
      background: linear-gradient(135deg, #dbf7f5eb, #bdd8f9f5);
    }

    .mobile-table-actions :deep(.el-button) {
      margin: 0;
      height: 30px;
      padding: 0 10px;
      border: 1px solid #dcdfe6;
      border-radius: 6px;
      background: #fff;
      color: var(--vs-primary);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
      font-size: 13px;
      font-weight: 600;

      &:first-child {
        color: #fff;
        background: var(--vs-primary);
        border-color: var(--vs-primary);
      }
    }

    .mobile-action-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      margin-left: 4px;
      padding: 0 4px;
      border-radius: 999px;
      background: rgba(64, 158, 255, 0.12);
      color: #409eff;
      font-size: 11px;
      line-height: 16px;
    }

    .tableColums {
      flex: 1 1 auto;
      min-height: 0;
      max-height: none;
    }

    .tableColums .table-main {
      flex: 1 1 auto;
      height: auto;
      min-height: 0;
      max-height: none;
    }

    .pagination-wrap {
      flex: 0 0 auto;
      justify-content: center;
      overflow-x: auto;
      padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
    }

    .pagination-wrap :deep(.el-pagination) {
      width: 100%;
      justify-content: center;
      gap: 4px;
      white-space: nowrap;
    }

    .pagination-wrap :deep(.btn-prev),
    .pagination-wrap :deep(.btn-next),
    .pagination-wrap :deep(.el-pager li) {
      min-width: 28px;
      height: 28px;
      margin: 0 1px;
      padding: 0 6px;
      font-size: 12px;
    }

    .pagination-wrap :deep(.btn-prev span),
    .pagination-wrap :deep(.btn-next span) {
      font-size: 12px;
    }
  }

  :global(.vs-ref-main .head-action) {
    display: none;
  }

  :global(.codes-filter-drawer .el-drawer__body) {
    height: 100%;
    padding: 0;
    overflow: hidden;
  }

  :global(.codes-filter-drawer .el-drawer__header) {
    margin: 0;
    padding: 14px 16px;
    border-bottom: 1px solid #ebeef5;
  }

  .drawer-filter-body {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
    background: #fff;
  }

  .drawer-filter-scroll {
    flex: 1;
    min-height: 0;
    padding: 12px 14px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .drawer-filter-body .filter-row {
    display: grid;
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 6px;
  }

  .drawer-filter-body .filter-row>span:not(.filter-label) {
    display: none;
  }

  .drawer-filter-actions {
    flex: 0 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
    border-top: 1px solid #ebeef5;
    background: #fff;
  }

  .drawer-filter-actions .el-button {
    width: 100%;
    margin: 0;
  }

  .time-info {
    justify-content: flex-start;
  }

  .action-links {
    width: 100%;
    justify-content: center;
    gap: 7px;
    font-size: 12px;
  }

  .codes-detail {
    left: 8px;
    right: 8px;
    bottom: calc(12px + env(safe-area-inset-bottom));
    width: auto;
    max-height: calc(100dvh - 96px - env(safe-area-inset-bottom));
    padding: 0;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    transform: none;
    z-index: 70;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
  }

  .batch-action-mask {
    position: fixed;
    inset: 0;
    z-index: 79;
    display: block;
    background: rgba(15, 23, 42, 0.28);
  }

  .batch-action-sheet {
    position: fixed;
    right: 8px;
    bottom: calc(8px + env(safe-area-inset-bottom));
    left: 8px;
    z-index: 80;
    display: block;
    padding: 12px;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28);
  }

  .batch-action-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  .batch-action-head strong {
    color: #111827;
    font-size: 15px;
  }

  .batch-action-head span {
    color: #909399;
    font-size: 12px;
  }

  .batch-action-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .batch-action-grid button,
  .batch-action-cancel {
    min-height: 36px;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #f8fafc;
    color: #2563eb;
    font-size: 13px;
    font-weight: 600;
  }

  .batch-action-grid button.danger {
    color: #ef4444;
  }

  .batch-action-grid button.full {
    grid-column: 1 / -1;
  }

  .batch-action-cancel {
    width: 100%;
    margin-top: 10px;
    background: #fff;
    color: #606266;
  }

  .codes-detail-mask {
    position: fixed;
    inset: 0;
    z-index: 69;
    display: block;
    background: rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(1px);
  }

  .codes-detail-head {
    flex: 0 0 auto;
    min-height: 48px;
    padding: 8px 12px;
    background: #fff;
  }

  .codes-detail-body {
    padding: 10px 12px 12px;
    overflow: auto;
  }

  .detail-grid {
    display: none;
  }

  .detail-card-list {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .detail-card-item {
    min-width: 0;
    padding: 9px 10px;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    background: #f8fafc;
  }

  .detail-card-item.full {
    grid-column: 1 / -1;
  }

  .detail-card-item span {
    display: block;
    margin-bottom: 5px;
    color: #909399;
    font-size: 12px;
    line-height: 16px;
  }

  .detail-card-item strong {
    display: block;
    color: #303133;
    font-size: 13px;
    line-height: 18px;
    font-weight: 600;
    overflow-wrap: anywhere;
    word-break: break-all;
  }

  .detail-edit-row {
    align-items: stretch;
  }

  .detail-edit-row :deep(.el-button) {
    flex: 0 0 auto;
  }

  :global(.renew-dialog) {
    width: calc(100vw - 28px) !important;
  }

  :global(.renew-dialog .el-dialog__body) {
    padding: 14px;
  }
}

@media (max-width: 480px) {
  .codes-list-page {
    .tableColums .table-main {
      height: auto;
      max-height: none;
    }
  }

  .codes-detail {
    left: 6px;
    right: 6px;
    bottom: calc(10px + env(safe-area-inset-bottom));
    max-height: calc(100dvh - 86px - env(safe-area-inset-bottom));
  }
}
</style>
