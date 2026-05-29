# Auth Client API Contract And Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first stable Auth.dll-to-nodeServer client API contract and backend main verification flow.

**Architecture:** Keep `nodeServer/src/routes/client.ts` as the HTTP boundary, but move reusable protocol behavior into small service utilities. The route accepts compatibility fields during migration, normalizes them to formal `appId/licenseCode` DTOs, then applies verification, session, and response formatting consistently.

**Tech Stack:** Node.js, Express 5, TypeScript, MySQL via existing `db/mysql.ts`, Node `crypto`, node:test with `ts-node/register`.

---

### Task 1: Contract Documents

**Files:**
- Create: `D:\git\verifySys\docs\auth-client-api-contract.md`
- Create: `D:\git\verifySys\docs\superpowers\plans\2026-05-26-auth-client-api-contract-and-backend.md`

- [x] **Step 1: Write the interface contract**

Create a standalone contract covering fields, signing, responses, endpoints, and error codes.

- [x] **Step 2: Write the implementation plan**

Create this plan so backend changes can be executed in small verifiable steps.

### Task 2: Protocol Utility Tests

**Files:**
- Create: `D:\git\verifySys\nodeServer\tests\clientProtocol.test.ts`
- Create: `D:\git\verifySys\nodeServer\src\services\clientProtocol.ts`
- Modify: `D:\git\verifySys\nodeServer\package.json`

- [x] **Step 1: Add failing tests**

Test three behaviors:

- legacy fields normalize to `appId/licenseCode`
- client responses include `success/code/message/data/timestamp/sign`
- request signatures are stable HMAC-SHA256 values

- [x] **Step 2: Run tests and verify failure**

Run:

```powershell
npm run test:client
```

Expected: FAIL because `src/services/clientProtocol.ts` does not exist yet.

- [x] **Step 3: Implement `clientProtocol.ts`**

Add DTO normalization, response builders, body hashing, signature material, and HMAC helpers.

- [x] **Step 4: Run tests and verify pass**

Run:

```powershell
npm run test:client
```

Expected: PASS.

### Task 3: Client Route Main Flow

**Files:**
- Modify: `D:\git\verifySys\nodeServer\src\routes\client.ts`
- Use: `D:\git\verifySys\nodeServer\src\services\clientProtocol.ts`

- [x] **Step 1: Replace local `ok/fail` helpers**

Use `clientOk` and `clientFail` from `clientProtocol.ts`.

- [x] **Step 2: Add `/verify` beside legacy `/login`**

Implement `/api/client/verify` as the formal route. Keep `/login` as a compatibility alias during migration.

- [x] **Step 3: Normalize request fields**

Support both `appId/licenseCode` and `projectToken/code`, then use only normalized names inside the route.

- [x] **Step 4: Return formal response data**

Return `sessionId`, `expireAt`, `expireAtText`, `remainSeconds`, `licenseCode`, `status`, `activatedAt`, and `cardType`.

- [x] **Step 5: Build TypeScript**

Run:

```powershell
npm run build
```

Expected: PASS.

### Task 4: Safe Endpoint Alignment

**Files:**
- Modify: `D:\git\verifySys\nodeServer\src\routes\client.ts`

- [x] **Step 1: Add `/license-info`**

Return current license state by `sessionId` or `licenseCode + machineCode`.

- [x] **Step 2: Add `/client-info`**

Update `customer_info` only for the current verified license/session.

- [x] **Step 3: Add `/report-event`**

Insert a `client` log row with action `report-event`.

- [x] **Step 4: Remove public write behavior from `/custom-data`**

Keep `GET /custom-data`; change `POST /custom-data` to return a controlled failure or route users to `/client-info` and `/report-event`.

- [x] **Step 5: Build TypeScript**

Run:

```powershell
npm run build
```

Expected: PASS.

### Task 5: Verification

**Files:**
- Verify: `D:\git\verifySys\nodeServer\src\routes\client.ts`
- Verify: `D:\git\verifySys\nodeServer\src\services\clientProtocol.ts`
- Verify: `D:\git\verifySys\docs\auth-client-api-contract.md`

- [x] **Step 1: Run protocol tests**

Run:

```powershell
npm run test:client
```

Expected: PASS.

- [x] **Step 2: Run backend build**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 3: Review changed files**

Run:

```powershell
git diff -- nodeServer docs "统一架构与对接规划.md"
```

Expected: diff only contains contract docs and client API backend changes.
