import test from "node:test";
import assert from "node:assert/strict";
import { getEnvValue } from "../src/env";

test("邮件配置可以通过项目环境文件读取", () => {
  assert.equal(getEnvValue("VERIFYSYS_SMTP_HOST"), "smtp.163.com");
  assert.equal(getEnvValue("VERIFYSYS_SMTP_PORT"), "465");
  assert.equal(getEnvValue("VERIFYSYS_SMTP_SECURE"), "true");
});
