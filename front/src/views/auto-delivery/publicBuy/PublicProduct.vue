<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { publicRequest } from '../../../utils/request'
import type { ApiResp } from '../../../utils/request'
import { useRoute } from 'vue-router'
import defaultProductCover from '../../../assets/default-cdk-product-220.svg'
import alipayLogo from '../../../assets/svg/Alipay_Chinese_logos.svg'
import wechatPayLogo from '../../../assets/svg/wechatpay_logos.svg'

interface VariantItem {
  id: string
  label: string
  price: number
  cardType: string
}

interface ProductItem {
  id: string
  name: string
  summary?: string
  description?: string
  coverUrl?: string
  allowAnonymous: boolean
  minBuy: number
  maxBuy: number
  variants: VariantItem[]
}

const route = useRoute()
const loading = ref(false)
const captchaSending = ref(false)
const paying = ref(false)
const product = ref<ProductItem | null>(null)
const selectedVariantId = ref('')
const orderResult = ref<{ orderId: string; cards: string[] } | null>(null)
const resultDialogVisible = ref(false)
const formRef = ref<FormInstance>()
const captchaImage = ref('')
const captchaId = ref('')
const captchaRequired = ref(false)
const loadError = ref('')
const captchaError = ref('')
let lastCaptchaRequestAt = 0
const form = reactive({
  quantity: 1,
  email: '',
  captchaCode: '',
  paymentMethod: 'alipay',
})

const selectedVariant = computed(() => product.value?.variants.find((item) => item.id === selectedVariantId.value) || null)
const totalAmount = computed(() => Number(selectedVariant.value?.price || 0) * Number(form.quantity || 1))
const canDownloadCards = computed(() => (orderResult.value?.cards.length || 0) >= 5)

const rules = computed<FormRules>(() => ({
  // quantity: [
  //   {
  //     validator: (_rule, value, callback) => {
  //       const minBuy = Number(product.value?.minBuy || 1)
  //       const maxBuy = Number(product.value?.maxBuy || 1)
  //       const quantity = Number(value)
  //       if (!Number.isFinite(quantity)) {
  //         callback(new Error('请输入有效的购买数量'))
  //         return
  //       }
  //       if (quantity < minBuy) {
  //         callback(new Error(`购买数量不能少于 ${minBuy}`))
  //         return
  //       }
  //       if (quantity > maxBuy) {
  //         callback(new Error(`购买数量不能超过 ${maxBuy}`))
  //         return
  //       }
  //       callback()
  //     },
  //     trigger: 'change',
  //   },
  // ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'change'] },
  ],
  captchaCode: captchaRequired.value
    ? [
        { required: true, message: '请输入验证码', trigger: 'blur' },
      ]
    : [],
}))

const fetchProduct = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const resp = await publicRequest.get<ApiResp<ProductItem>>(`/api/products/public/${route.params.code}`)
    product.value = resp.data.data
    selectedVariantId.value = product.value.variants[0]?.id || ''
    form.quantity = product.value.minBuy || 1
  } catch (err: any) {
    product.value = null
    loadError.value = err?.response?.data?.message || err?.message || '商品链接无效或商品已下架'
  } finally {
    loading.value = false
  }
}

const sendCaptcha = async () => {
  if (captchaSending.value) return
  const now = Date.now()
  if (now - lastCaptchaRequestAt < 1500) {
    captchaError.value = '操作太频繁，请稍后再试'
    return
  }
  lastCaptchaRequestAt = now
  captchaRequired.value = true
  captchaSending.value = true
  captchaError.value = ''
  try {
    const resp = await publicRequest.post<ApiResp<{ captchaId: string; image: string }>>(`/api/products/public/${route.params.code}/captcha`)
    captchaId.value = resp.data.data.captchaId
    captchaImage.value = resp.data.data.image
    form.captchaCode = ''
  } catch (err: any) {
    captchaId.value = ''
    captchaImage.value = ''
    captchaError.value = err?.response?.data?.message || err?.message || '验证码加载失败'
  } finally {
    captchaSending.value = false
  }
}

const retryLoad = async () => {
  await fetchProduct()
  if (captchaRequired.value && product.value) await sendCaptcha()
}

