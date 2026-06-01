<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ApiResp } from '../utils/request'
import type { UploadFile, UploadUserFile } from 'element-plus'
import {
  Avatar as AvatarIcon,
  Camera,
  CreditCard,
  Location,
  Money,
  User,
  Wallet,
} from '@element-plus/icons-vue'
import request from '../utils/request'

type WithdrawRecord = {
  id: string
  amount: number
  status: string
  time: string
  bankAccount: string
}

const activeTab = ref<'info' | 'finance'>('info')
const avatarDialogVisible = ref(false)
const passwordDialogVisible = ref(false)
const emailDialogVisible = ref(false)
const mobileDialogVisible = ref(false)
const withdrawDialogVisible = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)

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
  balance: 1580.5,
  currentIncome: 450,
})

const avatarForm = reactive({
  file: null as File | null,
})
const avatarFileList = ref<UploadUserFile[]>([])
const avatarPreviewUrl = ref('')

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
})

const emailForm = reactive({
  email: '',
  emailCode: '',
})

const mobileForm = reactive({
  mobile: '',
  mobileCode: '',
})

const withdrawForm = reactive({
  amount: '',
})

const withdrawRecords = ref<WithdrawRecord[]>([
  { id: '1', amount: 500, status: '已完成', time: '2026-03-15 14:30:00', bankAccount: '工商银行(尾号1234)' },
  { id: '2', amount: 300, status: '处理中', time: '2026-04-10 10:20:00', bankAccount: '工商银行(尾号1234)' },
  { id: '3', amount: 800, status: '已完成', time: '2026-02-20 16:45:00', bankAccount: '工商银行(尾号1234)' },
])

const totalPages = computed(() => Math.max(1, Math.ceil(withdrawRecords.value.length / pageSize.value)))
const pagedWithdrawRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return withdrawRecords.value.slice(start, start + pageSize.value)
})

const emailCountdown = ref(0)
const mobileCountdown = ref(0)
let emailTimer: number | undefined
let mobileTimer: number | undefined

const startCountdown = (target: 'email' | 'mobile', seconds: number) => {
  const countdown = target === 'email' ? emailCountdown : mobileCountdown
  const timer = target === 'email' ? emailTimer : mobileTimer

  countdown.value = seconds
  if (timer) window.clearInterval(timer)

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
  emailCountdown.value = 0
  mobileCountdown.value = 0
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
  avatarFileList.value = avatarPreviewUrl.value
    ? [{ name: 'avatar', url: avatarPreviewUrl.value }]
    : []
  avatarDialogVisible.value = true
}

const handleAvatarChange = (file: File) => {
  clearAvatarPreview()
  avatarForm.file = file
  avatarPreviewUrl.value = URL.createObjectURL(file)
  avatarFileList.value = [
    {
      name: file.name || 'avatar',
      url: avatarPreviewUrl.value,
    },
  ]
}

const handleAvatarExceed = () => {
  ElMessage.warning('只能上传一张头像图片')
}

const handleAvatarRemove = () => {
  clearAvatarPreview()
  avatarForm.file = null
  avatarFileList.value = []
}

const confirmAvatarChange = () => {
  if (!avatarForm.file) {
    ElMessage.warning('请选择头像文件')
    return
  }
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
  if (emailTimer) {
    window.clearInterval(emailTimer)
    emailTimer = undefined
  }
  emailDialogVisible.value = true
}

const openMobileDialog = () => {
  mobileForm.mobile = profile.mobileMasked || ''
  mobileForm.mobileCode = ''
  mobileCountdown.value = 0
  if (mobileTimer) {
    window.clearInterval(mobileTimer)
    mobileTimer = undefined
  }
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
  if (!emailForm.email.trim()) return ElMessage.warning('请输入新邮箱')

  try {
    const resp = await request.post<ApiResp<{ expireAt: number; debugCode?: string }>>('/api/auth/email-code', {
      email: emailForm.email,
      purpose: 'reset',
    })
    if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '发送失败')
    ElMessage.success(resp.data.data.debugCode ? `验证码已发送（开发码：${resp.data.data.debugCode}）` : '验证码已发送')
    if (resp.data.data.debugCode) emailForm.emailCode = resp.data.data.debugCode
    startCountdown('email', 60)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '发送失败')
  }
}

const sendMobileCode = async () => {
  if (!mobileForm.mobile.trim()) return ElMessage.warning('请输入新手机号')

  try {
    const resp = await request.post<ApiResp<{ expireAt: number; debugCode?: string }>>('/api/auth/email-code', {
      email: `${mobileForm.mobile}@mobile.local`,
      purpose: 'reset',
    })
    if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '发送失败')
    ElMessage.success(resp.data.data.debugCode ? `验证码已发送（开发码：${resp.data.data.debugCode}）` : '验证码已发送')
    if (resp.data.data.debugCode) mobileForm.mobileCode = resp.data.data.debugCode
    startCountdown('mobile', 60)
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '发送失败')
  }
}

