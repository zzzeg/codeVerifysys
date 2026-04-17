import bcrypt from "bcryptjs";

export const hashPassword = (raw: string) => bcrypt.hashSync(raw, 10);
export const verifyPassword = (raw: string, hash: string) => bcrypt.compareSync(raw, hash);