const handlePurchase = async () => {
  if (paying.value) return
  if (!selectedVariant.value) return ElMessage.warning('请选择类型')
  if (captchaRequired.value && !captchaId.value) return ElMessage.warning('请先获取验证码')
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  paying.value = true
  try {
    const purchaseResp = await publicRequest.post<ApiResp<{ orderId: string; mockPayToken: string }>>(`/api/products/public/${route.params.code}/purchase`, {
      variantId: selectedVariant.value.id,
      quantity: form.quantity,
      email: form.email,
      buyer: form.email,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode,
    })
    if (purchaseResp.data.code !== 200) {
      if ((purchaseResp.data.data as any)?.requireCaptcha) {
        captchaRequired.value = true
        ElMessage.warning(purchaseResp.data.message || '请先完成验证码校验')
        await sendCaptcha()
        return
      }
      ElMessage.error(purchaseResp.data.message || '购买失败')
      if (captchaRequired.value) await sendCaptcha()
      return
    }

    const callbackResp = await publicRequest.post<ApiResp<{ orderId: string; cards: string[] }>>('/api/products/public/payment/callback', {
      orderId: purchaseResp.data.data.orderId,
      mockPayToken: purchaseResp.data.data.mockPayToken,
      status: 'paid',
    })
    if (callbackResp.data.code !== 200) {
      ElMessage.error(callbackResp.data.message || '购买失败')
      if (captchaRequired.value) await sendCaptcha()
      return
    }

    orderResult.value = callbackResp.data.data
    resultDialogVisible.value = true
    ElMessage.success('支付成功，卡密已生成')
    captchaRequired.value = false
    captchaId.value = ''
    captchaImage.value = ''
    form.captchaCode = ''
  } catch (err: any) {
    const data = err?.response?.data
    if (data?.data?.requireCaptcha) {
      captchaRequired.value = true
      ElMessage.warning(data.message || '请先完成验证码校验')
      await sendCaptcha().catch(() => undefined)
    } else {
      ElMessage.error(data?.message || err?.message || '购买失败')
      if (captchaRequired.value) await sendCaptcha().catch(() => undefined)
    }
  } finally {
    paying.value = false
  }
}

const closeResultDialog = () => {
  resultDialogVisible.value = false
}

const downloadCardsAsTxt = () => {
  if (!orderResult.value?.cards.length) return
  const fileName = `order-${orderResult.value.orderId}.txt`
  const fileContent = orderResult.value.cards.join('\r\n')
  const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  document.documentElement.classList.add('public-route-scroll')
  document.body.classList.add('public-route-scroll')
  document.getElementById('app')?.classList.add('public-route-scroll')
  await fetchProduct()
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('public-route-scroll')
  document.body.classList.remove('public-route-scroll')
  document.getElementById('app')?.classList.remove('public-route-scroll')
})
</script>

