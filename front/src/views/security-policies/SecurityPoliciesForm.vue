<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'
import { useUnsavedChangesGuard } from '../../composables/useUnsavedChangesGuard'

interface ProjectOption {
  id: string
  name: string
}

type PolicyStatus = 'enabled' | 'disabled'
type PolicyMode = 'basic' | 'advanced'

interface PolicyItem {
  id: string
  projectId: string
  status: PolicyStatus
  mode: PolicyMode
  config?: any
}

const route = useRoute()
const router = useRouter()
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => !!editingId.value)
const projects = ref<ProjectOption[]>([])
const algorithms = ref<string[]>([])
const policyProjectIds = ref<string[]>([])
const loading = ref(false)
const algoTags = ['AES', 'DES', 'TEA', 'RC2', 'RC5', 'RC6'] as const

const form = reactive({
  projectId: '',
  status: 'disabled' as PolicyStatus,
  mode: 'basic' as PolicyMode,
  userKey: '',
  basic: { verifyAlgo: 'AES', assistAlgo: 'AES' },
  advanced: {
    userKeyEncrypt: 'AES',
    verifyApi: {
      algoTags: { AES: 'AES', DES: 'DES', TEA: 'TEA', RC2: 'RC2', RC5: 'RC5', RC6: 'RC6' },
      prefixMode: 'random' as 'fixed' | 'random',
      prefixValue: '',
      prefixLength: 6,
      suffixMode: 'random' as 'fixed' | 'random',
      suffixValue: '',
      suffixLength: 6,
    },
    assistApi: {
      algoTags: { AES: 'AES', DES: 'DES', TEA: 'TEA', RC2: 'RC2', RC5: 'RC5', RC6: 'RC6' },
      prefixMode: 'random' as 'fixed' | 'random',
      prefixValue: '',
      prefixLength: 6,
      suffixMode: 'random' as 'fixed' | 'random',
      suffixValue: '',
      suffixLength: 6,
    },
  },
})
const { resetBaseline, markSaved } = useUnsavedChangesGuard({
  getSnapshot: () => form,
})

const policyProjectIdSet = computed(() => new Set(policyProjectIds.value))
const availableProjectsForCreate = computed(() => projects.value.filter((project) => !policyProjectIdSet.value.has(project.id)))

