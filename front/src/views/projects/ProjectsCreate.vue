<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import request from '../../utils/request'

const trialModeOptions = {
  enabled: '开启试用模式',
  disabled: '关闭试用模式',
} as const

const route = useRoute()
const router = useRouter()
const formRef = ref<FormInstance>()
const editingId = computed(() => String(route.params.id || ''))
const isEdit = computed(() => Boolean(editingId.value))

const form = reactive({
  name: '',
  trialMode: trialModeOptions.enabled,
  trialTime: 10,
  deviceTrialTime: 10,
  unbindDeductMinutes: 10,
  bindDevice: true,
  clientUnbind: true,
  vip: true,
  unbindPassword: '',
  notice: '',
  remark: '',
  banner: '',
})

const isTrialModeEnabled = computed(() => form.trialMode === trialModeOptions.enabled)

const validateTrialTime = (_rule: unknown, value: number, callback: (error?: Error) => void) => {
  if (!isTrialModeEnabled.value) {
    callback()
    return
  }
  const trialTime = Number(value)
  if (!Number.isFinite(trialTime) || trialTime <= 0 || trialTime > 14400) {
    callback(new Error('试用时间需在 1 到 14400 分钟之间'))
    return
  }
  callback()
}

const validateDeviceTrialTime = (_rule: unknown, value: number, callback: (error?: Error) => void) => {
  if (!isTrialModeEnabled.value) {
    callback()
    return
  }
  const deviceTrialTime = Number(value)
  if (!Number.isFinite(deviceTrialTime) || deviceTrialTime <= 0 || deviceTrialTime > 720) {
    callback(new Error('单台电脑试用时间需在 1 到 720 分钟之间'))
    return
  }
  callback()
}

const validateUnbindDeductMinutes = (_rule: unknown, value: number, callback: (error?: Error) => void) => {
  if (isTrialModeEnabled.value) {
    callback()
    return
  }
  const unbindDeductMinutes = Number(value)
  if (!Number.isFinite(unbindDeductMinutes) || unbindDeductMinutes < 0 || unbindDeductMinutes > 720) {
    callback(new Error('解绑扣时需在 0 到 720 分钟之间'))
    return
  }
  callback()
}

const rules: FormRules<typeof form> = {
  name: [{ required: true, whitespace: true, message: '项目名称不能为空', trigger: 'blur' }],
  trialTime: [{ validator: validateTrialTime, trigger: 'blur' }],
  deviceTrialTime: [{ validator: validateDeviceTrialTime, trigger: 'blur' }],
  unbindDeductMinutes: [{ validator: validateUnbindDeductMinutes, trigger: 'blur' }],
}

const applyProject = (project: any) => {
  const config = project?.config && typeof project.config === 'object' ? project.config : {}
  form.name = project?.name || ''
  form.notice = project?.description || ''
  form.trialMode = config.trialMode || trialModeOptions.enabled
  form.trialTime = Number(config.trialTime ?? 10)
  form.deviceTrialTime = Number(config.deviceTrialTime ?? 10)
  form.unbindDeductMinutes = Number(config.unbindDeductMinutes ?? 10)
  form.bindDevice = typeof config.bindDevice === 'boolean' ? config.bindDevice : true
  form.clientUnbind = typeof config.clientUnbind === 'boolean' ? config.clientUnbind : true
  form.vip = typeof config.vip === 'boolean' ? config.vip : true
  form.unbindPassword = config.unbindPassword || ''
  form.remark = config.remark || ''
  form.banner = config.banner || ''
}

const fetchProject = async () => {
  if (!isEdit.value) return
  const resp = await request.get(`/api/projects/${editingId.value}`)
  applyProject(resp.data.data)
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const payload = { name: form.name, description: form.notice, config: form }
  if (isEdit.value) {
    await request.put(`/api/projects/${editingId.value}`, payload)
    ElMessage.success('项目更新成功')
    router.push('/projects/list')
    return
  }
  await request.post('/api/projects', payload)
  ElMessage.success('新建项目成功')
  router.push('/projects/list')
}

fetchProject()
</script>

<template>
  <div class="form-shell">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" class="project-form">
      <el-form-item label="项目名称：" prop="name">
        <el-input v-model="form.name" placeholder="支持中文、字母、数字" style="width: 320px" />
      </el-form-item>

      <el-form-item label="试用模式：" required>
        <el-switch v-model="form.trialMode" :active-value="trialModeOptions.enabled"
          :inactive-value="trialModeOptions.disabled" />
        <span class="switch-status-text">{{ isTrialModeEnabled ? '开启' : '关闭' }}</span>
      </el-form-item>

      <template v-if="isTrialModeEnabled">
        <el-form-item label="试用时间：" prop="trialTime">
          <el-input v-model="form.trialTime" style="width: 120px" />
          <span class="muted">单位：分钟，最大不超过 14400 分钟</span>
        </el-form-item>

        <el-form-item label="单台电脑试用时间：" prop="deviceTrialTime">
          <el-input v-model="form.deviceTrialTime" style="width: 120px" />
          <span class="muted">单位：分钟，最大限制时间为 720 分钟</span>
        </el-form-item>
      </template>

      <el-form-item v-else label="解绑扣时：" prop="unbindDeductMinutes">
        <el-input v-model="form.unbindDeductMinutes" style="width: 120px" />
        <span class="muted">单位 分钟，最大解绑扣时为720分钟(半天，12小时)</span>
      </el-form-item>

      <el-form-item label="开启机器码绑定：" required>
        <el-switch v-model="form.bindDevice" />
        <span class="switch-status-text">{{ form.bindDevice ? '启用' : '禁用' }}</span>
      </el-form-item>

      <el-form-item label="客户端自己解绑：" required>
        <el-switch v-model="form.clientUnbind" />
        <span class="switch-status-text">{{ form.clientUnbind ? '启用' : '禁用' }}</span>
      </el-form-item>

      <el-form-item label="是否顶号：" required>
        <el-switch v-model="form.vip" />
        <span class="switch-status-text">{{ form.vip ? '启用' : '禁用' }}</span>
      </el-form-item>

      <el-form-item label="解绑密码：">
        <el-input v-model="form.unbindPassword" style="width: 180px" />
        <span class="muted">当机器码绑定或客户端自己解绑为关闭时，解绑密码无效</span>
      </el-form-item>

      <el-form-item label="项目公告：">
        <el-input v-model="form.notice" type="textarea" :rows="3" style="width: 600px" />
      </el-form-item>

      <el-form-item label="项目备注：">
        <el-input v-model="form.remark" type="textarea" :rows="3" style="width: 600px" />
      </el-form-item>

      <el-form-item label="&nbsp;">
        <el-button type="primary" class="vs-ref-button action-btn" @click="handleSubmit">确认</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.project-form {
  max-width: 920px;
}

.muted {
  margin-left: 8px;
  color: #999;
}

.action-btn {
  box-shadow: none;
}
</style>
