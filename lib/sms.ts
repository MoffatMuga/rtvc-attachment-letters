/**
 * Optional SMS through Africa's Talking (https://africastalking.com).
 * Turned off unless AT_USERNAME and AT_API_KEY are set. A failed SMS never
 * stops a letter from being approved.
 *
 * AT_USERNAME=sandbox uses their test environment: it accepts the request
 * but does NOT deliver to real phones.
 */
export type SmsResult = "sent" | "failed" | "off";

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  if (!username || !apiKey || !to) return "off";

  const base =
    process.env.AT_BASE_URL ||
    (username.toLowerCase() === "sandbox"
      ? "https://api.sandbox.africastalking.com"
      : "https://api.africastalking.com");

  const body = new URLSearchParams({ username, to, message, bulkSMSMode: "1" });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);

  try {
    const res = await fetch(`${base}/version1/messaging`, {
      method: "POST",
      headers: {
        apikey: apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json().catch(() => null);
    const rec = data?.SMSMessageData?.Recipients?.[0];
    // 100 Processed, 101 Sent, 102 Queued
    const ok = res.status < 300 && rec && [100, 101, 102].includes(Number(rec.statusCode));
    if (!ok) {
      console.error("SMS not sent:", res.status, rec?.status ?? JSON.stringify(data)?.slice(0, 200));
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("SMS error:", (e as Error).message);
    return "failed";
  }
}

/** Short, plain-ASCII text so it stays a single SMS. */
export function letterSentSms(fullName: string, ref: string): string {
  const first = fullName.split(" ")[0];
  const nice = first.charAt(0) + first.slice(1).toLowerCase();
  return `RTVC: Hi ${nice}, your attachment letter ${ref} has been sent to your email. Check Inbox/Spam.`;
}
