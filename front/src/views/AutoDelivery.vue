<script setup lang="ts">
import { computed, ref } from 'vue'

type ProductRow = {
  project: string
  name: string
  buyRange: string
  allowCardType: string
  links: string
  remark: string
}

type ProductTypeRow = {
  type: string
  price: string
  cardType: string
}

const activeTab = ref<'list' | 'add'>('list')
const detailMode = ref(false)

const filterForm = ref({
  project: 'all',
  productName: '',
})

const products = ref<ProductRow[]>([
  {
    project: '测试项目',
    name: '密钥',
    buyRange: '1/10',
    allowCardType: '允许',
    links: '#',
    remark: '这是密钥，点击查看类型',
  },
])

const productForm = ref({
  projectName: '测试项目',
  productName: '密钥',
  cardConstraint: 'enabled',
  addonMode: 'closed',
  intro: "这是密钥，点击 STYLE='font-size:15px;color:red'>匿名购买</b>",
  description:
    "这是挂机的密钥，尽量不要显示图片，仅做学习使用，请勿用于其他途径。商品描述支持换行，请使用 <br/>。",
})

const productTypeRows = ref<ProductTypeRow[]>([
  { type: '1个月/30天', price: '50.00', cardType: '月卡' },
  { type: '1天/24小时', price: '5.00', cardType: '天卡' },
  { type: '1年/12个月/360天', price: '500.00', cardType: '年卡' },
  { type: '半年/6个月/180天', price: '280.00', cardType: '半年卡' },
  { type: '永久/10年/120个月/3600天', price: '1299.99', cardType: '永久卡' },
])

const quantityRows = ref([{ min: 1, max: 10 }])

const pageTitle = computed(() => {
  if (detailMode.value) return '商品编辑'
  return activeTab.value === 'list' ? '商品管理' : '商品添加'
})

const enterList = () => {
  activeTab.value = 'list'
  detailMode.value = false
}

const enterAdd = () => {
  activeTab.value = 'add'
  detailMode.value = false
}

const enterEdit = () => {
  detailMode.value = true
}
</script>

<template>
  <div class="vs-ref-shell">
    <div class="vs-ref-frame auto-frame">
      <aside class="auto-side">
        <div class="auto-side-head">自动发卡</div>
        <div class="auto-side-body">
          <button
            type="button"
            class="auto-side-link"
            :class="{ active: activeTab === 'list' && !detailMode }"
            @click="enterList"
          >
            &gt; 商品管理
          </button>
          <button
            type="button"
            class="auto-side-link"
            :class="{ active: activeTab === 'add' && !detailMode }"
            @click="enterAdd"
          >
            &gt; 商品添加
          </button>
        </div>
      </aside>

      <section class="vs-ref-main">
        <div class="vs-ref-main-head">
          <h2 class="vs-ref-main-title">{{ pageTitle }}</h2>
        </div>

        <div class="vs-ref-main-body auto-body">
          <template v-if="!detailMode && activeTab === 'list'">
            <div class="auto-toolbar">
              <label>项目名称：</label>
              <el-select v-model="filterForm.project" class="filter-select">
                <el-option label="-所有项目-" value="all" />
                <el-option label="测试项目" value="测试项目" />
              </el-select>

              <label class="filter-label-gap">商品名称：</label>
              <el-input v-model="filterForm.productName" class="filter-input" />

              <el-button type="primary">查询</el-button>
            </div>

            <el-table :data="products" class="auto-table" style="width: 100%">
              <el-table-column prop="project" label="项目名称" min-width="120" />
              <el-table-column prop="name" label="商品名称" min-width="120" align="center" />
              <el-table-column prop="buyRange" label="购买数/最小/最大" min-width="160" align="center" />
              <el-table-column prop="allowCardType" label="允许售卡类型" width="120" align="center" />
              <el-table-column label="商品链接" width="110" align="center">
                <template #default="{ row }">
                  <el-link :href="row.links" target="_blank" type="primary">商品链接</el-link>
                </template>
              </el-table-column>
              <el-table-column prop="remark" label="简介" min-width="180" align="center" show-overflow-tooltip />
              <el-table-column label="操作" width="150" align="center" fixed="right">
                <template #default>
                  <div class="table-actions">
                    <el-button type="primary" size="small" @click="enterEdit">编辑</el-button>
                    <el-button type="danger" size="small">删除</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <template v-else>
            <div class="form-shell">
              <el-form label-width="106px" class="edit-form">
                <el-form-item label="项目名称：">
                  <div class="form-text">{{ productForm.projectName }}</div>
                </el-form-item>

                <el-form-item label="商品名称：">
                  <div class="form-text">{{ productForm.productName }}</div>
                </el-form-item>

                <el-form-item label="*匿名购买：">
                  <div class="form-field">
                    <el-radio-group v-model="productForm.cardConstraint">
                      <el-radio value="enabled">启用</el-radio>
                      <el-radio value="closed">关闭</el-radio>
                    </el-radio-group>
                    <p class="hint-text">开启后，不用注册宝账户即可购买</p>
                  </div>
                </el-form-item>

                <el-form-item label="商品前缀：">
                  <div class="form-field">
                    <el-radio-group v-model="productForm.addonMode">
                      <el-radio value="enabled">启用</el-radio>
                      <el-radio value="closed">关闭</el-radio>
                    </el-radio-group>
                    <p class="hint-text">
                      商品前缀主要用于用户区分卡类型，开启后卡将改为
                      <span class="danger-text">卡类型前缀(拼音)</span>
                      +卡类型，例如：tiankaabcdefghi.js
                    </p>
                  </div>
                </el-form-item>

                <el-form-item label="*商品简介：">
                  <div class="form-field">
                    <el-input v-model="productForm.intro" type="textarea" :rows="4" />
                    <p class="hint-text">商品简介不能超过200个字符</p>
                  </div>
                </el-form-item>

                <el-form-item label="商品类型/价格：">
                  <div class="form-field wide-field">
                    <el-table :data="productTypeRows" size="small" border style="width: 100%">
                      <el-table-column prop="type" label="类型" min-width="220" />
                      <el-table-column prop="price" label="价格" width="130" />
                      <el-table-column prop="cardType" label="卡类型" width="120" />
                      <el-table-column label="操作" width="80" align="center">
                        <template #default>
                          <el-button type="danger" size="small">删除</el-button>
                        </template>
                      </el-table-column>
                    </el-table>
                    <p class="warn-text">如果项目设置了解绑密码，那么解绑密码与项目设置一致，否则解绑密码定码为123456</p>
                    <el-button type="warning">增加</el-button>
                  </div>
                </el-form-item>

                <el-form-item label="*商品数量：">
                  <div class="form-field wide-field">
                    <el-table :data="quantityRows" size="small" border style="width: 100%">
                      <el-table-column prop="min" label="单次最少购买数量" />
                      <el-table-column prop="max" label="单次最多购买数量" />
                    </el-table>
                    <p class="hint-text">商品单次购买数量最少为1，最大为1000</p>
                  </div>
                </el-form-item>

                <el-form-item label="*商品描述：">
                  <div class="form-field wide-field">
                    <el-input v-model="productForm.description" type="textarea" :rows="4" />
                    <p class="hint-text">商品描述换行请使用 &lt;br/&gt;</p>
                  </div>
                </el-form-item>

                <el-form-item>
                  <el-button type="primary">确认</el-button>
                </el-form-item>
              </el-form>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.auto-frame {
  display: flex;
  min-height: 0;
  flex-direction: row;
}

