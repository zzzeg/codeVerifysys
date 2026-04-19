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
  await request.post('/api/projects', { name: form.name, description: form.notice, config: form })
  ElMessage.success('新建项目成功')
}
</script>

<template>
  <div>
    <el-form :model="form" label-width="200" class="project-form">
      <el-form-item label="项目名称：" required>
        <el-input v-model="form.name" placeholder="支持中文、字母、数字" style="width: 320px" />
      </el-form-item>

      <el-form-item label="试用模式：" required>
        <el-radio-group v-model="form.trialMode">
          <el-radio :label="trialModeOptions.enabled">开启试用模式</el-radio>
          <el-radio :label="trialModeOptions.disabled">关闭试用模式</el-radio>
        </el-radio-group>
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
        <el-radio-group v-model="form.bindDevice">
          <el-radio :label="true">启用</el-radio>
          <el-radio :label="false">关闭</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="客户端自己解绑：" required>
        <el-radio-group v-model="form.clientUnbind">
          <el-radio :label="true">启用</el-radio>
          <el-radio :label="false">关闭</el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="是否顶号：" required>
        <el-radio-group v-model="form.vip">
          <el-radio :label="true">启用</el-radio>
          <el-radio :label="false">关闭</el-radio>
        </el-radio-group>
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
        <el-button type="warning" class="vs-ref-button action-btn" @click="handleSubmit">确认</el-button>
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
  box-shadow: 0 14px 24px rgba(249, 115, 22, 0.24);
}
</style>
