/**
 * 判断当前前端用户是否具备管理员视图权限
 *
 * @param user 当前登录用户，包含用户名、角色和权限
 * @returns 返回 true 表示可展示管理员专属筛选项和字段
 */
export const isAdminUser = (user?: { username?: string; roles?: string[]; permissions?: string[] } | null) => {
  const roles = user?.roles || []
  const permissions = user?.permissions || []
  const username = user?.username || ''
  return roles.includes('role-admin') || permissions.includes('*') || username === 'admin'
}
