<template>
  <div class="help-shell">
    <h3>使用说明</h3>
    <p>自定义数据用于维护项目侧需要按键值读取的动态配置内容。</p>
    <ul>
      <li>先选择所属项目，再录入唯一的 Key。</li>
      <li>Value 支持较长文本，适合放置说明、配置项或前端展示内容。</li>
      <li>备注用于后台管理，不会影响客户端实际读取值。</li>
    </ul>
  </div>
</template>

<style scoped>
.help-shell {
  max-width: 760px;
  color: #4b5563;
  line-height: 1.8;
}

.help-shell h3 {
  margin: 0 0 12px;
  color: #111827;
  font-size: 18px;
}

.help-shell ul {
  margin: 12px 0 0;
  padding-left: 18px;
}
</style>
