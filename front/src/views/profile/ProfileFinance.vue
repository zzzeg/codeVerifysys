<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Money, Wallet } from '@element-plus/icons-vue'
import request from '../../utils/request'

type WithdrawRecord = {
  id: string
  amount: number
  status: string
  bankAccount: string
  createdAt: number
}

const withdrawDialogVisible = ref(false)
const withdrawFormRef = ref<FormInstance>()
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)

const profile = reactive({
  bankName: '支付宝',
  balance: 0,
  currentIncome: 0,
})

const withdrawForm = reactive({ amount: '' })

const validateWithdrawAmount = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  const amount = Number(value)
  if (!amount || amount <= 0) {
    callback(new Error('请输入提现金额'))
    return
  }
  callback()
}

const withdrawRules: FormRules<typeof withdrawForm> = {
  amount: [{ validator: validateWithdrawAmount, trigger: 'blur' }],
}

const withdrawRecords = ref<WithdrawRecord[]>([])

const statusTextMap: Record<string, string> = {
  processing: '处理中',
  completed: '已完成',
  rejected: '已驳回',
}

const statusTypeMap: Record<string, 'success' | 'warning' | 'danger'> = {
  processing: 'warning',
  completed: 'success',
  rejected: 'danger',
}

const formatDateTime = (value?: number) => {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

const fetchFinance = async () => {
  const resp = await request.get('/api/profile/finance')
  Object.assign(profile, {
    bankName: resp.data.data?.bankName || '支付宝',
    balance: Number(resp.data.data?.balance || 0),
    currentIncome: Number(resp.data.data?.currentIncome || 0),
  })
}

const fetchWithdrawals = async () => {
  loading.value = true
  try {
    const resp = await request.get('/api/profile/withdrawals', {
      params: { page: currentPage.value, pageSize: pageSize.value },
    })
    const data = resp.data.data || {}
    withdrawRecords.value = data.list || []
    total.value = Number(data.total || 0)
    const maxPage = Math.max(1, Math.ceil(total.value / pageSize.value))
    if (currentPage.value > maxPage) {
      currentPage.value = maxPage
      await fetchWithdrawals()
    }
  } finally {
    loading.value = false
  }
}

const handlePageChange = (value: number) => {
  currentPage.value = value
  fetchWithdrawals()
}

const handleSizeChange = (value: number) => {
  pageSize.value = value
  currentPage.value = 1
  fetchWithdrawals()
}

const handleWithdraw = async () => {
  if (profile.balance < 200) return ElMessage.error('可提现余额不足200元，无法提现')
  const valid = await withdrawFormRef.value?.validate().catch(() => false)
  if (!valid) return
  try {
    await request.post('/api/profile/withdrawals', { amount: Number(withdrawForm.amount) })
    ElMessage.success('提现申请已提交，预计7个工作日内到账')
    withdrawDialogVisible.value = false
    withdrawForm.amount = ''
    currentPage.value = 1
    await Promise.all([fetchFinance(), fetchWithdrawals()])
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '提现申请失败')
  }
}

onMounted(async () => {
  await Promise.all([fetchFinance(), fetchWithdrawals()])
})
</script>

<template>
  <div>
    <div class="finance-cards">
      <div class="finance-card balance">
        <div class="finance-card-icon">
          <el-icon>
            <Wallet />
          </el-icon>
        </div>

        <div class="finance-card-copy">
          <div class="finance-label">账户余额</div>
          <div class="finance-value">￥{{ Number(profile.balance || 0).toFixed(2) }}</div>
        </div>
      </div>
      <div class="finance-card income">
        <div class="finance-card-icon">
          <el-icon>
            <Money />
          </el-icon>
        </div>
        <div class="finance-card-copy">
          <div class="finance-label">当前收入</div>
          <div class="finance-value">￥{{ Number(profile.currentIncome || 0).toFixed(2) }}</div>
        </div>
      </div>

    </div>


    <div class="finance-toolbar">
      <el-button type="primary" @click="withdrawDialogVisible = true">申请提现</el-button>
      <div class="finance-note">系统按周期自动结算，1元起结。</div>
    </div>


    <div class="profile-block">
      <div class="block-title">
        <el-icon>
          <Wallet />
        </el-icon>
        <span>提现记录</span>
      </div>
      <el-table :data="withdrawRecords" v-loading="loading">
        <el-table-column label="提现金额" min-width="120">
          <template #default="{ row }">￥{{ row.amount.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="状态" min-width="120">
          <template #default="{ row }">
            <el-tag :type="statusTypeMap[row.status] || 'warning'">{{ statusTextMap[row.status] || row.status
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="bankAccount" label="提现账户" min-width="200" />
        <el-table-column label="申请时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="pager">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[10, 20, 50, 100]"
          :total="total" layout="total, sizes, prev, pager, next, jumper" @current-change="handlePageChange"
          @size-change="handleSizeChange" />
      </div>
    </div>

    <el-dialog v-model="withdrawDialogVisible" title="申请提现" width="420px" destroy-on-close append-to-body>
      <el-form ref="withdrawFormRef" :model="withdrawForm" :rules="withdrawRules" label-width="92px">
        <el-form-item label="提现金额" prop="amount">
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
  </div>
</template>

<style scoped lang="scss">
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
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;

  .finance-card-copy {
    flex: 1
  }
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
}

.finance-label {
  font-size: 14px;
  color: #606266;
}

.finance-value {
  font-size: 28px;
  font-weight: 700;
  color: #2563eb;
}

.finance-note {
  font-size: 12px;
  line-height: 1.6;
  color: #909399;
}

.finance-toolbar {
  display: flex;
  justify-content: flex-start;
  align-items: flex-end;
  margin: 30px 0;
  gap: 12px;
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

.withdraw-account {
  width: 100%;
  padding: 10px 12px;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
}

@media (max-width: 640px) {
  .finance-cards {
    grid-template-columns: 1fr 1fr;
  }

  .finance-value {
    font-size: 16px;
  }

  .finance-card-icon {
    width: 30px;
    height: 30px;
  }

  .finance-card {
    padding: 8px;
    gap: 8px;
  }
}
</style>