const fetchProjects = async () => {
  const resp = await request.get('/api/projects', { params: { page: 1, pageSize: 200 } })
  const rows = (resp.data.data.list || resp.data.data || []) as any[]
  projects.value = rows.map((row) => ({ id: row.id, name: row.name }))
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

const resetForm = () => {
  Object.assign(form, {
    projectId: projects.value[0]?.id || '',
    status: 'enabled',
    mode: 'basic',
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

const fetchDetail = async () => {
  if (!isEdit.value) {
    form.projectId = availableProjectsForCreate.value[0]?.id || ''
    return
  }

  loading.value = true
  try {
    const resp = await request.get(`/api/security-policies/${editingId.value}`)
    const target = resp.data.data as PolicyItem | undefined
    if (!target) return

    resetForm()
    form.projectId = target.projectId
    form.status = target.status
    form.mode = target.mode
    const config = target.config || {}
    form.userKey = config.userKey || ''
    if (target.mode === 'basic') {
      form.basic.verifyAlgo = config.verifyAlgo || algorithms.value[0] || 'AES'
      form.basic.assistAlgo = config.assistAlgo || algorithms.value[0] || 'AES'
    } else {
      form.advanced.userKeyEncrypt = config.userKeyEncrypt || 'AES'
      form.advanced.verifyApi = { ...form.advanced.verifyApi, ...(config.verifyApi || {}) }
      form.advanced.assistApi = { ...form.advanced.assistApi, ...(config.assistApi || {}) }
    }
  } finally {
    loading.value = false
  }
}

const buildConfig = () => {
  if (form.status === 'disabled') return {}
  if (form.mode === 'basic') {
    return { userKey: form.userKey, verifyAlgo: form.basic.verifyAlgo, assistAlgo: form.basic.assistAlgo }
  }

  return {
    userKey: form.userKey,
    userKeyEncrypt: form.advanced.userKeyEncrypt,
    verifyApi: form.advanced.verifyApi,
    assistApi: form.advanced.assistApi,
  }
}

const savePolicy = async () => {
  if (!form.projectId) return ElMessage.error('请选择项目')

  const payload = {
    projectId: form.projectId,
    status: form.status,
    mode: form.mode,
    config: buildConfig(),
    name: 'default',
  }

  if (isEdit.value) {
    await request.put(`/api/security-policies/${editingId.value}`, payload)
  } else {
    await request.post('/api/security-policies', payload)
  }

  ElMessage.success('保存成功')
  markSaved()
  router.push('/security-policies/list')
}

onMounted(async () => {
  await Promise.all([fetchProjects(), fetchAlgorithms(), fetchPolicyProjectIds()])
  resetForm()
  await fetchDetail()
  resetBaseline()
})
</script>

<template>
  <div class="policy-form" v-loading="loading">
    <div class="row2">
      <span class="label">项目名称:</span>
      <el-select v-model="form.projectId" filterable style="width: 260px" :disabled="isEdit">
        <el-option label="请选择项目" value="" />
        <el-option v-for="project in (isEdit ? projects : availableProjectsForCreate)" :key="project.id"
          :label="project.name" :value="project.id" />
      </el-select>
    </div>

    <div class="row2">
      <span class="label">安全策略状态:</span>
      <el-switch v-model="form.status" active-value="enabled" inactive-value="disabled" />
      <span class="switch-status-text">{{ form.status === 'enabled' ? '开启' : '关闭' }}</span>
    </div>

    <template v-if="form.status === 'enabled'">
      <div class="row2">
        <span class="label">安全策略模式:</span>
        <el-radio-group v-model="form.mode">
          <el-radio value="basic">初级</el-radio>
          <el-radio value="advanced">高级</el-radio>
        </el-radio-group>
      </div>

      <div class="section">
        <div class="section-title">用户密钥</div>
        <div class="section-body">
          <el-form label-width="120px">
            <el-form-item label="用户密钥:">
              <el-input v-model="form.userKey" maxlength="32" show-word-limit style="width: 260px" />
              <span class="help">最长不能超过 32 个字符</span>
            </el-form-item>
            <el-form-item v-if="form.mode === 'advanced'" label="用户密钥加密:">
              <el-select v-model="form.advanced.userKeyEncrypt" style="width: 260px">
                <el-option label="AES" value="AES" />
                <el-option label="DES" value="DES" />
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <template v-if="form.mode === 'basic'">
        <div class="section">
          <div class="section-title">验证接口安全策略</div>
          <div class="section-body">
            <el-form label-width="120px">
              <el-form-item label="通信加密:">
                <el-select v-model="form.basic.verifyAlgo" style="width: 260px">
                  <el-option v-for="algo in algorithms" :key="algo" :label="algo" :value="algo" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
        </div>

        <div class="section">
          <div class="section-title">辅助接口安全策略</div>
          <div class="section-body">
            <el-form label-width="120px">
              <el-form-item label="通信加密:">
                <el-select v-model="form.basic.assistAlgo" style="width: 260px">
                  <el-option v-for="algo in algorithms" :key="algo" :label="algo" :value="algo" />
                </el-select>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="section">
          <div class="section-title">验证接口安全策略</div>
          <div class="section-body">
            <div class="tip-warn">算法标识不能留空，建议使用自定义标识。</div>
            <el-form label-width="100px">
              <el-form-item label="通信加密:">
                <div class="algo-grid">
                  <div v-for="algo in algoTags" :key="algo" class="algo-row">
                    <span class="algo-name">{{ algo }} 标识</span>
                    <el-input v-model="form.advanced.verifyApi.algoTags[algo]" maxlength="16" style="width: 200px" />
                  </div>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </div>

        <div class="section">
          <div class="section-title">辅助接口安全策略</div>
          <div class="section-body">
            <div class="tip-warn">算法标识不能留空，建议使用自定义标识。</div>
            <el-form label-width="100px">
              <el-form-item label="通信加密:">
                <div class="algo-grid">
                  <div v-for="algo in algoTags" :key="algo" class="algo-row">
                    <span class="algo-name">{{ algo }} 标识</span>
                    <el-input v-model="form.advanced.assistApi.algoTags[algo]" maxlength="16" style="width: 200px" />
                  </div>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </template>
    </template>

    <div class="form-actions">
      <el-button @click="router.push('/security-policies/list')">返回列表</el-button>
      <el-button type="primary" @click="savePolicy">确认保存</el-button>
    </div>
  </div>
</template>

<style scoped>
.policy-form {
  max-width: 980px;
}

.row2 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.label {
  color: #303133;
  font-size: 13px;
  white-space: nowrap;
}

.section {
  margin-top: 12px;
  border-top: 1px dashed #dcdfe6;
  padding-top: 12px;
}

.section-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.help {
  margin-left: 10px;
  color: #6b7280;
  font-size: 12px;
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
  flex-wrap: wrap;
}

.algo-name {
  width: 90px;
  color: #303133;
  font-size: 13px;
}

.form-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
}
</style>