const changeEmail = async () => {
  if (!emailForm.email.trim()) return ElMessage.warning('请输入新邮箱')
  if (!emailForm.emailCode.trim()) return ElMessage.warning('请输入邮箱验证码')

  await request.put('/api/profile', {
    email: emailForm.email,
    emailCode: emailForm.emailCode,
    phone: profile.phone,
    remark: profile.remark,
  })

  profile.email = emailForm.email
  emailDialogVisible.value = false
  ElMessage.success('邮箱修改成功')
}

const changeMobile = async () => {
  if (!mobileForm.mobile.trim()) return ElMessage.warning('请输入新手机号')
  if (!mobileForm.mobileCode.trim()) return ElMessage.warning('请输入手机验证码')

  await request.put('/api/profile', {
    mobileMasked: mobileForm.mobile,
    mobileCode: mobileForm.mobileCode,
    phone: profile.phone,
    remark: profile.remark,
  })

  profile.mobileMasked = mobileForm.mobile
  mobileDialogVisible.value = false
  ElMessage.success('电话修改成功')
}

const changePassword = async () => {
  await request.put('/api/profile/password', pwdForm)
  ElMessage.success('密码已修改')
  passwordDialogVisible.value = false
}

const handleWithdraw = () => {
  if (profile.currentIncome < 200) {
    ElMessage.error('当前收入不足200元，无法提现')
    return
  }
  const amount = Number(withdrawForm.amount)
  if (!amount || amount <= 0) {
    ElMessage.warning('请输入提现金额')
    return
  }
  ElMessage.success('提现申请已提交，预计7个工作日内到账')
  withdrawDialogVisible.value = false
  withdrawForm.amount = ''
}

onMounted(fetchProfile)

