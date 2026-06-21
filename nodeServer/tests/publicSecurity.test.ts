import test from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryRateLimiter,
  getClientIp,
  isMockPaymentCallbackEnabled,
  shouldRequirePublicCaptcha,
} from "../src/utils/publicSecurity";

test("公共限流器在窗口内超过次数后拒绝请求", () => {
  const limiter = createMemoryRateLimiter({ windowMs: 1000, max: 2 });

  assert.equal(limiter.consume("ip:captcha", 100).allowed, true);
  assert.equal(limiter.consume("ip:captcha", 200).allowed, true);
  const blocked = limiter.consume("ip:captcha", 300);

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterMs, 800);
});

test("公共限流器窗口过期后允许重新请求", () => {
  const limiter = createMemoryRateLimiter({ windowMs: 1000, max: 1 });

  assert.equal(limiter.consume("ip:purchase", 100).allowed, true);
  assert.equal(limiter.consume("ip:purchase", 200).allowed, false);
  assert.equal(limiter.consume("ip:purchase", 1200).allowed, true);
});

test("公共限流器超过 key 容量时会移除最早的记录", () => {
  const limiter = createMemoryRateLimiter({ windowMs: 10_000, max: 1, maxKeys: 2 });

  assert.equal(limiter.consume("first", 100).allowed, true);
  assert.equal(limiter.consume("second", 200).allowed, true);
  assert.equal(limiter.consume("third", 300).allowed, true);

  assert.equal(limiter.consume("first", 400).allowed, true);
});

test("公共购买验证码只在风险状态下要求", () => {
  assert.equal(shouldRequirePublicCaptcha({ purchaseCount: 0, failureCount: 0 }), false);
  assert.equal(shouldRequirePublicCaptcha({ purchaseCount: 3, failureCount: 0 }), true);
  assert.equal(shouldRequirePublicCaptcha({ purchaseCount: 0, failureCount: 1 }), true);
});

test("客户端 IP 默认不信任代理头", () => {
  const req = {
    headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    ip: "::1",
    socket: { remoteAddress: "127.0.0.1" },
  };

  assert.equal(getClientIp(req), "::1");
});

test("客户端 IP 显式信任代理时取代理头第一个地址", () => {
  const req = {
    headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    ip: "::1",
    socket: { remoteAddress: "127.0.0.1" },
  };

  assert.equal(getClientIp(req, { trustProxy: true }), "203.0.113.10");
});

test("模拟支付回调仅在显式开启或非生产环境允许", () => {
  assert.equal(isMockPaymentCallbackEnabled({ NODE_ENV: "production" }), false);
  assert.equal(isMockPaymentCallbackEnabled({ NODE_ENV: "production", ENABLE_MOCK_PAYMENT_CALLBACK: "true" }), true);
  assert.equal(isMockPaymentCallbackEnabled({ NODE_ENV: "development" }), true);
});
