import fs from "fs";
import path from "path";

type EnvMap = Record<string, string>;

const repoRoot = path.resolve(__dirname, "..", "..");

const parseEnvFile = (filePath: string): EnvMap => {
  if (!fs.existsSync(filePath)) return {};

  const env: EnvMap = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf("=");
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
};

export const rootEnv = parseEnvFile(path.join(repoRoot, ".env"));
export const devEnv = parseEnvFile(path.join(repoRoot, ".env.dev"));
const isProduction = process.env.NODE_ENV === "production";

export const getEnvValue = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value !== "") return value;
  }

  const fileSources = isProduction ? [rootEnv, devEnv] : [devEnv, rootEnv];
  for (const source of fileSources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "string" && value !== "") return value;
    }
  }

  return undefined;
};
