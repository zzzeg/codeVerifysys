export const permissionOptions = [
  { label: '全部权限', value: '*' },
  { label: '平台总览', value: 'dashboard' },
  { label: '用户管理', value: 'users' },
  { label: '角色配置', value: 'roles' },
  { label: '注册码管理', value: 'codes' },
  { label: '项目管理', value: 'projects' },
  { label: '商品管理', value: 'products' },
  { label: '自定义数据', value: 'custom-data' },
  { label: '安全策略', value: 'security-policies' },
  { label: '自动发卡', value: 'auto-delivery' },
  { label: '系统日志', value: 'logs' },
  { label: '个人中心', value: 'profile' },
]

export const permissionLabelMap = Object.fromEntries(permissionOptions.map((item) => [item.value, item.label]))

export const getPermissionLabel = (value: string) => permissionLabelMap[value] || value
