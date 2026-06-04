<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { ApiResp } from '../../utils/request'
import type { UploadFile, UploadUserFile } from 'element-plus'
import { Avatar as AvatarIcon, Camera, CreditCard, Location, User } from '@element-plus/icons-vue'
import request from '../../utils/request'

const avatarDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const emailDialogVisible = ref(false)
const mobileDialogVisible = ref(false)
const emailFormRef = ref<FormInstance>()
const mobileFormRef = ref<FormInstance>()
const pwdFormRef = ref<FormInstance>()

const profile = reactive({
  username: '',
  email: '',
  phone: '',
  remark: '',
  realName: '翟恩光',
  idCard: '412***********107X',
  mobileMasked: '186****8535',
  qq: '672813694',
  bankName: '支付宝',
  alipayAccount: 'zhai**********.com',
  address: '广东省地铁金融大厦9楼',
  avatar: '',
})

const avatarForm = reactive({ file: null as File | null })
const avatarFileList = ref<UploadUserFile[]>([])
const avatarPreviewUrl = ref('')
const pwdForm = reactive({ oldPassword: '', newPassword: '' })
const emailForm = reactive({ email: '', emailCode: '' })
const mobileForm = reactive({ mobile: '', mobileCode: '' })
const emailRules: FormRules<typeof emailForm> = {
  email: [
    { required: true, whitespace: true, message: '请输入新邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  emailCode: [{ required: true, whitespace: true, message: '请输入邮箱验证码', trigger: 'blur' }],
}
const mobileRules: FormRules<typeof mobileForm> = {
  mobile: [{ required: true, whitespace: true, message: '请输入新手机号', trigger: 'blur' }],
  mobileCode: [{ required: true, whitespace: true, message: '请输入手机验证码', trigger: 'blur' }],
}
const pwdRules: FormRules<typeof pwdForm> = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
}
const emailCountdown = ref(0)
const mobileCountdown = ref(0)
let emailTimer: number | undefined
let mobileTimer: number | undefined

const startCountdown = (target: 'email' | 'mobile', seconds: number) => {
  const countdown = target === 'email' ? emailCountdown : mobileCountdown
  const currentTimer = target === 'email' ? emailTimer : mobileTimer
  countdown.value = seconds
  if (currentTimer) window.clearInterval(currentTimer)

  const interval = window.setInterval(() => {
    countdown.value = Math.max(countdown.value - 1, 0)
    if (countdown.value <= 0) {
      window.clearInterval(interval)
      if (target === 'email') emailTimer = undefined
      else mobileTimer = undefined
    }
  }, 1000)

  if (target === 'email') emailTimer = interval
  else mobileTimer = interval
}

const clearCountdowns = () => {
  if (emailTimer) window.clearInterval(emailTimer)
  if (mobileTimer) window.clearInterval(mobileTimer)
  emailTimer = undefined
  mobileTimer = undefined
}

const clearAvatarPreview = () => {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value)
    avatarPreviewUrl.value = ''
  }
}

const fetchProfile = async () => {
  const resp = await request.get('/api/profile')
  Object.assign(profile, resp.data.data)
}

const openAvatarDialog = () => {
  avatarForm.file = null
  avatarFileList.value = avatarPreviewUrl.value ? [{ name: 'avatar', url: avatarPreviewUrl.value }] : []
  avatarDialogVisible.value = true
}

const handleAvatarChange = (file: File) => {
  clearAvatarPreview()
  avatarForm.file = file
  avatarPreviewUrl.value = URL.createObjectURL(file)
  avatarFileList.value = [{ name: file.name || 'avatar', url: avatarPreviewUrl.value }]
}

const handleAvatarExceed = () => ElMessage.warning('只能上传一张头像图片')

const handleAvatarRemove = () => {
  clearAvatarPreview()
  avatarForm.file = null
  avatarFileList.value = []
}

const confirmAvatarChange = () => {
  if (!avatarForm.file) return ElMessage.warning('请选择头像文件')
  profile.avatar = avatarPreviewUrl.value
  ElMessage.success('头像上传成功')
  avatarDialogVisible.value = false
}

const openPasswordDialog = () => {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  passwordDialogVisible.value = true
}

const openEmailDialog = () => {
  emailForm.email = profile.email || ''
  emailForm.emailCode = ''
  emailCountdown.value = 0
  if (emailTimer) window.clearInterval(emailTimer)
  emailDialogVisible.value = true
}

const openMobileDialog = () => {
  mobileForm.mobile = profile.mobileMasked || ''
  mobileForm.mobileCode = ''
  mobileCountdown.value = 0
  if (mobileTimer) window.clearInterval(mobileTimer)
  mobileDialogVisible.value = true
}

