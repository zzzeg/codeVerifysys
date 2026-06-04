<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { publicRequest } from '../utils/request'
import type { ApiResp } from '../utils/request'
import { useAuthStore } from '../store/auth'
import illustration from '../assets/login-illustration.svg'

interface LoginResult {
  token: string
  user: {
    id: string
    username: string
    roles: string[]
    permissions: string[]
  }
}

type Mode = 'login' | 'register' | 'forgot'

const router = useRouter()
const auth = useAuthStore()
const mode = ref<Mode>('login')
const registerFormRef = ref<FormInstance>()
const forgotFormRef = ref<FormInstance>()
const text = ref('')
const originalText = 'VerifySys'
const speed = 100
let index = 0

const loginForm = reactive({
  username: '',
  password: '',
  remember: false,
  loading: false,
})

const registerForm = reactive({
  username: '',
  email: '',
  emailCode: '',
  password: '',
  confirmPassword: '',
  loading: false,
})

const forgotForm = reactive({
  email: '',
  emailCode: '',
  newPassword: '',
  confirmPassword: '',
  loading: false,
})

const validateRegisterPasswordConfirm = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (value !== registerForm.password) {
    callback(new Error('两次密码不一致'))
    return
  }
  callback()
}

const validateForgotPasswordConfirm = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (value !== forgotForm.newPassword) {
    callback(new Error('两次密码不一致'))
    return
  }
  callback()
}

