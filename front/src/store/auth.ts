import { defineStore } from 'pinia'
import { ref } from 'vue'
import request from '../utils/request'
import type { ApiResp } from '../utils/request'

interface LoginResp {
  token: string
  user: {
    id: string
    username: string
    roles: string[]
    permissions: string[]
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const currentUser = ref<LoginResp['user'] | null>(null)

  const setAuth = (payload: LoginResp) => {
    token.value = payload.token
    currentUser.value = payload.user
    localStorage.setItem('token', payload.token)
  }

  const logout = () => {
    token.value = ''
    currentUser.value = null
    localStorage.removeItem('token')
  }

  const fetchProfile = async () => {
    if (!token.value) return
    const resp = await request.get<ApiResp<any>>('/api/profile')
    if (resp.data.code === 200) {
      currentUser.value = {
        id: resp.data.data.id,
        username: resp.data.data.username,
        roles: resp.data.data.roleIds || [],
        permissions: resp.data.data.permissions || [],
      }
    }
  }

  return { token, currentUser, setAuth, logout, fetchProfile }
})
