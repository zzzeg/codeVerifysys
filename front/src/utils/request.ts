import axios from 'axios'
import { useAuthStore } from '../store/auth'

export interface ApiResp<T> {
  code: number
  message: string
  data: T
  timestamp: number
}

const REDIRECT_KEY = 'redirectAfterLogin'

const getCurrentFullPath = () => window.location.pathname + window.location.search + window.location.hash

const redirectToLogin = () => {
  const current = getCurrentFullPath()
  if (!current.startsWith('/login')) {
    sessionStorage.setItem(REDIRECT_KEY, current)
    window.location.href = `/login?redirect=${encodeURIComponent(current)}`
  }
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3000',
  timeout: 15000,
})

export const publicRequest = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:3000',
  timeout: 15000,
})

instance.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${auth.token}`
  }
  return config
})

instance.interceptors.response.use(
  (resp) => {
    const auth = useAuthStore()
    const apiCode = resp?.data?.code
    if (apiCode === 401) {
      auth.logout()
      redirectToLogin()
    }
    return resp
  },
  (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore()
      auth.logout()
      redirectToLogin()
    }
    return Promise.reject(error)
  },
)

export default instance
