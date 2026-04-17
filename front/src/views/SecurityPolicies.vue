<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../utils/request'
import { formatDateTime } from '../utils/datetime'

interface ProjectOption {
  id: string
  name: string
}

type PolicyStatus = 'enabled' | 'disabled'
type PolicyMode = 'basic' | 'advanced'

interface PolicyItem {
  id: string
  projectId: string
  projectName?: string
  status: PolicyStatus
  mode: PolicyMode
  createdAt?: number
  config?: any
}

const list = ref<PolicyItem[]>([])
const loading = ref(false)
const total = ref(0)
const projects = ref<ProjectOption[]>([])
const algorithms = ref<string[]>([])
const policyProjectIds = ref<string[]>([])

const filters = reactive({
  projectId: '',
  status: '',
  mode: '',
})

const pagination = reactive({
  page: 1,
  pageSize: 10,
})

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const algoTags = ['AES', 'DES', 'TEA', 'RC2', 'RC5', 'RC6'] as const

const form = reactive<{
  projectId: string
  status: PolicyStatus
  mode: PolicyMode
  userKey: string
  basic: { verifyAlgo: string; assistAlgo: string }
  advanced: {
    userKeyEncrypt: string
    verifyApi: {
      algoTags: Record<string, string>
      prefixMode: 'fixed' | 'random'
      prefixValue: string
      prefixLength: number
      suffixMode: 'fixed' | 'random'
      suffixValue: string
      suffixLength: number
    }
    assistApi: {
      algoTags: Record<string, string>
      prefixMode: 'fixed' | 'random'
      prefixValue: string
      prefixLength: number
      suffixMode: 'fixed' | 'random'
      suffixValue: string
      suffixLength: number
    }
  }
}>({
  projectId: '',
  status: 'disabled',
  mode: 'basic',
  userKey: '',
  basic: { verifyAlgo: 'AES', assistAlgo: 'AES' },
  advanced: {
    userKeyEncrypt: 'AES',
    verifyApi: {
      algoTags: { AES: 'AES', DES: 'DES', TEA: 'TEA', RC2: 'RC2', RC5: 'RC5', RC6: 'RC6' },
      prefixMode: 'random',
      prefixValue: '',
      prefixLength: 6,
      suffixMode: 'random',
      suffixValue: '',
      suffixLength: 6,
    },
    assistApi: {
      algoTags: { AES: 'AES', DES: 'DES', TEA: 'TEA', RC2: 'RC2', RC5: 'RC5', RC6: 'RC6' },
      prefixMode: 'random',
      prefixValue: '',
      prefixLength: 6,
      suffixMode: 'random',
      suffixValue: '',
      suffixLength: 6,
    },
  },
})

const fetchProjects = async () => {
  const resp = await request.get('/api/projects')
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((r) => ({ id: r.id, name: r.name }))
  if (!form.projectId) form.projectId = projects.value[0]?.id || ''
}

const fetchAlgorithms = async () => {
  const resp = await request.get('/api/security-policies/algorithms')
  algorithms.value = (resp.data.data || []) as string[]
  if (!form.basic.verifyAlgo) form.basic.verifyAlgo = algorithms.value[0] || 'AES'
  if (!form.basic.assistAlgo) form.basic.assistAlgo = algorithms.value[0] || 'AES'
}

const fetchPolicyProjectIds = async () => {
  const resp = await request.get('/api/security-policies/project-ids')
  policyProjectIds.value = (resp.data.data || []) as string[]
}

