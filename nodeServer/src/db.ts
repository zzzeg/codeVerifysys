import { randomBytes, randomUUID } from "crypto";

export const uuid = () => randomUUID();
export const randomCode32 = () => randomBytes(16).toString("hex").toUpperCase();

export type UserStatus = "active" | "disabled";
export type CodeStatus = "unused" | "in_use" | "expired" | "frozen" | "deleted";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  roleIds: string[];
  permissions: string[];
  email?: string;
  phone?: string;
  status: UserStatus;
  departmentId?: string;
  remark?: string;
  avatar?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem?: boolean;
  isDefault?: boolean;
  roleType?: "system" | "extension";
}

export interface Project {
  id: string;
  projectNo?: number;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  stats?: {
    totalCodes: number;
    activeCodes: number;
  };
}

export interface RegisterCode {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  cardType: string;
  status: CodeStatus;
  isOnline: boolean;
  isBound: boolean;
  saleType: string,
  machineCode?: string;
  lastLoginIp?: string;
  lastLoginAt?: number;
  activatedAt?: number;
  unbindPassword?: string;
  customerInfo?: string;
  remark?: string;
  expireAt?: number;
  createdAt: number;
}

export interface CustomData {
  id: string;
  projectId: string;
  projectName?: string;
  key: string;
  value: string;
  remark?: string;
}

export interface SecurityPolicy {
  id: string;
  projectId: string;
  projectName?: string;
  name: string;
  mode: "basic" | "advanced";
  status: "enabled" | "disabled";
  config?: Record<string, unknown>;
  createdAt?: number;
}

export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  cardType: string;
}

export interface Product {
  id: string;
  projectId: string;
  name: string;
  summary?: string;
  allowAnonymous: boolean;
  minBuy: number;
  maxBuy: number;
  variants: ProductVariant[];
  description?: string;
  linkCode: string;
}

export interface Order {
  id: string;
  productId: string;
  buyer: string;
  quantity: number;
  amount: number;
  status: "pending" | "paid" | "failed";
  createdAt: number;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  category: "system" | "todo";
  read: boolean;
  createdAt: number;
}

export interface SystemConfig {
  siteName: string;
  logo: string;
  uploadLimitMb: number;
  mail?: Record<string, unknown>;
  params: Record<string, string>;
}

export const paginate = <T>(list: T[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return { total: list.length, list: list.slice(start, end) };
};
