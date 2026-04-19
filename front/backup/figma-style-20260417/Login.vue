<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref ,onMounted} from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../utils/request'
import type { ApiResp } from '../utils/request'
import { useAuthStore } from '../store/auth'
import illustration from '../assets/login-illustration.svg'

//打字机效果
const text = ref(""); // 要显示的文字
const speed = 100; // 打字速度，单位：毫秒
let index = 0;
const originalText =`VerifySys`;
const typeWriter = () => {
  if (index < originalText.length) {
    text.value += originalText.charAt(index);
    index++;
    setTimeout(typeWriter, speed);
  }
};
onMounted(() => {
  typeWriter(); // 调用打字机函数
});

interface LoginResult {
  token: string
  user: {
    id: string
    username: string
    roles: string[]
  }
}

type Mode = 'login' | 'register' | 'forgot'
const mode = ref<Mode>('login')

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

const router = useRouter()
const auth = useAuthStore()

const title = computed(() => (mode.value === 'login' ? '登录' : mode.value === 'register' ? '注册' : '找回密码'))

const getRedirectTarget = () => {
  const route = router.currentRoute.value
  const q = route.query.redirect
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

onBeforeUnmount(() => {
  if (timer) window.clearInterval(timer)
})

const sendEmailCode = async (purpose: 'register' | 'reset') => {
  const email = purpose === 'register' ? registerForm.email : forgotForm.email
  if (!email.trim()) return ElMessage.warning('请输入邮箱')

  try {
    const resp = await request.post<ApiResp<{ expireAt: number; debugCode?: string }>>('/api/auth/email-code', { email, purpose })
    if (resp.data.code !== 200) return ElMessage.error(resp.data.message || '发送失败')

    ElMessage.success(resp.data.data.debugCode ? `验证码已发送（开发码：${resp.data.data.debugCode}）` : '验证码已发送')
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

    ElMessage.success('密码已重置，请登录')
    mode.value = 'login'
    loginForm.username = ''
    loginForm.password = ''
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '重置失败')
  } finally {
    forgotForm.loading = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="wave" />

    <div class="wrap">
      <div class="left">
        <img class="illustration" :src="illustration" alt="illustration" />
      </div>

      <div class="right">
        <div class="brand">
          <div class="logo"><span class="drop" /></div>
          <div class="brand-name">
            <div class="titleunde"> {{ text }}</div> 
          </div>
          
        </div>

        <div class="card">
          <!-- <div class="card-title">{{ title }}</div> -->

          <el-form v-if="mode === 'login'" :model="loginForm" class="form" @keyup.enter="handleLogin">
            <el-form-item>
              <el-input v-model="loginForm.username" placeholder="用户名" autocomplete="username" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="loginForm.password" placeholder="密码" type="password" show-password autocomplete="current-password" />
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
              <el-input v-model="registerForm.password" placeholder="密码(6-64)" type="password" show-password autocomplete="new-password" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="registerForm.confirmPassword" placeholder="确认密码" type="password" show-password autocomplete="new-password" />
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
              <el-input v-model="forgotForm.newPassword" placeholder="新密码(6-64)" type="password" show-password autocomplete="new-password" />
            </el-form-item>
            <el-form-item>
              <el-input v-model="forgotForm.confirmPassword" placeholder="确认新密码" type="password" show-password autocomplete="new-password" />
            </el-form-item>

            <el-button class="primary" :loading="forgotForm.loading" @click="handleResetPassword">重置密码</el-button>

            <div class="row row-center">
              <a class="link" @click.prevent="mode = 'login'">返回登录</a>
            </div>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  background: #fff;
  position: relative;
  overflow: hidden;
  background-image:url(../assets/cvr30x6grykgmziqfc.jpg);
}

.wave {
  position: absolute;
  left: -260px;
  bottom: -360px;
  width: 1100px;
  height: 1100px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2f6bff, #2aa7ff);
  opacity: 0.85;
}

.wrap {
  position: relative;
  min-height: 100vh;
  width: 1200px;
  display: flex;
  align-items: center;
  margin:0 auto;
  box-sizing: border-box;
}

.left {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 520px;
  margin-left:-100px;
}

.illustration {
  width: min(760px, 100%);
  height: auto;
  filter: drop-shadow(0 16px 30px rgba(17, 24, 39, 0.12));
}

.right {
  display: flex;
  width:440px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #fff; 
  padding:  20px 20px; border-radius:10px;
  box-shadow: 0 0 0.625rem rgba(0, 0, 0, 0.1);
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(47, 107, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop {
  width: 22px;
  height: 22px;
  border-radius: 0 50% 50% 50%;
  transform: rotate(45deg);
  background: linear-gradient(180deg, #2aa7ff, #2f6bff);
  display: inline-block;
}

.brand-name {
  font-weight: 600;
  letter-spacing: 0.8px;
  color: #2f6bff;;
  font-size:30px;
}

.brand-name span {
  color: #2f6bff;
}

.card {
  width: 100%;
  max-width: 420px;
}

.card-title {
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  color:#0061fc;
  margin: 14px 0;
  
}
.titleunde{
    color:#0061fc;
    display: inline-block;
    position: relative;
    &::before{
      position: absolute;
      content: "";
      display: block;
          z-index: 4;
        width: 90%;
        height: 0.25rem;
        border-radius: 30rem;
        mix-blend-mode: normal;
        background: rgba(0, 119, 255, 0.3); bottom:2px;left:5%;
    }
  }
.form {
  width: 100%;
}

.primary {
  width: 100%;
  height: 42px;
  border: 0;
  color: #fff;
  background: linear-gradient(135deg, #2f6bff, #4b8bff);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: -4px 0 10px;
}

.row-center {
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
}

.muted {
  color: #6b7280;
  font-size: 12px;
}

.link {
  color: #2f6bff;
  cursor: pointer;
  font-size: 12px;
  text-decoration: none;
}

.sub-actions {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.sub {
  width: 120px;
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 14px 0 10px;
  color: #9ca3af;
  font-size: 12px;
}

.divider::before,
.divider::after {
  content: '';
  height: 1px;
  background: #e5e7eb;
  flex: 1;
}

.oauth-icons {
  display: flex;
  justify-content: center;
  gap: 14px;
}

.dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #d1d5db;
  background: #fff;
  display: inline-block;
}

.code-row {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 118px;
  gap: 10px;
}

.code-btn {
  height: 42px;
}

:deep(.el-input__wrapper) {
  border-radius: 4px;
  background: #e8f0fe;
}

:deep(.el-input__inner) {
  height: 42px;
}

:deep(.el-form-item) {
  margin-bottom: 14px;
}

@media (max-width: 960px) {
  .wrap {
    width: 100%;
    padding: 22px 16px;
  }
  .left {
    display: none;
  }
  .right {
    width: 100%;
  }
  .card {
    max-width: 460px;
  }
  .wave {
    left: -420px;
    bottom: -520px;
    width: 1200px;
    height: 1200px;
    opacity: 0;
  }
}
</style>
