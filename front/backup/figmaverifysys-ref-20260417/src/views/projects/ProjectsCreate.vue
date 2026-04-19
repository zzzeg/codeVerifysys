<script setup lang="ts">
import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const form = reactive({
  name: '',
  trialMode: '单次试用模式',
  trialTime: 10,
  deviceTrialTime: 10,
  bindDevice: true,
  clientUnbind: true,
  vip: true,
  unbindPassword: '',
  notice: '',
  remark: '',
  banner: '',
})

const handleSubmit = async () => {
  await request.post('/api/projects', { name: form.name, description: form.notice, config: form })
  ElMessage.success('新建项目成功')
}
</script>

<template>
  <div class="project-create vs-app-page vs-page-shell">
    <section class="vs-page-header vs-page-header--ops">
      <div class="vs-page-copy">
        <h2 class="vs-page-title">新建注册码项目</h2>
        <p class="vs-page-subtitle">保留全部配置项，仅调整表单布局和页面视觉层次。</p>
      </div>
      <div class="vs-meta-strip">
        <div class="vs-meta-card">
          <span>配置项</span>
          <strong>9</strong>
        </div>
      </div>
    </section>

    <el-card class="vs-panel" shadow="never">
      <el-form :model="form" label-width="auto" class="project-form">
        <el-form-item label="项目名称：" required>
          <el-input v-model="form.name" placeholder="支持中文、字母、数字" style="width: 320px" />
        </el-form-item>
        <el-form-item label="试用模式：" required>
          <el-radio-group v-model="form.trialMode">
            <el-radio label="开启试用模式" />
            <el-radio label="关闭试用模式" />
          </el-radio-group>
        </el-form-item>
        <el-form-item label="试用时间：" required>
          <el-input v-model="form.trialTime" style="width: 120px" />
          <span class="muted">单位：分钟，最大不超过14400分钟</span>
        </el-form-item>
        <el-form-item label="单台电脑试用时间：" required>
          <el-input v-model="form.deviceTrialTime" style="width: 120px" />
          <span class="muted">单位：分钟，最大限制时间为720分钟</span>
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
          <span class="muted">当机器码绑定或客户端自己解绑为关闭时，解绑密码为无效</span>
        </el-form-item>
        <el-form-item label="项目公告：">
          <el-input v-model="form.notice" type="textarea" :rows="3" style="width: 600px" />
        </el-form-item>
        <el-form-item label="项目备注：">
          <el-input v-model="form.remark" type="textarea" :rows="3" style="width: 600px" />
        </el-form-item>
        <el-form-item label="&nbsp;">
          <el-button type="success" @click="handleSubmit">确认</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.project-create {
  gap: 18px;
}

.project-form {
  max-width: 980px;
}

.muted {
  margin-left: 8px;
  color: #999;
}
</style>
