import "server-only";

type ResetEmailInput = {
  to: string;
  url: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getPasswordRecoveryEmailConfigStatus() {
  const apiKeyPresent = Boolean(process.env.RESEND_API_KEY?.trim());
  const sender = process.env.SAMURA_EMAIL_FROM?.trim() ?? "";
  const baseUrl = process.env.BETTER_AUTH_URL?.trim() ?? "";
  const senderValid = Boolean(sender && sender.includes("@") && !/[\r\n]/.test(sender));

  let baseUrlValid = false;
  let baseUrlSecure = false;
  try {
    const url = new URL(baseUrl);
    baseUrlSecure = process.env.NODE_ENV !== "production" || url.protocol === "https:";
    baseUrlValid = !url.username && !url.password && baseUrlSecure;
  } catch {
    // Report only validation state; never expose configured values.
  }

  return {
    apiKeyPresent,
    senderPresent: Boolean(sender),
    senderValid,
    baseUrlPresent: Boolean(baseUrl),
    baseUrlValid,
    configured: apiKeyPresent && senderValid && baseUrlValid,
  };
}

export function isPasswordRecoveryEmailConfigured() {
  return getPasswordRecoveryEmailConfigStatus().configured;
}

export async function sendPasswordResetEmail({ to, url }: ResetEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.SAMURA_EMAIL_FROM?.trim();
  const authBaseUrl = process.env.BETTER_AUTH_URL?.trim();

  if (!apiKey || !from || !authBaseUrl) {
    throw new Error("Password recovery email delivery is not configured.");
  }

  const resetUrl = new URL(url);
  const trustedBaseUrl = new URL(authBaseUrl);
  if (
    resetUrl.origin !== trustedBaseUrl.origin ||
    (process.env.NODE_ENV === "production" && resetUrl.protocol !== "https:")
  ) {
    throw new Error("Refusing to send an untrusted password recovery URL.");
  }

  const safeUrl = escapeHtml(resetUrl.toString());
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Reset your SAMURA password",
      text: [
        "We received a request to reset the password for your SAMURA account.",
        "",
        `Use this one-time link within 60 minutes: ${resetUrl.toString()}`,
        "",
        "If you did not request this, you can ignore this email. Your password will not change.",
      ].join("\n"),
      html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#080b12;color:#f4f6fb;font-family:Arial,sans-serif;padding:32px 16px"><main style="max-width:520px;margin:0 auto;background:#101522;border:1px solid #263041;border-radius:20px;padding:32px"><p style="font-size:12px;letter-spacing:4px;color:#a8f0d0;font-weight:bold">SAMURA AI</p><h1 style="font-size:26px;line-height:1.25">Reset your password</h1><p style="color:#c5ccda;line-height:1.7">We received a request to reset your SAMURA account password. Use the button below to choose a new password.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#a8f0d0;color:#07120e;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:10px">Reset password</a></p><p style="font-size:13px;color:#a3aec1;line-height:1.7">This one-time link expires in 60 minutes. If you did not request a reset, ignore this email. Your password will remain unchanged.</p><p style="font-size:12px;color:#69758a;margin-top:28px">For your security, do not forward this email or share the link.</p></main></body></html>`,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    // Do not log the recipient, reset URL, API key, or provider response body.
    throw new Error(`Password recovery email provider returned HTTP ${response.status}.`);
  }
}
