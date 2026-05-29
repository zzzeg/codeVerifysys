import { createHash, createHmac } from "crypto";

export interface ClientRequestInput {
  appId?: unknown;
  projectToken?: unknown;
  licenseCode?: unknown;
  code?: unknown;
  machineCode?: unknown;
  sessionId?: unknown;
  timestamp?: unknown;
  nonce?: unknown;
  sign?: unknown;
  clientVersion?: unknown;
  protocolVersion?: unknown;
}

export interface NormalizedClientRequest {
  appId: string;
  licenseCode: string;
  machineCode: string;
  sessionId: string;
  timestamp: number;
  nonce: string;
  sign: string;
  clientVersion: string;
  protocolVersion: number;
}

export interface ClientResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  timestamp: number;
  sign: string;
}

export interface SignatureMaterialInput {
  method: string;
  path: string;
  appId?: string;
  licenseCode?: string;
  machineCode?: string;
  timestamp?: number | string;
  nonce?: string;
  bodyHash?: string;
}

const asString = (value: unknown) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const asNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const normalizeClientRequest = (input: ClientRequestInput = {}): NormalizedClientRequest => ({
  appId: asString(input.appId || input.projectToken),
  licenseCode: asString(input.licenseCode || input.code),
  machineCode: asString(input.machineCode),
  sessionId: asString(input.sessionId),
  timestamp: asNumber(input.timestamp),
  nonce: asString(input.nonce),
  sign: asString(input.sign),
  clientVersion: asString(input.clientVersion),
  protocolVersion: asNumber(input.protocolVersion) || 1,
});

export const clientOk = <T>(
  data: T,
  message = "success",
  timestamp = Date.now(),
): ClientResponse<T> => ({
  success: true,
  code: 0,
  message,
  data,
  timestamp,
  sign: "",
});

export const clientFail = (
  code: number,
  message: string,
  timestamp = Date.now(),
): ClientResponse<null> => ({
  success: false,
  code,
  message,
  data: null,
  timestamp,
  sign: "",
});

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
};

export const buildBodyHash = (body: unknown) =>
  createHash("sha256").update(stableStringify(body || {})).digest("hex");

export const buildSignatureMaterial = (input: SignatureMaterialInput) => [
  input.method.toUpperCase(),
  input.path,
  input.appId || "",
  input.licenseCode || "",
  input.machineCode || "",
  String(input.timestamp || ""),
  input.nonce || "",
  input.bodyHash || "",
].join("\n");

export const signHmacSha256 = (material: string, secret: string) =>
  createHmac("sha256", secret).update(material).digest("hex");
