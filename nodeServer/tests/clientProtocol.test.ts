import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildBodyHash,
  buildSignatureMaterial,
  clientFail,
  clientOk,
  normalizeClientRequest,
  signHmacSha256,
} from "../src/services/clientProtocol";

test("normalizeClientRequest maps legacy projectToken/code fields to appId/licenseCode", () => {
  const normalized = normalizeClientRequest({
    projectToken: "project-1",
    code: "REG-001",
    machineCode: "MACHINE",
    timestamp: "1760000000000",
    nonce: "nonce-1",
    sign: "SIGN",
    clientVersion: "1.2.3",
    protocolVersion: "1",
  });

  assert.equal(normalized.appId, "project-1");
  assert.equal(normalized.licenseCode, "REG-001");
  assert.equal(normalized.machineCode, "MACHINE");
  assert.equal(normalized.timestamp, 1760000000000);
  assert.equal(normalized.nonce, "nonce-1");
  assert.equal(normalized.sign, "SIGN");
  assert.equal(normalized.clientVersion, "1.2.3");
  assert.equal(normalized.protocolVersion, 1);
});

test("clientOk and clientFail return stable client response envelopes", () => {
  const ok = clientOk({ sessionId: "s-1" }, "验证成功", 1760000000000);
  assert.deepEqual(ok, {
    success: true,
    code: 0,
    message: "验证成功",
    data: { sessionId: "s-1" },
    timestamp: 1760000000000,
    sign: "",
  });

  const fail = clientFail(1006, "签名错误", 1760000000001);
  assert.deepEqual(fail, {
    success: false,
    code: 1006,
    message: "签名错误",
    data: null,
    timestamp: 1760000000001,
    sign: "",
  });
});

test("signHmacSha256 signs canonical request material", () => {
  const body = {
    appId: "project-1",
    licenseCode: "REG-001",
    machineCode: "MACHINE",
    timestamp: 1760000000000,
    nonce: "nonce-1",
  };
  const bodyHash = buildBodyHash(body);
  const material = buildSignatureMaterial({
    method: "post",
    path: "/api/client/verify",
    appId: body.appId,
    licenseCode: body.licenseCode,
    machineCode: body.machineCode,
    timestamp: body.timestamp,
    nonce: body.nonce,
    bodyHash,
  });
  const expected = createHmac("sha256", "secret").update(material).digest("hex");

  assert.equal(signHmacSha256(material, "secret"), expected);
  assert.equal(material, [
    "POST",
    "/api/client/verify",
    "project-1",
    "REG-001",
    "MACHINE",
    "1760000000000",
    "nonce-1",
    bodyHash,
  ].join("\n"));
});