const fetchPolicies = async () => {
  loading.value = true
  try {
    const params: any = {}
    if (filters.projectId) params.projectId = filters.projectId
    if (filters.status) params.status = filters.status
    if (filters.mode) params.mode = filters.mode
    params.page = pagination.page
    params.pageSize = pagination.pageSize

    const resp = await request.get('/api/security-policies', { params })
    const data = resp.data.data as any
    if (Array.isArray(data)) {
      list.value = data
      total.value = data.length
    } else {
      list.value = data?.list || []
      total.value = data?.total || 0
    }
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.page = 1
  fetchPolicies()
}

const policyProjectIdSet = computed(() => new Set(policyProjectIds.value))
const availableProjectsForCreate = computed(() => projects.value.filter((p) => !policyProjectIdSet.value.has(p.id)))

const statusText = (s: PolicyStatus) => (s === 'enabled' ? '开启' : '关闭')
const modeText = (m: PolicyMode) => (m === 'advanced' ? '高级' : '初级')

const resetForm = () => {
  Object.assign(form, {
    projectId: projects.value[0]?.id || '',
    status: 'enabled' as PolicyStatus,
    mode: 'basic' as PolicyMode,
    userKey: '',
    basic: { verifyAlgo: algorithms.value[0] || 'AES', assistAlgo: algorithms.value[0] || 'AES' },
    advanced: {
      userKeyEncrypt: 'AES',
      verifyApi: {
        algoTags: { AES: 'AES', DES: 'DES', TEA: 'TEA', RC2: 'RC2', RC5: 'RC5', RC6: 'RC6' },
        prefixMode: 'random',
        prefixValue: '',
        prefixLength: 6,
        suffixMode: 'random',
        suffixValue: '',
        suffixLength: 6,
      },
      assistApi: {
        algoTags: { AES: 'AES', DES: 'DES', TEA: 'TEA', RC2: 'RC2', RC5: 'RC5', RC6: 'RC6' },
        prefixMode: 'random',
        prefixValue: '',
        prefixLength: 6,
        suffixMode: 'random',
        suffixValue: '',
        suffixLength: 6,
      },
    },
  })
}

const openDialog = (row?: PolicyItem) => {
  editingId.value = row?.id || null
  resetForm()

  if (!row) {
    // if (!availableProjectsForCreate.value.length) {
    //   ElMessage.warning('所有项目都已配置安全策略')
    //   return
    // }
    form.projectId = availableProjectsForCreate.value[0]?.id || ''
  }

  if (row) {
    form.projectId = row.projectId
    form.status = row.status
    form.mode = row.mode
    const cfg = row.config || {}
    form.userKey = cfg.userKey || ''
    if (row.mode === 'basic') {
      form.basic.verifyAlgo = cfg.verifyAlgo || algorithms.value[0] || 'AES'
      form.basic.assistAlgo = cfg.assistAlgo || algorithms.value[0] || 'AES'
    } else {
      form.advanced.userKeyEncrypt = cfg.userKeyEncrypt || 'AES'
      form.advanced.verifyApi = { ...form.advanced.verifyApi, ...(cfg.verifyApi || {}) }
      form.advanced.assistApi = { ...form.advanced.assistApi, ...(cfg.assistApi || {}) }
    }
  }

  dialogVisible.value = true
}

const buildConfig = () => {
  if (form.status === 'disabled') return {}
  if (form.mode === 'basic') return { userKey: form.userKey, verifyAlgo: form.basic.verifyAlgo, assistAlgo: form.basic.assistAlgo }

  return {
    userKey: form.userKey,
    userKeyEncrypt: form.advanced.userKeyEncrypt,
    verifyApi: form.advanced.verifyApi,
    assistApi: form.advanced.assistApi,
  }
}

const savePolicy = async () => {
  if (!form.projectId) return ElMessage.error('请选择项目')

  const payload: any = {
    projectId: form.projectId,
    status: form.status,
    mode: form.mode,
    config: buildConfig(),
    name: 'default',
  }

  if (editingId.value) {
    await request.put(`/api/security-policies/${editingId.value}`, payload)
  } else {
    await request.post('/api/security-policies', payload)
  }
  ElMessage.success('保存成功')
  dialogVisible.value = false
  await Promise.all([fetchPolicies(), fetchPolicyProjectIds()])
}

const removePolicy = async (row: PolicyItem) => {
  await ElMessageBox.confirm(`删除该安全策略吗？`, '提示', { type: 'warning' })
  await request.delete(`/api/security-policies/${row.id}`)
  ElMessage.success('已删除')
  await Promise.all([fetchPolicies(), fetchPolicyProjectIds()])
}

const handlePageChange = (page: number) => {
  pagination.page = page
  fetchPolicies()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  fetchPolicies()
}

onMounted(async () => {
  await Promise.all([fetchProjects(), fetchAlgorithms(), fetchPolicyProjectIds()])
  await fetchPolicies()
})
</script>

<template>
  <div class="page">
    <el-card>
      <template #header>
        <div class="toolbar">
          <div>
            <div class="title">安全策略管理</div>
            <div class="sub">配置项目级安全模式与算法</div>
          </div>
          <el-button type="primary" @click="openDialog()">添加安全策略</el-button>
        </div>
      </template>

      <div class="search-bar">
        <span class="label">项目名称：</span>
        <el-select v-model="filters.projectId" filterable style="width: 220px" @change="handleSearch">
          <el-option label="-所有项目-" value="" />
          <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <span class="label">策略状态：</span>
        <el-select v-model="filters.status" style="width: 140px" @change="handleSearch">
          <el-option label="-所有-" value="" />
          <el-option label="开启" value="enabled" />
          <el-option label="关闭" value="disabled" />
        </el-select>
        <span class="label">策略模式：</span>
        <el-select v-model="filters.mode" style="width: 140px" @change="handleSearch">
          <el-option label="-所有-" value="" />
          <el-option label="初级" value="basic" />
          <el-option label="高级" value="advanced" />
        </el-select>
        <el-button type="primary" @click="handleSearch">查询</el-button>
      </div>

      <el-table :data="list" v-loading="loading" style="width: 100%">
        <el-table-column prop="projectName" label="项目名称">
          <template #default="{ row }">{{ row.projectName || row.projectId }}</template>
        </el-table-column>
        <el-table-column prop="status" label="策略状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.status === 'enabled' ? 'success' : 'info'">{{ statusText(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="mode" label="策略模式" width="120">
          <template #default="{ row }">{{ modeText(row.mode) }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间">
          <template #default="{ row }">{{ row.createdAt ? formatDateTime(row.createdAt) : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" >
          <template #default="{ row }">
            <el-button size="small" @click="openDialog(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="removePolicy(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑安全策略' : '添加安全策略'" width="860px">
        <div class="policy-form">
          <div class="row2">
            <span class="label">项目名称：</span>
            <el-select v-model="form.projectId" filterable style="width: 260px" :disabled="!!editingId">
              <el-option label="-请选择项目-" value="" />
              <el-option v-for="p in (editingId ? projects : availableProjectsForCreate)" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </div>

        <div class="row2">
          <span class="label">安全策略状态：</span>
          <el-radio-group v-model="form.status">
            <el-radio label="enabled">开启</el-radio>
            <el-radio label="disabled">关闭</el-radio>
          </el-radio-group>
        </div>

        <template v-if="form.status === 'enabled'">
          <div class="row2">
            <span class="label">安全策略模式：</span>
            <el-radio-group v-model="form.mode">
              <el-radio label="basic">初级</el-radio>
              <el-radio label="advanced">高级</el-radio>
            </el-radio-group>
          </div>

          <div class="section">
            <div class="section-title">用户密钥</div>
            <div class="section-body">
              <el-form label-width="120px">
                <el-form-item label="用户密钥：">
                  <el-input v-model="form.userKey" maxlength="32" show-word-limit style="width: 260px" />
                  <span class="help">最长不能超过32个字符</span>
                </el-form-item>
                <template v-if="form.mode === 'advanced'">
                  <el-form-item label="用户密钥加密：">
                    <el-select v-model="form.advanced.userKeyEncrypt" style="width: 260px">
                      <el-option label="AES" value="AES" />
                      <el-option label="DES" value="DES" />
                    </el-select>
                    <span class="help warn">（客户端需根据算法标识使用对应的解密算法）</span>
                  </el-form-item>
                </template>
              </el-form>
            </div>
          </div>

          <template v-if="form.mode === 'basic'">
            <div class="section">
              <div class="section-title">验证接口安全策略 <span class="warn">影响的函数:验证注册码详细信息</span></div>
              <div class="section-body">
                <el-form label-width="120px">
                  <el-form-item label="通讯加密：">
                    <el-select v-model="form.basic.verifyAlgo" style="width: 260px">
                      <el-option label="-请选择算法-" value="" />
                      <el-option v-for="a in algorithms" :key="a" :label="a" :value="a" />
                    </el-select>
                    <span class="help warn">客户端需根据算法标识使用对应的解密算法</span>
                  </el-form-item>
                </el-form>
              </div>
            </div>

            <div class="section">
              <div class="section-title">辅助接口安全策略 <span class="warn">影响的函数:获取自定义数据、获取注册码备注信息</span></div>
              <div class="section-body">
                <el-form label-width="120px">
                  <el-form-item label="通讯加密：">
                    <el-select v-model="form.basic.assistAlgo" style="width: 260px">
                      <el-option label="-请选择算法-" value="" />
                      <el-option v-for="a in algorithms" :key="a" :label="a" :value="a" />
                    </el-select>
                    <span class="help warn">客户端需根据算法标识使用对应的解密算法</span>
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="section">
              <div class="section-title">验证接口安全策略 <span class="warn">影响的函数:验证注册码详细信息</span></div>
              <div class="section-body">
                <div class="tip-warn">算法标识不能为空,为了安全不建议直接使用默认标识</div>
                <el-form label-width="auto">
                  <el-form-item label="通讯加密：">
                    <div class="algo-grid">
                      <div v-for="a in algoTags" :key="a" class="algo-row">
                        <span class="algo-name">{{ a }} 算法标识</span>
                        <el-input v-model="form.advanced.verifyApi.algoTags[a]" maxlength="16" style="width: 200px" />
                        <span class="help">不能为0,只能是数字与字母,最长为16个字符</span>
                      </div>
                    </div>
                  </el-form-item>

                  <el-form-item label="加密后数据前缀：">
                    <el-radio-group v-model="form.advanced.verifyApi.prefixMode">
                      <el-radio label="fixed">固定字符</el-radio>
                      <el-radio label="random">随机字符</el-radio>
                    </el-radio-group>
                    <template v-if="form.advanced.verifyApi.prefixMode === 'fixed'">
                      <el-input v-model="form.advanced.verifyApi.prefixValue" maxlength="32" style="width: 220px; margin-left: 10px" />
                    </template>
                    <template v-else>
                      <el-input-number v-model="form.advanced.verifyApi.prefixLength" :min="1" :max="32" style="margin-left: 10px" />
                    </template>
                    <span class="help">用于混淆加密算法结果</span>
                  </el-form-item>

                  <el-form-item label="加密后数据后缀：">
                    <el-radio-group v-model="form.advanced.verifyApi.suffixMode">
                      <el-radio label="fixed">固定字符</el-radio>
                      <el-radio label="random">随机字符</el-radio>
                    </el-radio-group>
                    <template v-if="form.advanced.verifyApi.suffixMode === 'fixed'">
                      <el-input v-model="form.advanced.verifyApi.suffixValue" maxlength="32" style="width: 220px; margin-left: 10px" />
                    </template>
                    <template v-else>
                      <el-input-number v-model="form.advanced.verifyApi.suffixLength" :min="1" :max="32" style="margin-left: 10px" />
                    </template>
                    <span class="help">用于混淆加密算法结果</span>
                  </el-form-item>
                </el-form>
              </div>
            </div>

            <div class="section">
              <div class="section-title">辅助接口安全策略 <span class="warn">影响的函数:获取自定义数据、获取注册码备注信息</span></div>
              <div class="section-body">
                <div class="tip-warn">算法标识不能为空,为了安全不建议直接使用默认标识</div>
                <el-form label-width="auto">
                  <el-form-item label="通讯加密：">
                    <div class="algo-grid">
                      <div v-for="a in algoTags" :key="a" class="algo-row">
                        <span class="algo-name">{{ a }} 算法标识</span>
                        <el-input v-model="form.advanced.assistApi.algoTags[a]" maxlength="16" style="width: 200px" />
                        <span class="help">不能为0,只能是数字与字母,最长为16个字符</span>
                      </div>
                    </div>
                  </el-form-item>

                  <el-form-item label="加密后数据前缀：">
                    <el-radio-group v-model="form.advanced.assistApi.prefixMode">
                      <el-radio label="fixed">固定字符</el-radio>
                      <el-radio label="random">随机字符</el-radio>
                    </el-radio-group>
                    <template v-if="form.advanced.assistApi.prefixMode === 'fixed'">
                      <el-input v-model="form.advanced.assistApi.prefixValue" maxlength="32" style="width: 220px; margin-left: 10px" />
                    </template>
                    <template v-else>
                      <el-input-number v-model="form.advanced.assistApi.prefixLength" :min="1" :max="32" style="margin-left: 10px" />
                    </template>
                    <span class="help">用于混淆加密算法结果</span>
                  </el-form-item>

                  <el-form-item label="加密后数据后缀：">
                    <el-radio-group v-model="form.advanced.assistApi.suffixMode">
                      <el-radio label="fixed">固定字符</el-radio>
                      <el-radio label="random">随机字符</el-radio>
                    </el-radio-group>
                    <template v-if="form.advanced.assistApi.suffixMode === 'fixed'">
                      <el-input v-model="form.advanced.assistApi.suffixValue" maxlength="32" style="width: 220px; margin-left: 10px" />
                    </template>
                    <template v-else>
                      <el-input-number v-model="form.advanced.assistApi.suffixLength" :min="1" :max="32" style="margin-left: 10px" />
                    </template>
                    <span class="help">用于混淆加密算法结果</span>
                  </el-form-item>
                </el-form>
              </div>
            </div>
          </template>
        </template>
      </div>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="savePolicy">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-weight: 700;
}
.sub {
  color: #6b7280;
  font-size: 12px;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.pager {
  display: flex;
  justify-content: center;
  padding: 16px 0 0;
}

.label {
  color: #303133;
  font-size: 13px;
  white-space: nowrap;
}

.policy-form .row2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.section {
  margin-top: 12px;
  border-top: 1px dashed #dcdfe6;
  padding-top: 12px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 10px;
}

.section-body {
  padding-left: 6px;
}

.help {
  margin-left: 10px;
  color: #6b7280;
  font-size: 12px;
}

.warn {
  color: #ef4444;
  font-size: 12px;
  font-weight: 600;
}

.tip-warn {
  color: #ef4444;
  font-size: 12px;
  margin: 6px 0 10px;
}

.algo-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.algo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.algo-name {
  width: 90px;
  color: #303133;
  font-size: 13px;
}
</style>