const saveProfile = async () => {
  await request.put('/api/profile', {
    phone: profile.phone,
    remark: profile.remark,
    realName: profile.realName,
    idCard: profile.idCard,
    mobileMasked: profile.mobileMasked,
    qq: profile.qq,
    bankName: profile.bankName,
    alipayAccount: profile.alipayAccount,
    address: profile.address,
  })
  ElMessage.success('资料已更新')
}

const sendEmailCode = async () => {
  const valid = await emailFormRef.value?.validateField('email').catch(() => false)
  if (!valid) return
  const resp = await request.post<ApiResp<{ expireAt: number; debugCode?: string }>>('/api/auth/email-code', {
    email: emailForm.email,
    purpose: 'reset',
  })
  if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '发送失败')
  ElMessage.success(resp.data.data.debugCode ? `验证码已发送（开发码：${resp.data.data.debugCode}）` : '验证码已发送')
  if (resp.data.data.debugCode) emailForm.emailCode = resp.data.data.debugCode
  startCountdown('email', 60)
}

const sendMobileCode = async () => {
  const valid = await mobileFormRef.value?.validateField('mobile').catch(() => false)
  if (!valid) return
  const resp = await request.post<ApiResp<{ expireAt: number; debugCode?: string }>>('/api/auth/email-code', {
    email: `${mobileForm.mobile}@mobile.local`,
    purpose: 'reset',
  })
  if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '发送失败')
  ElMessage.success(resp.data.data.debugCode ? `验证码已发送（开发码：${resp.data.data.debugCode}）` : '验证码已发送')
  if (resp.data.data.debugCode) mobileForm.mobileCode = resp.data.data.debugCode
  startCountdown('mobile', 60)
}

const changeEmail = async () => {
  const valid = await emailFormRef.value?.validate().catch(() => false)
  if (!valid) return
  await request.put('/api/profile', { email: emailForm.email, emailCode: emailForm.emailCode, phone: profile.phone, remark: profile.remark })
  profile.email = emailForm.email
  emailDialogVisible.value = false
  ElMessage.success('邮箱修改成功')
}

const changeMobile = async () => {
  const valid = await mobileFormRef.value?.validate().catch(() => false)
  if (!valid) return
  await request.put('/api/profile', { mobileMasked: mobileForm.mobile, mobileCode: mobileForm.mobileCode, phone: profile.phone, remark: profile.remark })
  profile.mobileMasked = mobileForm.mobile
  mobileDialogVisible.value = false
  ElMessage.success('电话修改成功')
}

const changePassword = async () => {
  const valid = await pwdFormRef.value?.validate().catch(() => false)
  if (!valid) return
  await request.put('/api/profile/password', pwdForm)
  ElMessage.success('密码已修改')
  passwordDialogVisible.value = false
}

onMounted(fetchProfile)
onBeforeUnmount(() => {
  clearCountdowns()
  clearAvatarPreview()
})
</script>