<template>
  <div class="public-product-page" v-loading="loading">
    <div v-if="loadError" class="public-error-state">
      <h1>商品不可用</h1>
      <p>{{ loadError }}</p>
      <el-button type="primary" @click="retryLoad">重试</el-button>
    </div>
    <div v-if="product" class="public-product-shell">
      <section class="hero">
        <div class="hero-cover">
          <div class="cover-mark">
            <img :src="product.coverUrl || defaultProductCover" :alt="product.name" class="cover-mark-image" />
          </div>
        </div>
        <div class="hero-main">
          <el-form ref="formRef" :model="form" :rules="rules" label-position="right" label-width="auto"
            class="hero-form">
            <div class="hero-header">
              <h1>{{ product.name }}</h1>
              <p>{{ product.summary || '自动发货商品，下单后系统即时返回卡密。' }}</p>
              <div class="hero-pricing">
                <div class="price-line"><span>￥</span>{{ selectedVariant?.price || 0 }}</div>
                <span class="price-caption">当前选择价格</span>
              </div>
            </div>

            <el-form-item label="类型" class="hero-form-item">
              <div class="variant-list">
                <button v-for="variant in product.variants" :key="variant.id" type="button" class="variant-btn"
                  :class="{ active: selectedVariantId === variant.id }" @click="selectedVariantId = variant.id">
                  {{ variant.label }}
                </button>
              </div>
            </el-form-item>

            <!-- <el-form-item label="数量" prop="quantity" class="hero-form-item">
              <el-input-number v-model="form.quantity" :min="product.minBuy" :max="product.maxBuy" />
            </el-form-item> -->

            <el-form-item label="邮箱" prop="email" class="hero-form-item">
              <el-input v-model="form.email" placeholder="订单与卡密会发送到该邮箱" style="max-width: 300px;" />
            </el-form-item>

            <el-form-item label="支付" class="hero-form-item">
              <div class="payment-methods">
                <button type="button" class="payment-method-btn" :class="{ active: form.paymentMethod === 'alipay' }"
                  @click="form.paymentMethod = 'alipay'">
                  <img :src="alipayLogo" alt="支付宝" class="payment-method-logo payment-method-logo-alipay" />
                </button>
                <button type="button" class="payment-method-btn" :class="{ active: form.paymentMethod === 'wechat' }"
                  @click="form.paymentMethod = 'wechat'">
                  <img :src="wechatPayLogo" alt="微信支付" class="payment-method-logo payment-method-logo-wechat" />
                </button>
              </div>
            </el-form-item>

            <el-form-item v-if="captchaRequired" label="验证码" prop="captchaCode" class="hero-form-item">
              <div class="captcha-inline">
                <el-input v-model="form.captchaCode" placeholder="请输入图形验证码" />
                <button type="button" class="captcha-image-btn" :disabled="captchaSending" @click="sendCaptcha">
                  <img v-if="captchaImage" :src="captchaImage" alt="验证码" class="captcha-image" />
                  <span v-else>{{ captchaSending ? '加载中...' : '获取验证码' }}</span>
                </button>
              </div>
              <div class="captcha-tip">当前请求需要安全校验，完成后可继续购买。</div>
              <div v-if="captchaError" class="captcha-error">{{ captchaError }}</div>
            </el-form-item>

            <div class="buy-bar">
              <div class="amount">
                <!-- <span class="amount-label">合计</span> -->
                <strong class="amount-value">￥{{ totalAmount.toFixed(2) }}</strong>

              </div>

              <div class="flex gap20">
                <el-input-number v-model="form.quantity" :min="product.minBuy" :max="product.maxBuy" />
                <el-button type="primary" size="large" :loading="paying" @click="handlePurchase">立即购买</el-button>
              </div>
            </div>
          </el-form>
        </div>
      </section>

      <section class="detail-card">
        <h2>商品详情</h2>
        <div class="detail-text">{{ product.description || '暂无商品描述' }}</div>
      </section>

      <el-dialog v-model="resultDialogVisible" class="purchase-result-dialog" width="100vw" top="0" align-center
        :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false" :lock-scroll="true">
        <template v-if="orderResult">
          <div class="result-dialog-shell">
            <div class="result-dialog-head">
              <div>
                <h2>购买成功</h2>
                <p>请立即保存本次购买结果，页面刷新后不会保留当前展示内容。</p>
              </div>
            </div>

            <div class="result-meta">
              <div class="result-meta-item">
                <span>订单号</span>
                <strong>{{ orderResult.orderId }}</strong>
              </div>
              <div class="result-meta-item">
                <span>卡密数量</span>
                <strong>{{ orderResult.cards.length }}</strong>
              </div>
            </div>

            <h3 class="result-subtitle">商品信息</h3>
            <div class="cards-block">
              <div v-for="card in orderResult.cards" :key="card" class="card-item">{{ card }}</div>
            </div>

            <div class="result-dialog-actions">
              <el-button v-if="canDownloadCards" type="primary" @click="downloadCardsAsTxt">下载 txt</el-button>
              <el-button type="info" @click="closeResultDialog">关闭</el-button>
            </div>
          </div>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<style scoped lang="scss">
.public-product-page {
  min-height: 100dvh;
  padding: 24px;
  background: #f5f7fb;
}

.public-product-shell {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  gap: 20px;
}

.public-error-state {
  width: min(520px, 100%);
  margin: 18vh auto 0;
  padding: 28px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  text-align: center;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
}

.public-error-state h1 {
  margin: 0;
  color: #111827;
  font-size: 24px;
}

.public-error-state p {
  margin: 12px 0 20px;
  color: #6b7280;
  line-height: 1.7;
}

.hero,
.detail-card,
.result-card {
  border: 1px solid #ebeef5;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
}

