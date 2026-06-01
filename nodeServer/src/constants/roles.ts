export const ROLE_ADMIN = "role-admin";
export const ROLE_DEVELOPER = "role-developer";
export const LEGACY_ROLE_OPS = "role-ops";

export const DEVELOPER_PERMISSIONS = [
  "codes",
  "projects",
  "security-policies",
  "custom-data",
  "products",
  "auto-delivery",
  "profile",
];

export const SYSTEM_ROLE_DEFINITIONS = [
  {
    id: ROLE_ADMIN,
    name: "超级管理员",
    description: "网站超级管理员，拥有平台全部权限",
    permissions: ["*"],
    isDefault: false,
  },
  {
    id: ROLE_DEVELOPER,
    name: "开发者",
    description: "注册默认角色，管理自己名下的项目、注册码和业务配置",
    permissions: DEVELOPER_PERMISSIONS,
    isDefault: true,
  },
];

export const SYSTEM_ROLE_IDS = SYSTEM_ROLE_DEFINITIONS.map((role) => role.id);

export const ASSIGNABLE_PERMISSION_VALUES = [
  "codes",
  "projects",
  "security-policies",
  "custom-data",
  "products",
  "auto-delivery",
  "profile",
];

export const sanitizeAssignablePermissions = (permissions: unknown): string[] => {
  if (!Array.isArray(permissions)) return [];
  const allowed = new Set(ASSIGNABLE_PERMISSION_VALUES);
  return Array.from(new Set(permissions.map(String).filter((permission) => allowed.has(permission))));
};