onBeforeUnmount(() => {
  clearCountdowns()
  clearAvatarPreview()
})
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame">
      <div class="vs-ref-split">
        <aside class="vs-ref-side">
          <div class="vs-ref-side-head">个人中心</div>
          <div class="vs-ref-side-body">
            <div class="mobile-ref-crumb">
              <span>个人中心</span>
              <i>/</i>
              <strong>{{ activeTab === 'info' ? '个人信息' : '财务管理' }}</strong>
            </div>
            <button type="button" class="vs-ref-side-link" :class="{ active: activeTab === 'info' }" @click="activeTab = 'info'">
              &gt; 个人信息
            </button>
            <button type="button" class="vs-ref-side-link" :class="{ active: activeTab === 'finance' }" @click="activeTab = 'finance'">
              &gt; 财务管理
            </button>
          </div>
        </aside>

        <section class="vs-ref-main">
          <div class="vs-ref-main-head profile-main-head">
            <h2 class="vs-ref-main-title">{{ activeTab === 'info' ? '个人信息' : '财务管理' }}</h2>
            <div class="profile-head-actions" v-if="activeTab === 'info'">
              <el-button @click="openPasswordDialog">修改密码</el-button>
              <el-button type="primary" @click="saveProfile">保存资料</el-button>
            </div>
          </div>

          <div class="vs-ref-main-body profile-main-body">
            <template v-if="activeTab === 'info'">
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
            </template>

            <template v-else>
              <div class="finance-cards">
                <div class="finance-card balance">
                  <div class="finance-card-icon">
                    <el-icon><Wallet /></el-icon>
                  </div>
                  <div class="finance-card-copy">
                    <div class="finance-label">账户余额</div>
                    <div class="finance-value">￥{{ Number(profile.balance || 0).toFixed(2) }}</div>
                  </div>
                </div>
                <div class="finance-card income">
                  <div class="finance-card-icon">
                    <el-icon><Money /></el-icon>
                  </div>
                  <div class="finance-card-copy">
                    <div class="finance-label">当前收入</div>
                    <div class="finance-value">￥{{ Number(profile.currentIncome || 0).toFixed(2) }}</div>
                    <div class="finance-note">每月1号系统自动结算，7个工作日内完成打款，200元起结。</div>
                  </div>
                </div>
              </div>

              <div class="finance-toolbar">
                <el-button type="primary" @click="withdrawDialogVisible = true">申请提现</el-button>
              </div>

              <div class="profile-block">
                <div class="block-title">
                  <el-icon><Wallet /></el-icon>
                  <span>提现记录</span>
                </div>
                <el-table :data="pagedWithdrawRecords">
                  <el-table-column label="提现金额" min-width="120">
                    <template #default="{ row }">￥{{ row.amount.toFixed(2) }}</template>
                  </el-table-column>
                  <el-table-column label="状态" min-width="120">
                    <template #default="{ row }">
                      <el-tag :type="row.status === '已完成' ? 'success' : 'warning'">{{ row.status }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="bankAccount" label="提现账户" min-width="200" />
                  <el-table-column prop="time" label="申请时间" min-width="180" />
                </el-table>

                <div v-if="totalPages > 1" class="finance-pagination">
                  <div class="finance-total">共 {{ withdrawRecords.length }} 条记录</div>
                  <div class="finance-page-actions">
                    <el-button size="small" :disabled="currentPage === 1" @click="currentPage -= 1">上一页</el-button>
                    <span>{{ currentPage }} / {{ totalPages }}</span>
                    <el-button size="small" :disabled="currentPage === totalPages" @click="currentPage += 1">下一页</el-button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </section>
      </div>
    </div>

    <el-dialog
      v-model="avatarDialogVisible"
      title="修改头像"
      width="420px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
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

    <el-dialog
      v-model="emailDialogVisible"
      title="修改邮箱"
      width="460px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form :model="emailForm" label-width="92px">
        <el-form-item label="新邮箱">
          <el-input v-model="emailForm.email" />
        </el-form-item>
        <el-form-item label="验证码">
          <div class="code-row">
            <el-input v-model="emailForm.emailCode" placeholder="请输入验证码" />
            <el-button :disabled="emailCountdown > 0" @click="sendEmailCode">
              {{ emailCountdown > 0 ? `${emailCountdown}s` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="emailDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changeEmail">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="mobileDialogVisible"
      title="修改手机号"
      width="460px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form :model="mobileForm" label-width="92px">
        <el-form-item label="新手机号">
          <el-input v-model="mobileForm.mobile" />
        </el-form-item>
        <el-form-item label="验证码">
          <div class="code-row">
            <el-input v-model="mobileForm.mobileCode" placeholder="请输入验证码" />
            <el-button :disabled="mobileCountdown > 0" @click="sendMobileCode">
              {{ mobileCountdown > 0 ? `${mobileCountdown}s` : '获取验证码' }}
            </el-button>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="mobileDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changeMobile">确认修改</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="withdrawDialogVisible"
      title="申请提现"
      width="420px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="92px">
        <el-form-item label="提现金额">
          <el-input v-model="withdrawForm.amount" type="number" placeholder="请输入提现金额" />
        </el-form-item>
        <el-form-item label="提现方式">
          <div class="withdraw-account">{{ profile.bankName || '未配置收款信息' }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="withdrawDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleWithdraw">确认提现</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="passwordDialogVisible"
      title="修改密码"
      width="420px"
      transition="none"
      :lock-scroll="false"
      destroy-on-close
      append-to-body
    >
      <el-form :model="pwdForm" label-width="92px">
        <el-form-item label="原密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="changePassword">确认修改</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.profile-main-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.profile-head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.profile-main-body {
  overflow: auto;
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
  box-shadow: none;
}

.avatar-icon {
  display: grid;
  place-items: center;
  background: #eff6ff;
  color: #2563eb;
  font-size: 32px;
  border: 1px solid #dbeafe;
  box-shadow: none;
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
  box-shadow: none;
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

.info-item div:last-child {
  font-size: 14px;
  color: #111827;
}

.info-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.info-item-head label {
  margin-bottom: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.span-2 {
  grid-column: 1 / -1;
}

.finance-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.finance-card {
  padding: 18px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  color: #303133;
  background: #fff;
  box-shadow: none;
}

.finance-card.balance {
  border-left: 3px solid #2563eb;
}

.finance-card.income {
  border-left: 3px solid #16a34a;
}

.finance-card-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  margin-bottom: 12px;
}

.finance-card-icon .el-icon {
  font-size: 24px;
}

.finance-label {
  font-size: 14px;
  color: #606266;
}

.finance-value {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 700;
  color: #2563eb;
}

.finance-note {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
  font-size: 12px;
  line-height: 1.6;
  color: #909399;
}

.finance-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.finance-pagination {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
}

.finance-total,
.finance-page-actions {
  font-size: 14px;
  color: #6b7280;
}

.finance-page-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.code-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 10px;
}

.withdraw-account {
  width: 100%;
  padding: 10px 12px;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
}

.avatar-upload :deep(.el-upload--picture-card) {
  display: inline-flex;
}

.avatar-upload :deep(.el-upload-list--picture-card) {
  display: inline-flex;
  gap: 0;
}

.avatar-upload.has-file :deep(.el-upload--picture-card) {
  display: none;
}

@media (max-width: 980px) {
  .finance-cards,
  .info-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}

@media (max-width: 720px) {
  .hero-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .profile-main-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .finance-card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
  }

  .finance-card-icon {
    flex: 0 0 40px;
    width: 40px;
    height: 40px;
    margin-bottom: 0;
  }

  .finance-card-icon .el-icon {
    font-size: 20px;
  }

  .finance-card-copy {
    min-width: 0;
    flex: 1;
  }

  .finance-value {
    font-size: 22px;
  }

  .finance-note {
    margin-top: 8px;
    padding-top: 8px;
  }

  .finance-pagination {
    flex-direction: column;
    align-items: flex-start;
  }

  .code-row {
    grid-template-columns: 1fr;
  }
}
</style>