.hero {
  display: grid;
  grid-template-columns: 176px minmax(0, 1fr);
  gap: 32px;
  padding: 28px;
}

.hero-cover {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.cover-mark {
  width: 176px;
  height: 176px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.cover-mark-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hero-main {
  max-width: 820px;
}

.hero-form {
  display: flex;
  flex-direction: column;
}


.hero-pricing {
  display: flex;
  align-items: flex-end;
  gap: 14px;
  padding: 18px 0;
  border-bottom: 1px solid #edf2f7;
  margin: 0 0 18px 0;
}

.price-caption {
  padding-bottom: 6px;
  color: #64748b;
  font-size: 13px;
}

.hero-form-item {
  margin-bottom: 20px;
}



.hero-form-item :deep(.el-form-item__label) {
  color: #374151;
  font-size: 14px;
  font-weight: 700;
  justify-content: flex-start;
  align-items: center;
  padding-right: 14px;
}

.hero-form-item :deep(.el-form-item__content) {
  line-height: normal;
  min-width: 0;
}

.payment-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.payment-method-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 168px;
  height: 46px;
  padding: 0 16px;
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.payment-method-btn.active {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.08);
}

.payment-method-logo {
  display: block;
  max-width: 100%;
  height: 22px;
  object-fit: contain;
}

.payment-method-logo-alipay {
  height: 24px;
}

.payment-method-logo-wechat {
  height: 22px;
}

.hero-main h1 {
  margin: 0;
  color: #111827;
  font-size: 34px;
}

.hero-main p {
  margin: 12px 0 0;
  color: #6b7280;
  font-size: 15px;
  line-height: 1.8;
}

.price-line {
  color: #ef4444;
  font-size: 40px;
  font-weight: 600;
  line-height: 1;

  span {
    font-size: x-small;
  }
}

.variant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.variant-btn {
  border: 1px solid #dbe4f0;
  border-radius: 5px;
  padding: 4px 10px;
  background: #fff;
  color: #374151;
  font-size: 14px;
  cursor: pointer;
}

.variant-btn.active {
  border-color: #2563eb;
  background: #eff6ff;
  color: #2563eb;
  font-weight: 700;
}

.captcha-inline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.captcha-inline :deep(.el-input) {
  flex: 1;
}

.captcha-image-btn {
  flex: 0 0 auto;
  width: 132px;
  height: 34px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  overflow: hidden;
}

.captcha-image-btn:disabled {
  cursor: wait;
  opacity: 0.75;
}

.captcha-image {
  display: block;
  width: 100%;
  height: 100%;
}

.captcha-error {
  margin-top: 6px;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 18px;
}

.buy-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding-top: 18px;
  border-top: 1px solid #e6edf5;
}

