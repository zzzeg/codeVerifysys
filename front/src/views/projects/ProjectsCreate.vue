<script setup lang="ts">
import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const trialModeOptions = {
  enabled: '开启试用模式',
  disabled: '关闭试用模式',
} as const

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

const handleSubmit = async () => {
  if (!form.name.trim()) return ElMessage.warning('项目名称不能为空')
  if (isTrialModeEnabled.value) {
    const trialTime = Number(form.trialTime)
    const deviceTrialTime = Number(form.deviceTrialTime)
    if (!Number.isFinite(trialTime) || trialTime <= 0 || trialTime > 14400) return ElMessage.warning('试用时间需在 1 到 14400 分钟之间')
    if (!Number.isFinite(deviceTrialTime) || deviceTrialTime <= 0 || deviceTrialTime > 720) return ElMessage.warning('单台电脑试用时间需在 1 到 720 分钟之间')
  } else {
    const unbindDeductMinutes = Number(form.unbindDeductMinutes)
    if (!Number.isFinite(unbindDeductMinutes) || unbindDeductMinutes < 0 || unbindDeductMinutes > 720) {
      return ElMessage.warning('解绑扣时需在 0 到 720 分钟之间')
    }
  }
  await request.post('/api/projects', { name: form.name, description: form.notice, config: form })
  ElMessage.success('新建项目成功')
}
</script>

<template>
  <div class="form-shell">
    <el-form :model="form" label-width="auto" class="project-form">
      <el-form-item label="项目名称：" required>
        <el-input v-model="form.name" placeholder="支持中文、字母、数字" style="width: 320px" />
      </el-form-item>

      <el-form-item label="试用模式：" required>
        <el-switch v-model="form.trialMode" :active-value="trialModeOptions.enabled"
          :inactive-value="trialModeOptions.disabled" />
        <span class="switch-status-text">{{ isTrialModeEnabled ? '开启' : '关闭' }}</span>
      </el-form-item>

      <template v-if="isTrialModeEnabled">
        <el-form-item label="试用时间：" required>
          <el-input v-model="form.trialTime" style="width: 120px" />
          <span class="muted">单位：分钟，最大不超过 14400 分钟</span>
        </el-form-item>

        <el-form-item label="单台电脑试用时间：" required>
          <el-input v-model="form.deviceTrialTime" style="width: 120px" />
          <span class="muted">单位：分钟，最大限制时间为 720 分钟</span>
        </el-form-item>
      </template>

      <el-form-item v-else label="解绑扣时：" required>
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
