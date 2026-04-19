<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../utils/request'
import { formatDateTimeCell } from '../utils/datetime'

const profile = reactive<any>({
  username: '',
  email: '',
  phone: '',
  remark: '',
})
const pwdForm = reactive({ oldPassword: '', newPassword: '' })
const logs = ref<any[]>([])
const formatDate = formatDateTimeCell

const fetchProfile = async () => {
  const resp = await request.get('/api/profile')
  Object.assign(profile, resp.data.data)
  const logResp = await request.get('/api/profile/logs')
  logs.value = logResp.data.data
}

const saveProfile = async () => {
  await request.put('/api/profile', profile)
  ElMessage.success('资料已更新')
}

const changePassword = async () => {
  await request.put('/api/profile/password', pwdForm)
  ElMessage.success('密码已修改')
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
}

onMounted(fetchProfile)
</script>

<template>
  <div class="profile vs-app-page vs-page-shell">
    <section class="vs-page-header vs-page-header--ops">
      <div class="vs-page-copy">
        <h2 class="vs-page-title">个人中心</h2>
        <p class="vs-page-subtitle">保留资料维护、密码更新和操作记录，仅调整区块结构和视觉层级。</p>
      </div>
      <div class="vs-meta-strip">
        <div class="vs-meta-card">
          <span>最近操作</span>
          <strong>{{ logs.length }}</strong>
        </div>
      </div>
    </section>

    <div class="vs-grid-2">
      <el-card class="vs-panel">
        <template #header>
          <div>
            <h3 class="vs-panel-title">个人信息</h3>
            <p class="vs-panel-subtitle">基础资料</p>
          </div>
        </template>
        <el-form :model="profile" label-width="100px" style="max-width: 520px">
          <el-form-item label="用户名">
            <el-input v-model="profile.username" disabled />
          </el-form-item>
          <el-form-item label="邮箱">
            <el-input v-model="profile.email" />
          </el-form-item>
          <el-form-item label="电话">
            <el-input v-model="profile.phone" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="profile.remark" type="textarea" />
          </el-form-item>
          <el-button type="primary" @click="saveProfile">保存</el-button>
        </el-form>
      </el-card>

      <el-card class="vs-panel">
        <template #header>
          <div>
            <h3 class="vs-panel-title">修改密码</h3>
            <p class="vs-panel-subtitle">账号安全</p>
          </div>
        </template>
        <el-form :model="pwdForm" label-width="100px" style="max-width: 420px">
          <el-form-item label="原密码">
            <el-input v-model="pwdForm.oldPassword" type="password" show-password />
          </el-form-item>
          <el-form-item label="新密码">
            <el-input v-model="pwdForm.newPassword" type="password" show-password />
          </el-form-item>
          <el-button type="primary" @click="changePassword">修改</el-button>
        </el-form>
      </el-card>
    </div>

    <el-card class="vs-panel">
      <template #header>
        <div>
          <h3 class="vs-panel-title">近期操作</h3>
          <p class="vs-panel-subtitle">最近行为记录</p>
        </div>
      </template>
      <el-table :data="logs" style="width: 100%" size="small">
        <el-table-column prop="action" label="动作" />
        <el-table-column prop="createdAt" label="时间" :formatter="formatDate" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
