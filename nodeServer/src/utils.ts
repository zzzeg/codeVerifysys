import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export const hashPassword = (raw: string) => bcrypt.hashSync(raw, 10);
export const verifyPassword = (raw: string, hash: string) => bcrypt.compareSync(raw, hash);

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const createDeveloperCodeCandidate = (length = 6) => {
  let result = "";
  const bytes = randomBytes(length);
  for (let i = 0; i < length; i += 1) {
    result += CODE_CHARS[bytes[i]! % CODE_CHARS.length];
  }
  return result;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatOrderTimestamp = (date = new Date()) =>
  `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;

export const createOrderIdCandidate = (developerCode: string, date = new Date()) => {
  const suffix = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, "0");
  return `${developerCode}${formatOrderTimestamp(date)}${suffix}`;
};
