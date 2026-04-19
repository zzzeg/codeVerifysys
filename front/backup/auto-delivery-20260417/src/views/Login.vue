<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../utils/request'
import type { ApiResp } from '../utils/request'
import { useAuthStore } from '../store/auth'
import illustration from '../assets/login-illustration.svg'

interface LoginResult {
  token: string
  user: {
    id: string
    username: string
    roles: string[]
  }
}

type Mode = 'login' | 'register' | 'forgot'

const router = useRouter()
const auth = useAuthStore()
const mode = ref<Mode>('login')
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

const title = computed(() => (mode.value === 'login' ? '登录' : mode.value === 'register' ? '注册' : '找回密码'))

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
  const target = fromQuery || fromStorage || '/dashboard'
  sessionStorage.removeItem('redirectAfterLogin')
  if (!target.startsWith('/') || target.startsWith('/login')) return '/dashboard'
  return target
}

const handleLogin = async () => {
  loginForm.loading = true
  try {
    const resp = await request.post<ApiResp<LoginResult>>('/api/auth/login', {
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
  const email = purpose === 'register' ? registerForm.email : forgotForm.email
  if (!email.trim()) return ElMessage.warning('请输入邮箱')

  try {
    const resp = await request.post<ApiResp<{ expireAt: number; debugCode?: string }>>(
      '/api/auth/email-code',
      { email, purpose },
    )
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
  if (!registerForm.username.trim()) return ElMessage.warning('请输入用户名')
  if (!registerForm.email.trim()) return ElMessage.warning('请输入邮箱')
  if (!registerForm.emailCode.trim()) return ElMessage.warning('请输入邮箱验证码')
  if (!registerForm.password) return ElMessage.warning('请输入密码')
  if (registerForm.password !== registerForm.confirmPassword) return ElMessage.warning('两次密码不一致')

  registerForm.loading = true
  try {
    const resp = await request.post<ApiResp<{ id: string }>>('/api/auth/register', {
      username: registerForm.username,
      email: registerForm.email,
      emailCode: registerForm.emailCode,
      password: registerForm.password,
    })
    if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '注册失败')

    ElMessage.success('注册成功，正在登录...')
    const loginResp = await request.post<ApiResp<LoginResult>>('/api/auth/login', {
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
  if (!forgotForm.email.trim()) return ElMessage.warning('请输入邮箱')
  if (!forgotForm.emailCode.trim()) return ElMessage.warning('请输入邮箱验证码')
  if (!forgotForm.newPassword) return ElMessage.warning('请输入新密码')
  if (forgotForm.newPassword !== forgotForm.confirmPassword) return ElMessage.warning('两次密码不一致')

  forgotForm.loading = true
  try {
    const resp = await request.post<ApiResp<any>>('/api/auth/reset-password', {
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
    <div class="ambient ambient-left" />
    <div class="ambient ambient-right" />

    <div class="wrap">
      <section class="showcase">
        <div class="showcase-badge">License Management Console</div>
        <h1 class="showcase-title">
          <span class="title-line">{{ text }}</span>
          <span class="title-sub">统一管理注册码、项目和安全策略</span>
        </h1>
        <p class="showcase-copy">
          参考 Figma Make 的现代后台风格，界面采用轻玻璃质感、柔和高光和统一圆角体系，保留现有
          Element Plus 交互逻辑。
        </p>

        <div class="showcase-metrics">
          <div class="metric-card">
            <strong>01</strong>
            <span>Unified Access</span>
          </div>
          <div class="metric-card">
            <strong>02</strong>
            <span>Project Driven</span>
          </div>
          <div class="metric-card">
            <strong>03</strong>
            <span>Risk Visibility</span>
          </div>
        </div>

        <div class="illustration-panel">
          <img class="illustration" :src="illustration" alt="illustration" />
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div class="brand">
            <div class="logo"><span class="drop" /></div>
            <div>
              <div class="brand-title">VerifySys</div>
              <div class="brand-subtitle">{{ title }}</div>
            </div>
          </div>
          <div class="panel-tip">Secure · Clear · Consistent</div>
        </div>

        <div class="card">
          <div class="card-heading">
            <h2>{{ title }}</h2>
            <p>继续使用现有账号体系和认证流程</p>
          </div>

          <el-form v-if="mode === 'login'" :model="loginForm" class="form" @keyup.enter="handleLogin">
            <el-form-item>
              <el-input v-model="loginForm.username" placeholder="用户名" autocomplete="username" />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="loginForm.password"
                placeholder="密码"
                type="password"
                show-password
                autocomplete="current-password"
              />
            </el-form-item>

            <div class="row">
              <el-checkbox v-model="loginForm.remember" label="7天内免登录" />
              <a class="link" @click.prevent="mode = 'forgot'">忘记密码？</a>
            </div>

            <el-button class="primary" :loading="loginForm.loading" @click="handleLogin">登录</el-button>

            <div class="sub-actions">
              <el-button class="sub" plain @click="mode = 'register'">注册</el-button>
            </div>

            <div class="divider"><span>第三方登录</span></div>
            <div class="oauth-icons">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
          </el-form>

          <el-form v-else-if="mode === 'register'" :model="registerForm" class="form" @keyup.enter="handleRegister">
            <el-form-item>
              <el-input v-model="registerForm.username" placeholder="用户名(3-32)" autocomplete="username" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="registerForm.email" placeholder="邮箱" autocomplete="email" />
            </el-form-item>
            <el-form-item>
              <div class="code-row">
                <el-input v-model="registerForm.emailCode" placeholder="邮箱验证码" />
                <el-button class="code-btn" :disabled="countdown.register > 0" @click="sendEmailCode('register')">
                  {{ countdown.register > 0 ? `${countdown.register}s` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="registerForm.password"
                placeholder="密码(6-64)"
                type="password"
                show-password
                autocomplete="new-password"
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="registerForm.confirmPassword"
                placeholder="确认密码"
                type="password"
                show-password
                autocomplete="new-password"
              />
            </el-form-item>

            <el-button class="primary" :loading="registerForm.loading" @click="handleRegister">注册并登录</el-button>

            <div class="row row-center">
              <span class="muted">已有账号？</span>
              <a class="link" @click.prevent="mode = 'login'">返回登录</a>
            </div>
          </el-form>

          <el-form v-else :model="forgotForm" class="form" @keyup.enter="handleResetPassword">
            <el-form-item>
              <el-input v-model="forgotForm.email" placeholder="邮箱" autocomplete="email" />
            </el-form-item>
            <el-form-item>
              <div class="code-row">
                <el-input v-model="forgotForm.emailCode" placeholder="邮箱验证码" />
                <el-button class="code-btn" :disabled="countdown.reset > 0" @click="sendEmailCode('reset')">
                  {{ countdown.reset > 0 ? `${countdown.reset}s` : '获取验证码' }}
                </el-button>
              </div>
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="forgotForm.newPassword"
                placeholder="新密码(6-64)"
                type="password"
                show-password
                autocomplete="new-password"
              />
            </el-form-item>
            <el-form-item>
              <el-input
                v-model="forgotForm.confirmPassword"
                placeholder="确认新密码"
                type="password"
                show-password
                autocomplete="new-password"
              />
            </el-form-item>

            <el-button class="primary" :loading="forgotForm.loading" @click="handleResetPassword">重置密码</el-button>

            <div class="row row-center">
              <a class="link" @click.prevent="mode = 'login'">返回登录</a>
            </div>
          </el-form>
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
  background:
    radial-gradient(circle at top left, rgba(47, 107, 255, 0.2), transparent 30%),
    radial-gradient(circle at bottom right, rgba(45, 212, 191, 0.18), transparent 28%),
    linear-gradient(135deg, #edf4ff 0%, #f7fbff 44%, #eef4fb 100%);
}

.ambient {
  position: absolute;
  border-radius: 50%;
  filter: blur(12px);
}

.ambient-left {
  width: 520px;
  height: 520px;
  left: -180px;
  top: 80px;
  background: rgba(47, 107, 255, 0.14);
}

.ambient-right {
  width: 420px;
  height: 420px;
  right: -120px;
  bottom: -100px;
  background: rgba(56, 189, 248, 0.12);
}

.wrap {
  position: relative;
  z-index: 1;
  width: min(1280px, calc(100% - 40px));
  min-height: 100vh;
  margin: 0 auto;
  padding: 32px 0;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) 440px;
  gap: 24px;
  align-items: center;
}

.showcase,
.panel {
  border: 1px solid rgba(255, 255, 255, 0.64);
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.68);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
}

.showcase {
  padding: 40px;
}

.showcase-badge {
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(47, 107, 255, 0.1);
  color: #1748cf;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.showcase-title {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 24px 0 0;
  color: #172033;
}

.title-line {
  font-size: clamp(42px, 6vw, 68px);
  line-height: 0.96;
  letter-spacing: -0.05em;
  font-weight: 800;
}

.title-sub {
  font-size: 20px;
  line-height: 1.3;
  color: #39506e;
  font-weight: 600;
}

.showcase-copy {
  max-width: 620px;
  margin: 18px 0 0;
  font-size: 15px;
  line-height: 1.8;
  color: #607089;
}

.showcase-metrics {
  margin-top: 26px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  padding: 18px;
  border-radius: 22px;
  background: rgba(247, 250, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.metric-card strong {
  display: block;
  font-size: 24px;
  line-height: 1;
  color: #1748cf;
}

.metric-card span {
  display: block;
  margin-top: 10px;
  color: #607089;
  font-size: 13px;
  font-weight: 600;
}

.illustration-panel {
  margin-top: 26px;
  padding: 18px;
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(239, 246, 255, 0.88)),
    radial-gradient(circle at top right, rgba(47, 107, 255, 0.12), transparent 34%);
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.illustration {
  display: block;
  width: 100%;
  max-height: 420px;
  object-fit: contain;
  filter: drop-shadow(0 16px 36px rgba(15, 23, 42, 0.12));
}

.panel {
  padding: 24px;
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
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(47, 107, 255, 0.12), rgba(125, 211, 252, 0.18));
}

.drop {
  width: 22px;
  height: 22px;
  display: inline-block;
  border-radius: 0 50% 50% 50%;
  transform: rotate(45deg);
  background: linear-gradient(180deg, #2aa7ff, #2f6bff);
}

.brand-title {
  font-size: 24px;
  font-weight: 800;
  color: #172033;
}

.brand-subtitle {
  margin-top: 4px;
  color: #7a8aa2;
  font-size: 13px;
  font-weight: 600;
}

.panel-tip {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(247, 250, 255, 0.94);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: #607089;
  font-size: 12px;
  font-weight: 700;
}

.card {
  padding: 24px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.16);
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
  height: 46px;
  border: 0;
  border-radius: 16px;
  background: linear-gradient(135deg, #2f6bff, #5b8cff);
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

.sub-actions {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.sub {
  width: 140px;
  height: 42px;
  border-radius: 14px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 12px;
  color: #9aa8bd;
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(148, 163, 184, 0.24);
}

.oauth-icons {
  display: flex;
  justify-content: center;
  gap: 14px;
}

.dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(247, 250, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.18);
}

.code-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 128px;
  gap: 10px;
}

.code-btn {
  height: 46px;
  border-radius: 14px;
}

:deep(.el-form-item) {
  margin-bottom: 16px;
}

:deep(.el-input__wrapper) {
  min-height: 46px;
  border-radius: 16px;
  background: rgba(248, 251, 255, 0.94);
}

:deep(.el-checkbox__label) {
  color: #607089;
}

@media (max-width: 1120px) {
  .wrap {
    grid-template-columns: 1fr;
    width: min(860px, calc(100% - 28px));
    padding: 20px 0 28px;
  }

  .showcase {
    order: 2;
  }
}

@media (max-width: 720px) {
  .showcase,
  .panel {
    padding: 20px;
    border-radius: 24px;
  }

  .card {
    padding: 20px;
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
</style>