.auto-side {
  width: 224px;
  border-right: 1px solid var(--vs-border);
  background: rgba(255, 255, 255, 0.78);
}

.auto-side-head {
  padding: 14px 16px;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(90deg, var(--vs-primary) 0%, var(--vs-primary-strong) 100%);
}

.auto-side-body {
  padding: 8px;
}

.auto-side-link {
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 11px 14px;
  border-radius: 10px;
  font-size: 14px;
  color: #4b5563;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.auto-side-link:hover {
  background: rgba(249, 250, 251, 0.9);
}

.auto-side-link.active {
  background: rgba(243, 244, 246, 0.96);
  color: #111827;
}

.auto-body {
  overflow: auto;
}

.auto-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.auto-toolbar label {
  font-size: 14px;
  color: #374151;
}

.filter-select,
.filter-input {
  width: 192px;
}

.filter-label-gap {
  margin-left: 12px;
}

.auto-table {
  border-radius: 12px;
}

.table-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.form-shell {
  max-width: 920px;
}

.edit-form :deep(.el-form-item) {
  align-items: flex-start;
  margin-bottom: 20px;
}

.edit-form :deep(.el-form-item__label) {
  color: #374151;
  padding-top: 2px;
}

.edit-form :deep(.el-form-item:last-child) {
  margin-bottom: 0;
}

.form-text {
  padding-top: 2px;
  font-size: 14px;
  color: #111827;
}

.form-field {
  width: 100%;
  max-width: 720px;
}

.wide-field {
  max-width: 820px;
}

.hint-text {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
}

.danger-text {
  color: #ef4444;
}

.warn-text {
  margin: 10px 0 1px;
  font-size: 12px;
  color: #ef4444;
}

@media (max-width: 980px) {
  .auto-frame {
    flex-direction: column;
  }

  .auto-side {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--vs-border);
  }
}

@media (max-width: 720px) {
  .edit-form :deep(.el-form-item) {
    display: block;
  }

  .edit-form :deep(.el-form-item__label) {
    display: block;
    text-align: left;
    margin-bottom: 8px;
  }
}
</style>