<template>
  <div>
    <div class="profile-actions">
      <el-button @click="openPasswordDialog">修改密码</el-button>
      <el-button type="primary" @click="saveProfile">保存资料</el-button>
    </div>

    <div class="hero-card">
      <div class="hero-avatar">
        <img v-if="profile.avatar" :src="profile.avatar" alt="avatar" class="avatar-image" />
        <el-icon v-else class="avatar-icon"><AvatarIcon /></el-icon>
        <button type="button" class="avatar-trigger" @click="openAvatarDialog">
          <el-icon><Camera /></el-icon>
        </button>
      </div>
      <div>
        <div class="hero-name">{{ profile.username || '管理员' }}</div>
        <div class="hero-subtitle">欢迎回来，{{ profile.realName || profile.username || '管理员' }}</div>
      </div>
    </div>

    <div class="profile-block">
      <div class="block-title">
        <el-icon><User /></el-icon>
        <span>基本信息</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <label>用户名</label>
          <div>{{ profile.username || '管理员' }}</div>
        </div>
        <div class="info-item">
          <div class="info-item-head">
            <label>邮箱</label>
            <el-button type="primary" @click="openEmailDialog">修改</el-button>
          </div>
          <div>{{ profile.email || '-' }}</div>
        </div>
        <div class="info-item">
          <div class="info-item-head">
            <label>电话</label>
            <el-button type="primary" @click="openMobileDialog">修改</el-button>
          </div>
          <div>{{ profile.mobileMasked || profile.phone || '-' }}</div>
        </div>
        <div class="info-item">
          <label>QQ</label>
          <div>{{ profile.qq || '-' }}</div>
        </div>
        <div class="info-item span-2">
          <div class="info-item-head">
            <label>
              <el-icon><Location /></el-icon>
              地址
            </label>
          </div>
          <div>{{ profile.address || '-' }}</div>
        </div>
      </div>
    </div>

    <div class="profile-block">
      <div class="block-title">
        <el-icon><CreditCard /></el-icon>
        <span>实名认证信息</span>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <label>真实姓名</label>
          <div>{{ profile.realName || '-' }}</div>
        </div>
        <div class="info-item">
          <label>身份证号</label>
          <div>{{ profile.idCard || '-' }}</div>
        </div>
        <div class="info-item">
          <label>开户银行</label>
          <div>{{ profile.bankName || '-' }}</div>
        </div>
        <div class="info-item">
          <label>支付宝账号</label>
          <div>{{ profile.alipayAccount || '-' }}</div>
        </div>
      </div>
    </div>

    <el-dialog v-model="avatarDialogVisible" title="修改头像" width="420px" destroy-on-close append-to-body>
      <el-upload
        class="avatar-upload"
        :class="{ 'has-file': avatarFileList.length > 0 }"
        :auto-upload="false"
        :file-list="avatarFileList"
        list-type="picture-card"
        :show-file-list="true"
        :limit="1"
        accept="image/*"
        :on-exceed="handleAvatarExceed"
        :on-remove="handleAvatarRemove"
        :on-change="(uploadFile: UploadFile) => handleAvatarChange(uploadFile.raw as File)"
      >
        <el-icon v-if="avatarFileList.length === 0"><Camera /></el-icon>
      </el-upload>
      <template #footer>
        <el-button @click="avatarDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmAvatarChange">确认上传</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="emailDialogVisible" title="修改邮箱" width="460px" destroy-on-close append-to-body>
      <el-form ref="emailFormRef" :model="emailForm" :rules="emailRules" label-width="92px">
        <el-form-item label="新邮箱" prop="email"><el-input v-model="emailForm.email" /></el-form-item>
        <el-form-item label="验证码" prop="emailCode">
          <div class="code-row">
            <el-input v-model="emailForm.emailCode" placeholder="请输入验证码" />
            <el-button :disabled="emailCountdown > 0" @click="sendEmailCode">{{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="emailDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changeEmail">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="mobileDialogVisible" title="修改手机号" width="460px" destroy-on-close append-to-body>
      <el-form ref="mobileFormRef" :model="mobileForm" :rules="mobileRules" label-width="92px">
        <el-form-item label="新手机号" prop="mobile"><el-input v-model="mobileForm.mobile" /></el-form-item>
        <el-form-item label="验证码" prop="mobileCode">
          <div class="code-row">
            <el-input v-model="mobileForm.mobileCode" placeholder="请输入验证码" />
            <el-button :disabled="mobileCountdown > 0" @click="sendMobileCode">{{ mobileCountdown > 0 ? `${mobileCountdown}s` : '获取验证码' }}</el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mobileDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changeMobile">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="passwordDialogVisible" title="修改密码" width="420px" destroy-on-close append-to-body>
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="92px">
        <el-form-item label="原密码" prop="oldPassword"><el-input v-model="pwdForm.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码" prop="newPassword"><el-input v-model="pwdForm.newPassword" type="password" show-password /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.profile-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 12px;
}

.hero-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.hero-avatar {
  position: relative;
  width: 72px;
  height: 72px;
}

.avatar-image,
.avatar-icon {
  width: 100%;
  height: 100%;
  border-radius: 999px;
}

.avatar-image {
  object-fit: cover;
  border: 1px solid #e4e7ed;
}

.avatar-icon {
  display: grid;
  place-items: center;
  background: #eff6ff;
  color: #2563eb;
  font-size: 32px;
  border: 1px solid #dbeafe;
}

.avatar-trigger {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 32px;
  height: 32px;
  border: 1px solid #fff;
  border-radius: 999px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--vs-primary);
}

.hero-name {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.hero-subtitle {
  margin-top: 4px;
  font-size: 14px;
  color: #6b7280;
}

.profile-block + .profile-block {
  margin-top: 18px;
}

.block-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.block-title .el-icon {
  color: #3d97f9;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-item {
  padding: 14px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #f8fafc;
}

.info-item label {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 12px;
  color: #6b7280;
}

.info-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.span-2 {
  grid-column: 1 / -1;
}

.code-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 10px;
}

.avatar-upload.has-file :deep(.el-upload--picture-card) {
  display: none;
}

@media (max-width: 980px) {
  .info-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
