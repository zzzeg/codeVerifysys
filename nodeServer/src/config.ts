import { getEnvValue } from "./env";

export const SECRET = getEnvValue("JWT_SECRET") || "verifysys-dev-secret";