const registerRules: FormRules<typeof registerForm> = {
  username: [{ required: true, whitespace: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, whitespace: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  emailCode: [{ required: true, whitespace: true, message: '请输入邮箱验证码', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  confirmPassword: [{ validator: validateRegisterPasswordConfirm, trigger: 'blur' }],
}

const forgotRules: FormRules<typeof forgotForm> = {
  email: [
    { required: true, whitespace: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
  ],
  emailCode: [{ required: true, whitespace: true, message: '请输入邮箱验证码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  confirmPassword: [{ validator: validateForgotPasswordConfirm, trigger: 'blur' }],
}

const typeWriter = () => {
  if (index < originalText.length) {
    text.value += originalText.charAt(index)
    index += 1
    setTimeout(typeWriter, speed)
  }
}

const getRedirectTarget = () => {
  const currentRoute = router.currentRoute.value
  const q = currentRoute.query.redirect
  const fromQuery = typeof q === 'string' ? q : ''
  const fromStorage = sessionStorage.getItem('redirectAfterLogin') || ''
  const target = fromQuery || fromStorage || '/codes/list'
  sessionStorage.removeItem('redirectAfterLogin')
  if (!target.startsWith('/') || target.startsWith('/login')) return '/codes/list'
  return target
}

const handleLogin = async () => {
  if (loginForm.loading) return
  loginForm.loading = true
  try {
    const resp = await publicRequest.post<ApiResp<LoginResult>>('/api/auth/login', {
      username: loginForm.username,
      password: loginForm.password,
      remember: loginForm.remember,
    })
    if (resp.data.code === 200) {
      auth.setAuth(resp.data.data)
      ElMessage.success('登录成功')
      router.replace(getRedirectTarget())
    } else {
      ElMessage.error(resp.data.message)
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '登录失败')
  } finally {
    loginForm.loading = false
  }
}

const handleForgotPasswordDisabled = () => {
  ElMessage.info('找回密码功能暂不可用，请联系管理员处理')
}

const countdown = reactive({
  register: 0,
  reset: 0,
})

let timer: number | undefined

const startCountdown = (key: 'register' | 'reset', seconds: number) => {
  countdown[key] = seconds
  if (timer) window.clearInterval(timer)
  timer = window.setInterval(() => {
    const next = Math.max((countdown[key] || 0) - 1, 0)
    countdown[key] = next
    if (next <= 0 && timer) {
      window.clearInterval(timer)
      timer = undefined
    }
  }, 1000)
}

const sendEmailCode = async (purpose: 'register' | 'reset') => {
  const targetFormRef = purpose === 'register' ? registerFormRef : forgotFormRef
  const valid = await targetFormRef.value?.validateField('email').catch(() => false)
  if (!valid) return
  const email = purpose === 'register' ? registerForm.email : forgotForm.email

  try {
    const resp = await publicRequest.post<ApiResp<{ expireAt: number; debugCode?: string }>>('/api/auth/email-code', {
      email,
      purpose,
    })
    if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '发送失败')

    ElMessage.success(
      resp.data.data.debugCode
        ? `验证码已发送（开发码：${resp.data.data.debugCode}）`
        : '验证码已发送',
    )
    if (resp.data.data.debugCode) {
      if (purpose === 'register') registerForm.emailCode = resp.data.data.debugCode
      else forgotForm.emailCode = resp.data.data.debugCode
    }
    startCountdown(purpose, 60)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '发送失败')
  }
}

const handleRegister = async () => {
  if (registerForm.loading) return
  const valid = await registerFormRef.value?.validate().catch(() => false)
  if (!valid) return

  registerForm.loading = true
  try {
    const resp = await publicRequest.post<ApiResp<{ id: string }>>('/api/auth/register', {
      username: registerForm.username,
      email: registerForm.email,
      emailCode: registerForm.emailCode,
      password: registerForm.password,
    })
    if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '注册失败')

    ElMessage.success('注册成功，正在登录...')
    const loginResp = await publicRequest.post<ApiResp<LoginResult>>('/api/auth/login', {
      username: registerForm.username,
      password: registerForm.password,
      remember: true,
    })
    auth.setAuth(loginResp.data.data)
    router.replace(getRedirectTarget())
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '注册失败')
  } finally {
    registerForm.loading = false
  }
}

const handleResetPassword = async () => {
  if (forgotForm.loading) return
  const valid = await forgotFormRef.value?.validate().catch(() => false)
  if (!valid) return

  forgotForm.loading = true
  try {
    const resp = await publicRequest.post<ApiResp<any>>('/api/auth/reset-password', {
      email: forgotForm.email,
      emailCode: forgotForm.emailCode,
      newPassword: forgotForm.newPassword,
    })
    if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '重置失败')

    ElMessage.success('密码已重置，请重新登录')
    mode.value = 'login'
    loginForm.username = ''
    loginForm.password = ''
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '重置失败')
  } finally {
    forgotForm.loading = false
  }
}

onMounted(() => {
  typeWriter()
})

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="login-page">
    <div class="wrap">
      <section class="login-shell">
        <div class="showcase">
          <div class="showcase-badge">License Management Console</div>
          <h1 class="showcase-title">
            <span class="title-line">{{ text }}</span>
          </h1>
          <p class="showcase-copy">
            统一账户入口，保留现有认证流程。
          </p>

          <div class="illustration-panel">
            <img class="illustration" :src="illustration" alt="illustration" />
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div class="brand">
              <div class="logo">
                <img src="/favicon-verify-v.svg" alt="VerifySys" />
              </div>
              <div>
                <div class="brand-title">瑞云网络验证</div>
              </div>
            </div>
            <div class="panel-tip">Secure / Clear / Consistent</div>
          </div>

          <div class="card">
            <div class="card-heading">
              <p>继续使用现有账户体系和认证流程</p>
            </div>

            <el-form v-if="mode === 'login'" :model="loginForm" class="form" @submit.prevent="handleLogin">
              <el-form-item>
                <el-input v-model="loginForm.username" placeholder="用户名" autocomplete="username" />
              </el-form-item>
              <el-form-item>
                <el-input v-model="loginForm.password" placeholder="密码" type="password" show-password
                  autocomplete="current-password" />
              </el-form-item>

              <div class="row">
                <el-checkbox v-model="loginForm.remember" label="7天内免登录" />
                <a class="link link-disabled" @click.prevent="handleForgotPasswordDisabled">忘记密码？</a>
              </div>

              <el-button class="primary" native-type="submit" :loading="loginForm.loading"
                @click="handleLogin">登录</el-button>

              <div class="sub-actions">
                <el-button class="sub" text plain @click="mode = 'register'">注册</el-button>
              </div>
            </el-form>

            <el-form v-else-if="mode === 'register'" ref="registerFormRef" :model="registerForm" :rules="registerRules" class="form"
              @submit.prevent="handleRegister">
              <el-form-item prop="username">
                <el-input v-model="registerForm.username" placeholder="用户名(3-32)" autocomplete="username" />
              </el-form-item>
              <el-form-item prop="email">
                <el-input v-model="registerForm.email" placeholder="邮箱" autocomplete="email" />
              </el-form-item>
              <el-form-item prop="emailCode">
                <div class="code-row">
                  <el-input v-model="registerForm.emailCode" placeholder="邮箱验证码" />
                  <el-button class="code-btn" :disabled="countdown.register > 0" @click="sendEmailCode('register')">
                    {{ countdown.register > 0 ? `${countdown.register}s` : '获取验证码' }}
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item prop="password">
                <el-input v-model="registerForm.password" placeholder="密码(6-64)" type="password" show-password
                  autocomplete="new-password" />
              </el-form-item>
              <el-form-item prop="confirmPassword">
                <el-input v-model="registerForm.confirmPassword" placeholder="确认密码" type="password" show-password
                  autocomplete="new-password" />
              </el-form-item>

              <el-button class="primary" native-type="submit" :loading="registerForm.loading"
                @click="handleRegister">注册并登录</el-button>

              <div class="row row-center">
                <span class="muted">已有账号？</span>
                <a class="link" @click.prevent="mode = 'login'">返回登录</a>
              </div>
            </el-form>

            <el-form v-else ref="forgotFormRef" :model="forgotForm" :rules="forgotRules" class="form" @submit.prevent="handleResetPassword">
              <el-form-item prop="email">
                <el-input v-model="forgotForm.email" placeholder="邮箱" autocomplete="email" />
              </el-form-item>
              <el-form-item prop="emailCode">
                <div class="code-row">
                  <el-input v-model="forgotForm.emailCode" placeholder="邮箱验证码" />
                  <el-button class="code-btn" :disabled="countdown.reset > 0" @click="sendEmailCode('reset')">
                    {{ countdown.reset > 0 ? `${countdown.reset}s` : '获取验证码' }}
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item prop="newPassword">
                <el-input v-model="forgotForm.newPassword" placeholder="新密码(6-64)" type="password" show-password
                  autocomplete="new-password" />
              </el-form-item>
              <el-form-item prop="confirmPassword">
                <el-input v-model="forgotForm.confirmPassword" placeholder="确认新密码" type="password" show-password
                  autocomplete="new-password" />
              </el-form-item>

              <el-button class="primary" native-type="submit" :loading="forgotForm.loading"
                @click="handleResetPassword">重置密码</el-button>

              <div class="row row-center">
                <a class="link" @click.prevent="mode = 'login'">返回登录</a>
              </div>
            </el-form>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: #f0f2f5;
}

