type HeaderMap = Record<string, string | string[] | undefined>;

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  maxKeys?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
}

export interface CaptchaRiskInput {
  purchaseCount: number;
  failureCount: number;
}

interface RequestLike {
  headers?: HeaderMap;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

interface ClientIpOptions {
  trustProxy?: boolean;
}

/**
 * 创建基于内存的滑动窗口限流器
 *
 * @param options 限流配置，包含窗口时长和最大请求次数
 * @returns 返回带 consume 方法的限流器实例
 */
export const createMemoryRateLimiter = (options: RateLimitOptions) => {
  const records = new Map<string, number[]>();
  const maxKeys = Math.max(options.maxKeys || 5000, 1);

  return {
    /**
     * 消耗一次指定 key 的请求额度
     *
     * @param key 限流维度标识，通常由接口、IP 和业务标识组成
     * @param now 当前时间戳，默认使用 Date.now()
     * @returns 返回是否允许请求、剩余次数和建议重试时间
     */
    consume(key: string, now = Date.now()): RateLimitResult {
      // 1. 清理当前 key 过期的请求记录
      const startAt = now - options.windowMs;
      const hits = (records.get(key) || []).filter((time) => time > startAt);

      // 2. 判断是否已经超过窗口次数
      if (hits.length >= options.max) {
        const retryAfterMs = Math.max(options.windowMs - (now - hits[0]), 0);
        records.set(key, hits);
        return { allowed: false, retryAfterMs, remaining: 0 };
      }

      // 3. 记录本次请求并返回剩余额度
      hits.push(now);
      records.set(key, hits);
      if (records.size > maxKeys) {
        const oldestKey = records.keys().next().value;
        if (oldestKey && oldestKey !== key) records.delete(oldestKey);
      }
      return { allowed: true, retryAfterMs: 0, remaining: Math.max(options.max - hits.length, 0) };
    },

    /**
     * 清空限流器内存记录
     *
     * @returns 无返回值
     */
    clear() {
      records.clear();
    },
  };
};

/**
 * 获取请求客户端 IP
 *
 * @param req Express 请求对象或兼容对象
 * @param options 获取配置，trustProxy 为 true 时才读取代理头
 * @returns 返回客户端 IP 字符串
 */
export const getClientIp = (req: RequestLike, options: ClientIpOptions = {}) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstForwarded = String(forwardedValue || "").split(",")[0].trim();
  return (options.trustProxy ? firstForwarded : "") || req.ip || req.socket?.remoteAddress || "unknown";
};

/**
 * 判断公共购买是否需要验证码挑战
 *
 * @param input 风险输入，包含近期购买次数和失败次数
 * @returns 返回是否需要验证码
 */
export const shouldRequirePublicCaptcha = (input: CaptchaRiskInput) =>
  input.failureCount > 0 || input.purchaseCount >= 3;

/**
 * 判断是否允许使用模拟支付回调
 *
 * @param env 环境变量集合
 * @returns 返回当前环境是否允许模拟支付回调
 */
export const isMockPaymentCallbackEnabled = (env: Record<string, string | undefined> = process.env) => {
  if (String(env.ENABLE_MOCK_PAYMENT_CALLBACK || "").toLowerCase() === "true") return true;
  return env.NODE_ENV !== "production";
};
