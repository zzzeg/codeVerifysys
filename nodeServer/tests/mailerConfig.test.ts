import test from "node:test";
import assert from "node:assert/strict";
import { getEnvValue } from "../src/env";
import { buildOrderProductLine } from "../src/utils/mailer";

test("邮件配置可以通过项目环境文件读取", () => {
  assert.equal(getEnvValue("VERIFYSYS_SMTP_HOST"), "smtp.163.com");
  assert.equal(getEnvValue("VERIFYSYS_SMTP_PORT"), "465");
  assert.equal(getEnvValue("VERIFYSYS_SMTP_SECURE"), "true");
});

test("订单发货邮件商品行包含标题、分类和数量", () => {
  assert.equal(
    buildOrderProductLine({ productName: "这是一个商品名称", variantLabel: "天卡", quantity: 1 }),
    "这是一个商品名称 - 天卡 * 1",
  );
});
