import nodemailer from "nodemailer";

const getBool = (val: string | undefined, def = false) => {
  if (typeof val === "undefined") return def;
  const v = String(val).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(v)) return true;
  if (["0", "false", "no", "n", "off"].includes(v)) return false;
  return def;
};

const getRequiredEnv = (key: string) => {
  const v = process.env[key];
  if (!v) throw new Error(`缺少环境变量 ${key}`);
  return v;
};

let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const host = getRequiredEnv("VERIFYSYS_SMTP_HOST");
  const port = Number(process.env.VERIFYSYS_SMTP_PORT || 465);
  const secure = getBool(process.env.VERIFYSYS_SMTP_SECURE, port === 465);
  const user = getRequiredEnv("VERIFYSYS_SMTP_USER");
  const pass = getRequiredEnv("VERIFYSYS_SMTP_PASS");

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
};

export const sendVerificationEmail = async (opts: { to: string; code: string; purpose: "register" | "reset"; expireMinutes: number }) => {
  const from = getRequiredEnv("VERIFYSYS_SMTP_FROM");
  const product = process.env.VERIFYSYS_PRODUCT_NAME || "VerifySys";

  const subject = opts.purpose === "register" ? `${product} 注册验证码` : `${product} 找回密码验证码`;
  const purposeLabel = opts.purpose === "register" ? "注册" : "找回密码";
  const text = `${product} ${purposeLabel}验证码：${opts.code}\n有效期：${opts.expireMinutes} 分钟\n请勿泄露验证码。`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6;">
      <h2 style="margin:0 0 12px 0;">${product} ${purposeLabel}验证码</h2>
      <p style="margin:0 0 10px 0;">你的验证码是：</p>
      <div style="font-size: 28px; font-weight: 800; letter-spacing: 6px; padding: 10px 14px; background:#f3f4f6; border-radius: 10px; display:inline-block;">${opts.code}</div>
      <p style="margin:12px 0 0 0; color:#6b7280;">有效期：${opts.expireMinutes} 分钟，请勿泄露验证码。</p>
    </div>
  `.trim();

  const t = getTransporter();
  await t.sendMail({ from, to: opts.to, subject, text, html });
};

export const sendOrderDeliveryEmail = async (opts: { to: string; orderId: string; productName: string; cards: string[] }) => {
  const from = getRequiredEnv("VERIFYSYS_SMTP_FROM");
  const product = process.env.VERIFYSYS_PRODUCT_NAME || "VerifySys";
  const subject = `${product} 订单发货通知`;
  const cardText = opts.cards.join("\n");
  const text = `订单号：${opts.orderId}\n商品：${opts.productName}\n卡密：\n${cardText}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.7;">
      <h2 style="margin:0 0 12px 0;">订单发货通知</h2>
      <p style="margin:0 0 8px 0;">订单号：<strong>${opts.orderId}</strong></p>
      <p style="margin:0 0 8px 0;">商品：<strong>${opts.productName}</strong></p>
      <p style="margin:12px 0 8px 0;">卡密如下：</p>
      <pre style="margin:0; padding:12px 14px; background:#f3f4f6; border-radius:10px; white-space:pre-wrap; word-break:break-all;">${cardText}</pre>
    </div>
  `.trim();

  const t = getTransporter();
  await t.sendMail({ from, to: opts.to, subject, text, html });
};