.wrap {
  position: relative;
  z-index: 1;
  width: min(1280px, calc(100% - 40px));
  min-height: 100vh;
  margin: 0 auto;
  padding: 28px 0;
  display: flex;
  align-items: center;
}

.login-shell {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 440px;
  gap: 24px;
  padding: 24px;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.showcase {
  padding: 10px 12px;
}

.showcase-badge {
  display: inline-flex;
  padding: 6px 10px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;
}

.showcase-title {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 18px 0 0;
  color: #172033;
}

.title-line {
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1;
  letter-spacing: 0;
  font-weight: 800;
}

.title-sub {
  font-size: 18px;
  line-height: 1.3;
  color: #39506e;
  font-weight: 600;
}

.showcase-copy {
  max-width: 620px;
  margin: 12px 0 0;
  font-size: 14px;
  line-height: 1.65;
  color: #607089;
}

.showcase-metrics {
  margin-top: 18px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  padding: 14px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid #ebeef5;
}

.metric-card strong {
  display: block;
  font-size: 20px;
  line-height: 1;
  color: #1748cf;
}

.metric-card span {
  display: block;
  margin-top: 6px;
  color: #607089;
  font-size: 12px;
  font-weight: 600;
}

.illustration-panel {
  margin-top: 18px;
  padding: 12px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #ebeef5;
}

.illustration {
  display: block;
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  filter: drop-shadow(0 16px 36px rgba(15, 23, 42, 0.12));
}

.panel {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 8px;
  justify-content: center;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.logo {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  background: transparent;
  border: none;
  overflow: hidden;
  box-shadow: 0 10px 18px rgba(64, 158, 255, 0.28);
}

.logo img {
  width: 100%;
  height: 100%;
  display: block;
}

.drop {
  width: 22px;
  height: 22px;
  display: inline-block;
  border-radius: 4px;
  transform: none;
  background: #2563eb;
}

.brand-title {
  font-size: 25px;
  color: #172033;
}

.panel-tip {
  padding: 6px 10px;
  border-radius: 4px;
  background: #f8fafc;
  border: 1px solid #ebeef5;
  color: #607089;
  font-size: 12px;
  font-weight: 700;
}

.card {
  padding: 22px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #ebeef5;
}

.card-heading h2 {
  margin: 0;
  font-size: 24px;
  color: #172033;
}

.card-heading p {
  margin: 8px 0 0;
  color: #7a8aa2;
  font-size: 13px;
}

.form {
  margin-top: 22px;
}

.primary {
  width: 100%;
  height: 40px;
  border: 0;
  border-radius: 4px;
  background: #2563eb;
  color: #fff;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -2px 0 14px;
}

.row-center {
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
}

.muted {
  color: #7a8aa2;
  font-size: 12px;
}

.link {
  color: #1748cf;
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}

.link-disabled {
  color: #9aa8bd;
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}

.sub-actions {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.sub {
  width: 140px;
  height: 38px;
  border-radius: 4px;
}

.code-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 128px;
  gap: 10px;
}

.code-btn {
  height: 40px;
  border-radius: 4px;
}

:deep(.el-form-item) {
  margin-bottom: 16px;
}

:deep(.el-input__wrapper) {
  min-height: 40px;
  border-radius: 4px;
  background: #fff;
  padding: 0 12px;
}

:deep(.el-input__inner),
:deep(.el-textarea__inner) {
  background: transparent !important;
}

:deep(input:-webkit-autofill),
:deep(input:-webkit-autofill:hover),
:deep(input:-webkit-autofill:focus) {
  -webkit-text-fill-color: #172033;
  -webkit-box-shadow: 0 0 0 1000px #fff inset;
  transition: background-color 9999s ease-out 0s;
}

:deep(.el-checkbox__label) {
  color: #607089;
}

@media (max-width: 1120px) {
  .wrap {
    width: min(860px, calc(100% - 28px));
    padding: 20px 0 28px;
  }

  .login-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .login-shell {
    padding: 20px;
  }

  .showcase,
  .panel,
  .card {
    padding: 0;
  }

  .card {
    margin-top: 8px;
    padding-top: 20px;
  }

  .showcase-metrics {
    grid-template-columns: 1fr;
  }

  .panel-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .code-row {
    grid-template-columns: 1fr;
  }
}

.login-page {
  background: #f0f2f5;
}

.ambient {
  display: none;
}

.wrap {
  width: min(1080px, calc(100% - 40px));
  padding: 28px 0;
}

.login-shell {
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 0;
  padding: 0;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.08);
}

.showcase {
  min-height: 520px;
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background:
    linear-gradient(180deg, rgba(236, 245, 255, 0.84), rgba(255, 255, 255, 0.96)),
    #f8fafc;
}

.showcase-badge {
  width: fit-content;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  background: #ecf5ff;
  color: #2563eb;
  letter-spacing: 0;
}

.title-line {
  font-size: 42px;
  line-height: 1.05;
  letter-spacing: 0;
}

.showcase-copy {
  color: #606266;
}

.illustration-panel {
  max-width: 520px;
  margin-top: 28px;
  padding: 18px;
  border-radius: 8px;
  background: #fff;
  border-color: #ebeef5;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
}

.illustration {
  max-height: 240px;
  filter: none;
}

.panel {
  padding: 32px;
  border-left: 1px solid #ebeef5;
  background: #fff;
}

.panel-header {
  margin-bottom: 18px;
}

.logo {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: transparent;
}

.drop {
  width: 18px;
  height: 18px;
  background: #2563eb;
}

.brand-title {
  font-size: 20px;
  font-weight: 700;
}

.brand-subtitle {
  color: #909399;
}

.panel-tip {
  display: none;
}

.card {
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
}

.card-heading h2 {
  font-size: 22px;
}

.card-heading p {
  color: #909399;
}

.primary {
  height: 38px;
  border-radius: 4px;
  background: #2563eb;
}

.sub {
  height: 34px;
  border-radius: 4px;
}

.code-btn {
  height: 36px;
  border-radius: 4px;
}

:deep(.el-input__wrapper) {
  min-height: 36px;
  border-radius: 4px;
  padding: 0 12px;
}

@media (max-width: 1120px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .panel {
    border-left: none;
    border-top: 1px solid #ebeef5;
  }

  .showcase {
    min-height: auto;
    padding: 32px;
  }
}

@media (max-width: 720px) {
  .login-page {
    background:
      linear-gradient(180deg, rgba(236, 245, 255, 0.84), rgba(255, 255, 255, 0.96)),
      #f8fafc;
  }

  .showcase {
    display: none;
  }

  .wrap {
    width: min(100% - 40px, 460px);
  }


  .showcase {
    padding: 24px;
  }

  .panel {
    padding: 24px;
    border-top: none;
  }

  .title-line {
    font-size: 30px;
  }
}
</style>
