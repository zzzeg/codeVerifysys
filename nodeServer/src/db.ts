import { randomBytes, randomUUID } from "crypto";

export const uuid = () => randomUUID();
export const randomCode32 = () => randomBytes(16).toString("hex").toUpperCase();
export const publicId = () => randomBytes(8).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);

export type UserStatus = "active" | "disabled";
export type CodeStatus = "unused" | "in_use" | "expired" | "frozen" | "deleted";

export interface User {
  id: string;
  username: string;
  developerCode?: string;
  passwordHash: string;
  roleIds: string[];
  permissions: string[];
  email?: string;
  phone?: string;
  status: UserStatus;
  departmentId?: string;
  remark?: string;
  avatar?: string;
  realName?: string;
  idCard?: string;
  bankName?: string;
  alipayAccount?: string;
  qq?: string;
  address?: string;
  realVerifiedAt?: number;
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
  publicId?: string;
  projectNo?: number;
  creatorUserId?: string;
  developerUsername?: string;
  developerCode?: string;
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
  developerId?: string;
  developerUsername?: string;
  developerCode?: string;
}

export interface CustomData {
  id: string;
  publicId?: string;
  projectId: string;
  projectName?: string;
  developerId?: string;
  developerUsername?: string;
  developerCode?: string;
  key: string;
  value: string;
  remark?: string;
}

export interface SecurityPolicy {
  id: string;
  publicId?: string;
  projectId: string;
  projectName?: string;
  developerId?: string;
  developerUsername?: string;
  developerCode?: string;
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
  publicId?: string;
  projectId: string;
  creatorUserId?: string;
  developerUsername?: string;
  developerCode?: string;
  name: string;
  summary?: string;
  status?: "draft" | "published";
  coverUrl?: string;
  allowAnonymous: boolean;
  addonMode?: boolean;
  minBuy: number;
  maxBuy: number;
  variants: ProductVariant[];
  description?: string;
  linkCode: string;
}

export interface Order {
  id: string;
  productId: string;
  productName?: string;
  creatorUserId?: string;
  buyer: string;
  buyerEmail?: string;
  mockPayToken?: string;
  variantId?: string;
  variantLabel?: string;
  verifyCode?: string;
  deliveryPayload?: string[];
  quantity: number;
  amount: number;
  status: "pending" | "paid" | "delivered" | "failed" | "closed";
  settlementStatus?: "unsettled" | "settled";
  settleAt?: number;
  paidAt?: number;
  deliveredAt?: number;
  createdAt: number;
}

export interface WithdrawalRecord {
  id: string;
  userId: string;
  amount: number;
  status: "processing" | "completed" | "rejected";
  bankAccount: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  category: "system" | "todo" | "order" | "settlement";
  read: boolean;
  createdAt: number;
}

export interface SystemConfig {
  siteName: string;
  logo: string;
  uploadLimitMb: number;
  settlementDays?: number;
  mail?: Record<string, unknown>;
  params: Record<string, string>;
}

export const paginate = <T>(list: T[], page: number, pageSize: number) => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return { total: list.length, list: list.slice(start, end) };
};