.amount {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.amount-label {
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
}

.amount-value {
  color: #1d4ed8;
  font-size: 38px;
  line-height: 1;
}

.detail-card,
.result-card {
  padding: 22px 24px;
}

.detail-card h2,
.result-card h2 {
  margin: 0 0 14px;
  color: #111827;
  font-size: 20px;
}

.result-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.result-meta-item {
  padding: 12px 14px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #f8fbff;
}

.result-meta-item span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.result-meta-item strong {
  display: block;
  margin-top: 6px;
  color: #0f172a;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-all;
}

.result-subtitle {
  margin: 0;
  color: #0f172a;
  font-size: 15px;
  font-weight: 700;
}

.detail-text {
  color: #374151;
  line-height: 1.9;
  white-space: pre-wrap;
}

.cards-block {
  display: grid;
  gap: 4px;
}

.card-item {
  padding: 5px 14px;
  border-radius: 10px;
  background: #f8fafc;
  color: #111827;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

:deep(.purchase-result-dialog) {
  margin: 0;
}

:deep(.purchase-result-dialog.el-dialog) {
  width: 100vw !important;
  max-width: 100vw;
  min-height: 100dvh;
  margin: 0;
  border-radius: 0;
}

:deep(.purchase-result-dialog .el-dialog__header) {
  display: none;
}

:deep(.purchase-result-dialog .el-dialog__body) {
  min-height: 100dvh;
  padding: 0;
  background:
    linear-gradient(180deg, rgba(236, 245, 255, 0.92), rgba(255, 255, 255, 0.98)),
    #f8fafc;
}

.result-dialog-shell {
  max-width: 920px;
  max-height: 100dvh;
  margin: 0 auto;
  padding: 36px 24px calc(32px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-dialog-head h2 {
  margin: 0;
  color: #111827;
  font-size: 28px;
}

.result-dialog-head p {
  margin: 10px 0 0;
  color: #475569;
  line-height: 1.7;
}

.result-dialog-actions {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding-top: 8px;
}

@media (max-width: 768px) {
  .public-product-page {
    padding: 10px;
    padding-bottom: calc(96px + env(safe-area-inset-bottom));
  }

  .public-product-shell {
    gap: 12px;
  }

  .hero {
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 16px;
    border-radius: 14px;
  }

  .hero-cover {
    justify-content: center;
  }

  .cover-mark {
    width: min(48vw, 168px);
    height: min(48vw, 168px);
    border-radius: 14px;
  }

  .hero-main {
    max-width: none;
  }

  .hero-main h1 {
    font-size: 28px;
    line-height: 1.2;
  }

  .hero-main p {
    font-size: 14px;
    line-height: 1.7;
  }

  .hero-form {
    display: block;
  }

  .hero-header {
    padding-bottom: 14px;
  }

  .hero-form-item :deep(.el-form-item) {
    display: block;
    margin-bottom: 0;
  }

  .hero-form-item :deep(.el-form-item__label) {
    display: block;
    width: auto !important;
    text-align: left;
  }

  .hero-form-item :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }

  .hero-pricing {
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-top: 14px;
  }

  .price-line {
    font-size: 34px;
  }

  .price-caption {
    padding-bottom: 2px;
    font-size: 12px;
  }

  .variant-list,
  .payment-methods {
    gap: 8px;
  }

  .variant-btn {
    min-height: 36px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 13px;
  }

  .payment-method-btn {
    flex: 1 1 calc(50% - 4px);
    min-width: 0;
    height: 42px;
    padding: 0 12px;
    border-radius: 9px;
  }

  .payment-method-logo-alipay {
    height: 22px;
  }

  .payment-method-logo-wechat {
    height: 20px;
  }

  .hero-form-item :deep(.el-input-number) {
    width: 53%;
  }

  .hero-form-item :deep(.el-input-number .el-input__wrapper) {
    width: 100%;
  }

  .hero-form-item :deep(.el-input__wrapper) {
    min-height: 40px;
  }

  .captcha-inline {
    gap: 8px;
  }

  .buy-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    margin-top: 0;
    padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid #dbe4f0;
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 -8px 24px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(10px);
  }

  .amount {
    flex: 1;
    align-items: center;
  }

  .amount-value {
    font-size: 28px;
  }

  .buy-bar :deep(.el-button) {
    width: auto;
    margin-left: 0;
  }

  .detail-card,
  .result-card {
    padding: 18px 16px;
    border-radius: 14px;
  }

  .detail-card h2,
  .result-card h2 {
    font-size: 18px;
  }

  .card-item {
    padding: 10px 12px;
    font-size: 13px;
  }

  .result-meta {
    grid-template-columns: 1fr;
  }

  .result-dialog-shell {
    padding: 20px 14px calc(20px + env(safe-area-inset-bottom));
  }

  .result-dialog-head h2 {
    font-size: 24px;
  }

  .result-dialog-actions {
    position: sticky;
    bottom: 0;
    padding: 10px 0 calc(2px + env(safe-area-inset-bottom));
  }
}

@media (max-width: 480px) {
  .public-product-page {
    padding: 8px;
    padding-bottom: calc(72px + env(safe-area-inset-bottom));
  }

  .hero {
    padding: 14px;
    gap: 14px;
  }

  .cover-mark {
    width: min(52vw, 156px);
    height: min(52vw, 156px);
  }

  .hero-main h1 {
    font-size: 24px;
  }

  .price-line {
    font-size: 30px;
  }

  .hero-pricing {
    flex-wrap: wrap;
  }

  .payment-method-btn {
    flex: none;
  }

  .amount-label {
    font-size: 13px;
  }

  .amount-value {
    font-size: 24px;
  }

  .buy-bar {
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  }

  .buy-bar :deep(.el-button) {}

  .el-input-number {
    width: 120px;
    line-height: 20px;
  }
}
</style>
