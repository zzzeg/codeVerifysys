<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { createNotification } from '../../api/notifications'
import type { NotificationPublishPayload } from '../../types/notification'

const formRef = ref<FormInstance>()
const submitting = ref(false)
const form = reactive<NotificationPublishPayload>({ title: '', content: '', category: 'system' })
const rules: FormRules<typeof form> = {
  title: [{ required: true, whitespace: true, message: '请输入标题', trigger: 'blur' }],
  content: [{ required: true, whitespace: true, message: '请输入内容', trigger: 'blur' }],
}

/**
 * 重置发布通知表单
 * @returns 无返回值，内部清空标题、内容并恢复默认通知类型
 */
const resetForm = () => {
  form.title = ''
  form.content = ''
  form.category = 'system'
  formRef.value?.clearValidate()
}

/**
 * 发布系统通知
 * @returns 无返回值，表单校验通过后提交通知并重置表单
 */
const publishNotification = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    // 1. 提交通知发布请求
    await createNotification(form)
    // 2. 提示用户发布成功
    ElMessage.success('通知已发布')
    // 3. 清空表单，便于继续发布下一条通知
    resetForm()
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <div class="notification-publish-page">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="auto" class="notification-publish-form">
      <el-form-item label="类型:">
        <el-select v-model="form.category" class="full-control">
          <el-option label="系统公告" value="system" />
          <el-option label="待办提醒" value="todo" />
          <el-option label="订单提醒" value="order" />
          <el-option label="结算提醒" value="settlement" />
        </el-select>
      </el-form-item>
      <el-form-item label="标题:" prop="title">
        <el-input v-model="form.title" maxlength="80" show-word-limit placeholder="请输入通知标题" />
      </el-form-item>
      <el-form-item label="内容:" prop="content">
        <el-input v-model="form.content" type="textarea" :rows="8" maxlength="1000" show-word-limit
          placeholder="请输入通知内容" />
      </el-form-item>
      <el-form-item label=" ">
        <div class="form-actions">
          <el-button type="primary" :loading="submitting" @click="publishNotification">发布</el-button>
          <el-button @click="resetForm">重置</el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.notification-publish-page {
  max-width: 720px;
}

.notification-publish-form {
  width: 100%;
}

.full-control {
  width: 100%;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
