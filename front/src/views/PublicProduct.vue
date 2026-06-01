<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { publicRequest } from '../utils/request'
import type { ApiResp } from '../utils/request'
import { useRoute } from 'vue-router'
import defaultProductCover from '../assets/default-cdk-product-220.svg'
import alipayLogo from '../assets/svg/Alipay_Chinese_logos.svg'
import wechatPayLogo from '../assets/svg/wechatpay_logos.svg'

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
const captchaImage = ref('')
const captchaId = ref('')
const form = reactive({
  quantity: 1,
  email: '',
  captchaCode: '',
  paymentMethod: 'alipay',
})

const selectedVariant = computed(() => product.value?.variants.find((item) => item.id === selectedVariantId.value) || null)
const totalAmount = computed(() => Number(selectedVariant.value?.price || 0) * Number(form.quantity || 1))

const fetchProduct = async () => {
  loading.value = true
  try {
    const resp = await publicRequest.get<ApiResp<ProductItem>>(`/api/products/public/${route.params.code}`)
    product.value = resp.data.data
    selectedVariantId.value = product.value.variants[0]?.id || ''
    form.quantity = product.value.minBuy || 1
  } finally {
    loading.value = false
  }
}

const sendCaptcha = async () => {
  captchaSending.value = true
  try {
    const resp = await publicRequest.post<ApiResp<{ captchaId: string; image: string }>>(`/api/products/public/${route.params.code}/captcha`)
    captchaId.value = resp.data.data.captchaId
    captchaImage.value = resp.data.data.image
    form.captchaCode = ''
  } finally {
    captchaSending.value = false
  }
}

const handlePurchase = async () => {
  if (!selectedVariant.value) return ElMessage.warning('请选择类型')
  if (!form.email.trim()) return ElMessage.warning('请输入邮箱')
  if (!form.captchaCode.trim()) return ElMessage.warning('请输入验证码')
  if (!captchaId.value) return ElMessage.warning('请先获取验证码')

  paying.value = true
  try {
    const purchaseResp = await publicRequest.post<ApiResp<{ orderId: string }>>(`/api/products/public/${route.params.code}/purchase`, {
      variantId: selectedVariant.value.id,
      quantity: form.quantity,
      email: form.email,
      buyer: form.email,
      captchaId: captchaId.value,
      captchaCode: form.captchaCode,
    })

    const callbackResp = await publicRequest.post<ApiResp<{ orderId: string; cards: string[] }>>('/api/products/public/payment/callback', {
      orderId: purchaseResp.data.data.orderId,
      status: 'paid',
    })

    orderResult.value = callbackResp.data.data
    ElMessage.success('支付成功，卡密已生成')
    await sendCaptcha()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.message || '购买失败')
    await sendCaptcha()
  } finally {
    paying.value = false
  }
}

onMounted(async () => {
  await fetchProduct()
  await sendCaptcha()
})
</script>

<template>
  <div class="public-product-page" v-loading="loading">
    <div v-if="product" class="public-product-shell">
      <section class="hero">
        <div class="hero-cover">
          <div class="cover-mark">
            <img :src="defaultProductCover" :alt="product.name" class="cover-mark-image" />
          </div>
        </div>
        <div class="hero-main">
          <el-form label-position="left" label-width="auto" class="hero-form">
            <div class="hero-header">
              <h1>{{ product.name }}</h1>
              <p>{{ product.summary || '自动发货商品，下单后系统即时返回卡密。' }}</p>
              <div class="hero-pricing">
                <div class="price-line">￥{{ selectedVariant?.price || 0 }}</div>
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

            <el-form-item label="数量" class="hero-form-item">
              <el-input-number v-model="form.quantity" :min="product.minBuy" :max="product.maxBuy" />
            </el-form-item>

            <el-form-item label="邮箱" class="hero-form-item">
              <el-input v-model="form.email" placeholder="请输入邮箱，订单与卡密会发送到该邮箱" />
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

            <el-form-item label="验证码" class="hero-form-item">
              <div class="captcha-inline">
                <el-input v-model="form.captchaCode" placeholder="请输入图形验证码" />
                <button type="button" class="captcha-image-btn" :disabled="captchaSending" @click="sendCaptcha">
                  <img v-if="captchaImage" :src="captchaImage" alt="验证码" class="captcha-image" />
                  <span v-else>{{ captchaSending ? '加载中...' : '获取验证码' }}</span>
                </button>
              </div>
            </el-form-item>

            <div class="buy-bar">
              <div class="amount">
                <span class="amount-label">合计</span>
                <strong class="amount-value">￥{{ totalAmount.toFixed(2) }}</strong>
              </div>
              <el-button type="primary" size="large" :loading="paying" @click="handlePurchase">立即购买</el-button>
            </div>
          </el-form>
        </div>
      </section>

      <section class="detail-card">
        <h2>商品详情</h2>
        <div class="detail-text">{{ product.description || '暂无商品描述' }}</div>
      </section>

      <section v-if="orderResult" class="result-card">
        <h2>购买成功</h2>
        <p>订单号：{{ orderResult.orderId }}</p>
        <div class="cards-block">
          <div v-for="card in orderResult.cards" :key="card" class="card-item">{{ card }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
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
  /* border-top: 1px solid #edf2f7; */
  border-bottom: 1px solid #edf2f7;
  margin: 0 0 18px 0;
}

.price-caption {
  padding-bottom: 6px;
  color: #64748b;
  font-size: 13px;
}

.hero-form-item {
  margin-bottom: 14px;
}



.hero-form-item :deep(.el-form-item__label) {
  color: #374151;
  font-size: 14px;
  font-weight: 700;
  /* line-height: 1.2; */
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
  font-weight: 800;
  line-height: 1;
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
  font-weight: 800;
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

.detail-text {
  color: #374151;
  line-height: 1.9;
  white-space: pre-wrap;
}

.cards-block {
  display: grid;
  gap: 8px;
  margin-top: 12px;
}

.card-item {
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  color: #111827;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
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
    /* padding: 0 0 8px; */
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
    width: 100%;
  }

  .hero-form-item :deep(.el-input-number .el-input__wrapper) {
    width: 100%;
  }

  .hero-form-item :deep(.el-input__wrapper) {
    min-height: 40px;
  }

  .captcha-inline {
    /* flex-direction: column; */
    /* align-items: stretch; */
    gap: 8px;
  }

  .captcha-image-btn {
    /* width: 100%;
    height: 40px; */
    /* border: 1px solid #dbe4f0; */
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
    font-size: 30px;
  }

  .buy-bar :deep(.el-button) {
    width: auto;
    min-width: 128px;
    height: 42px;
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
}

@media (max-width: 480px) {
  .public-product-page {
    padding: 8px;
    padding-bottom: calc(92px + env(safe-area-inset-bottom));
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

  .payment-methods {
    /* flex-direction: column; */
  }

  .payment-method-btn {
    flex: none;
    /* width: 100%; */
  }

  .amount-label {
    font-size: 13px;
  }

  .amount-value {
    font-size: 28px;
  }

  .buy-bar {
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
  }

  .buy-bar :deep(.el-button) {
    min-width: 116px;
  }
}
</style>
