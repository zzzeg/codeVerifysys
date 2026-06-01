<template>
  <div class="forbidden-page">
    <div class="forbidden-card">
      <div class="code">404</div>
      <div class="title">页面不存在</div>
      <div class="desc">抱歉，未找到你访问的页面。</div>
    </div>
  </div>
</template>

<style scoped>
.forbidden-page {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.forbidden-card {
  min-width: 280px;
  max-width: 420px;
  padding: 28px 24px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fff;
  text-align: center;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
}

.code {
  color: #409eff;
  font-size: 44px;
  font-weight: 800;
  line-height: 1;
}

.title {
  margin-top: 14px;
  color: #303133;
  font-size: 20px;
  font-weight: 700;
}

.desc {
  margin-top: 10px;
  color: #909399;
  font-size: 14px;
  line-height: 1.7;
}
</style>
